import type {
  ArchiveEntity,
  EntityType
} from "../archive.types";
import { generateId, generateVersionId } from "../archive.types";
import type {
  IRemoteAdapter,
  SyncChangeSet,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResult
} from "./sync.types";

interface StoredRemoteEntity {
  entity: ArchiveEntity;
  lastModified: number;
}

export class MockRemoteAdapter implements IRemoteAdapter {
  private storage = new Map<string, StoredRemoteEntity>();
  private changeLog: SyncChangeSet[] = [];
  private latencyMs = 300;
  private failureRate = 0;
  private serverTimeOffset = 0;

  constructor(options?: { latencyMs?: number; failureRate?: number }) {
    if (options?.latencyMs !== undefined) this.latencyMs = options.latencyMs;
    if (options?.failureRate !== undefined) this.failureRate = options.failureRate;
  }

  private entityKey(entityType: EntityType, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  private async delay(): Promise<void> {
    return new Promise((r) => setTimeout(r, this.latencyMs));
  }

  private maybeFail(): void {
    if (Math.random() < this.failureRate) {
      throw new Error("模拟远端服务器错误");
    }
  }

  private getServerTime(): number {
    return Date.now() + this.serverTimeOffset;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.delay();
      return true;
    } catch {
      return false;
    }
  }

  async pull(since: number, _cursor?: string): Promise<SyncPullResponse> {
    await this.delay();
    this.maybeFail();

    const changes = this.changeLog.filter((c) => c.timestamp > since);

    return {
      changes: JSON.parse(JSON.stringify(changes)),
      serverTime: this.getServerTime(),
      hasMore: false
    };
  }

  async push(request: SyncPushRequest): Promise<SyncPushResult> {
    await this.delay();
    this.maybeFail();

    const accepted: SyncPushResult["accepted"] = [];
    const rejected: SyncPushResult["rejected"] = [];
    const serverTime = this.getServerTime();

    for (const change of request.changes) {
      const key = this.entityKey(change.entityType, change.entityId);
      const stored = this.storage.get(key);

      try {
        if (change.operation === "delete") {
          if (stored) {
            this.storage.delete(key);
            this.changeLog.push({
              ...change,
              timestamp: serverTime
            });
          }
          accepted.push({
            entityId: change.entityId,
            entityType: change.entityType
          });
          continue;
        }

        if (!change.entity) {
          rejected.push({
            entityId: change.entityId,
            entityType: change.entityType,
            reason: "实体数据为空"
          });
          continue;
        }

        if (stored && change.baseVersionId) {
          if (stored.entity.versionId !== change.baseVersionId) {
            const diffs = this.computeBasicDiffs(change.entity, stored.entity);
            rejected.push({
              entityId: change.entityId,
              entityType: change.entityType,
              reason: "version_conflict",
              conflict: {
                localVersionId: change.baseVersionId,
                remoteVersionId: stored.entity.versionId,
                remoteEditedAt: stored.entity.editedAt,
                remoteEditedBy: stored.entity.editedBy,
                remoteEntity: JSON.parse(JSON.stringify(stored.entity)),
                diffs
              }
            });
            continue;
          }
        }

        const serverEntity: ArchiveEntity = {
          ...JSON.parse(JSON.stringify(change.entity)),
          editedAt: serverTime
        };

        this.storage.set(key, {
          entity: serverEntity,
          lastModified: serverTime
        });

        this.changeLog.push({
          ...change,
          entity: JSON.parse(JSON.stringify(serverEntity)),
          timestamp: serverTime
        });

        accepted.push({
          entityId: change.entityId,
          entityType: change.entityType,
          newVersionId: serverEntity.versionId
        });
      } catch (e) {
        rejected.push({
          entityId: change.entityId,
          entityType: change.entityType,
          reason: (e as Error).message
        });
      }
    }

    return { accepted, rejected, serverTime };
  }

  async getEntity(entityType: EntityType, entityId: string): Promise<ArchiveEntity | null> {
    await this.delay();
    this.maybeFail();
    const key = this.entityKey(entityType, entityId);
    const stored = this.storage.get(key);
    return stored ? JSON.parse(JSON.stringify(stored.entity)) : null;
  }

  async simulateRemoteEdit(
    entityType: EntityType,
    entityId: string,
    edits: Partial<ArchiveEntity>
  ): Promise<void> {
    await this.delay();
    const key = this.entityKey(entityType, entityId);
    const stored = this.storage.get(key);
    const serverTime = this.getServerTime();

    let baseEntity: ArchiveEntity;
    if (stored) {
      baseEntity = JSON.parse(JSON.stringify(stored.entity));
    } else {
      return;
    }

    const newVersionId = generateVersionId();
    const modified: ArchiveEntity = {
      ...baseEntity,
      ...edits,
      version: baseEntity.version + 1,
      versionId: newVersionId,
      parentVersionId: baseEntity.versionId,
      editedAt: serverTime,
      editedBy: (edits as { editedBy?: string }).editedBy || "远程听力师",
      updatedAt: serverTime
    } as ArchiveEntity;

    this.storage.set(key, {
      entity: modified,
      lastModified: serverTime
    });

    this.changeLog.push({
      entityType,
      entityId,
      operation: "update",
      entity: JSON.parse(JSON.stringify(modified)),
      baseVersionId: baseEntity.versionId,
      timestamp: serverTime
    });
  }

  async seedRemoteEntity(entity: ArchiveEntity): Promise<void> {
    const key = this.entityKey(entity.entityType, entity.id);
    const serverTime = this.getServerTime();
    this.storage.set(key, {
      entity: JSON.parse(JSON.stringify(entity)),
      lastModified: serverTime
    });
  }

  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  setLatency(ms: number): void {
    this.latencyMs = Math.max(0, ms);
  }

  clearAll(): void {
    this.storage.clear();
    this.changeLog = [];
  }

  private computeBasicDiffs(local: ArchiveEntity, remote: ArchiveEntity) {
    const diffs: Array<{ field: string; localValue: unknown; remoteValue: unknown }> = [];
    const skipKeys = [
      "version",
      "versionId",
      "parentVersionId",
      "editedAt",
      "editedBy",
      "updatedAt",
      "syncStatus",
      "conflict",
      "createdAt"
    ];

    const compare = (a: unknown, b: unknown, prefix = "") => {
      if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          diffs.push({
            field: prefix || "(root)",
            localValue: a,
            remoteValue: b
          });
        }
        return;
      }
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
      for (const k of keys) {
        if (skipKeys.includes(k)) continue;
        const path = prefix ? `${prefix}.${k}` : k;
        if (JSON.stringify(aObj[k]) !== JSON.stringify(bObj[k])) {
          if (
            typeof aObj[k] === "object" &&
            aObj[k] !== null &&
            !Array.isArray(aObj[k]) &&
            typeof bObj[k] === "object" &&
            bObj[k] !== null &&
            !Array.isArray(bObj[k])
          ) {
            compare(aObj[k], bObj[k], path);
          } else {
            diffs.push({ field: path, localValue: aObj[k], remoteValue: bObj[k] });
          }
        }
      }
    };

    compare(local, remote);
    return diffs;
  }
}

let mockRemoteInstance: MockRemoteAdapter | null = null;

export function getMockRemoteAdapter(): MockRemoteAdapter {
  if (!mockRemoteInstance) {
    mockRemoteInstance = new MockRemoteAdapter();
  }
  return mockRemoteInstance;
}

export { generateId };
