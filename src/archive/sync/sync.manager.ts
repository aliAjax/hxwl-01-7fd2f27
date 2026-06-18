import type {
  ArchiveEntity,
  AudiogramRecord,
  ComparisonRecord,
  EntityType,
  FollowUpRecord,
  FittingRecord
} from "../archive.types";
import { generateVersionId } from "../archive.types";
import {
  ArchiveDatabase,
  ENTITY_STORES,
  getArchiveDB
} from "../archive.storage";
import type {
  IConflictResolver,
  IRemoteAdapter,
  IRetryQueue,
  ISyncManager,
  IncrementalSyncCursor,
  MergeResult,
  RemoteConflictInfo,
  RetryQueueStats,
  SyncChangeSet,
  SyncDirection,
  SyncEventMap,
  SyncPhase,
  SyncState
} from "./sync.types";
import { getMockRemoteAdapter, MockRemoteAdapter } from "./remote.adapter";
import { getConflictResolver } from "./conflict.resolver";
import { getRetryQueue } from "./retry.queue";

const CURSOR_STORAGE_KEY = "sync_cursor";
const SYNC_INTERVAL_MS = 30000;

type EventHandler<T = unknown> = (payload: T) => void;

type DBTxFn = <T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  fn: (s: Record<string, IDBObjectStore>) => Promise<T> | T
) => Promise<T>;

export class SyncManager implements ISyncManager {
  private db: ArchiveDatabase;
  private dbTx: DBTxFn;
  private remote: IRemoteAdapter & { seedRemoteEntity?: (e: ArchiveEntity) => Promise<void> };
  private conflictResolver: IConflictResolver;
  private retryQueue: IRetryQueue;
  private state: SyncState;
  private cursor: IncrementalSyncCursor;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private syncInProgress = false;
  private onlineHandler = () => this.setOnline(true);
  private offlineHandler = () => this.setOnline(false);

  constructor(options?: {
    remoteAdapter?: IRemoteAdapter;
    conflictResolver?: IConflictResolver;
    retryQueue?: IRetryQueue;
    db?: ArchiveDatabase;
  }) {
    this.db = options?.db || getArchiveDB();
    this.dbTx = (this.db as unknown as { tx: DBTxFn }).tx.bind(this.db);
    this.remote = (options?.remoteAdapter as IRemoteAdapter & { seedRemoteEntity?: (e: ArchiveEntity) => Promise<void> }) || getMockRemoteAdapter();
    this.conflictResolver = options?.conflictResolver || getConflictResolver();
    this.retryQueue = options?.retryQueue || getRetryQueue();
    this.cursor = this.loadCursor();
    this.state = {
      phase: "idle",
      progress: 0,
      total: 0,
      lastSyncAt: null,
      lastError: null,
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      pendingCount: 0,
      conflictCount: 0,
      retryCount: 0
    };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onlineHandler);
      window.addEventListener("offline", this.offlineHandler);
    }

    this.refreshCounts();
    this.syncTimer = setInterval(() => {
      if (!this.syncInProgress && this.state.isOnline) {
        this.sync("both").catch((e) => console.warn("Background sync failed:", e));
      }
    }, SYNC_INTERVAL_MS);
  }

  stop(): void {
    this.isRunning = false;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onlineHandler);
      window.removeEventListener("offline", this.offlineHandler);
    }
  }

  async sync(direction: SyncDirection = "both"): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    this.emit("sync:start", { direction });
    this.setPhase("checking");

    try {
      const isAvailable = await this.remote.isAvailable();
      if (!isAvailable) {
        this.setOnline(false);
        throw new Error("远端服务不可用");
      }
      this.setOnline(true);

      let changesProcessed = 0;

      if (direction === "pull" || direction === "both") {
        this.setPhase("pulling");
        changesProcessed += await this.doPull();
      }

      if (direction === "push" || direction === "both") {
        this.setPhase("pushing");
        changesProcessed += await this.doPush();
      }

      this.setPhase("retrying");
      await this.processRetryQueue();

      this.state.lastSyncAt = Date.now();
      this.state.lastError = null;
      this.saveCursor();
      this.emit("sync:complete", { direction, changesProcessed });
      await this.refreshCounts();
    } catch (e) {
      this.state.lastError = (e as Error).message;
      this.emit("sync:error", { error: (e as Error).message, phase: this.state.phase });
    } finally {
      this.setPhase("idle");
      this.syncInProgress = false;
    }
  }

  async syncEntity(entityType: EntityType, entityId: string): Promise<void> {
    if (!this.state.isOnline) {
      const entity = await this.db.getEntityById(entityId);
      if (entity) {
        await this.markPending(entityType, entityId);
      }
      return;
    }

    const entity = await this.db.getEntityById(entityId);
    if (!entity) return;

    const change: SyncChangeSet = {
      entityType,
      entityId,
      operation: entity.deletedAt ? "delete" : entity.version === 1 ? "create" : "update",
      entity: entity.deletedAt ? null : entity,
      baseVersionId: entity.parentVersionId,
      timestamp: entity.updatedAt
    };

    try {
      const result = await this.remote.push({ changes: [change], clientTime: Date.now() });
      if (result.accepted.length > 0) {
        await this.markSynced(entityType, entityId, result.accepted[0].newVersionId);
        this.emit("entity:synced", { entityType, entityId });
      } else if (result.rejected.length > 0 && result.rejected[0].conflict) {
        await this.handlePushConflict(entityType, entityId, entity, result.rejected[0].conflict);
      } else if (result.rejected.length > 0) {
        const item = await this.retryQueue.enqueue(change, result.rejected[0].reason);
        this.emit("retry:queued", { item });
      }
    } catch (e) {
      await this.markPending(entityType, entityId);
      const item = await this.retryQueue.enqueue(change, (e as Error).message);
      this.emit("retry:queued", { item });
    }

    await this.refreshCounts();
  }

  getState(): SyncState {
    return { ...this.state };
  }

  subscribe<K extends keyof SyncEventMap>(
    event: K,
    handler: (payload: SyncEventMap[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler);

    return () => {
      this.listeners.get(event)?.delete(handler as EventHandler);
    };
  }

  async resolveConflict(
    entityType: EntityType,
    entityId: string,
    resolution: "local" | "remote" | "merge",
    mergedData?: ArchiveEntity
  ): Promise<void> {
    const storeName = ENTITY_STORES[entityType];
    if (!storeName) return;

    const now = Date.now();
    const current = await this.db.getEntityById(entityId);
    if (!current) return;

    let finalEntity: ArchiveEntity;

    if (resolution === "local") {
      finalEntity = {
        ...current,
        version: current.version + 1,
        versionId: generateVersionId(),
        parentVersionId: current.versionId,
        editedAt: now,
        editedBy: "当前用户",
        syncStatus: "pending",
        conflict: {
          ...(current.conflict || { hasConflict: false }),
          hasConflict: false,
          resolution: "local",
          resolvedAt: now
        }
      } as ArchiveEntity;
    } else if (resolution === "remote") {
      const remote = await this.remote.getEntity(entityType, entityId);
      if (!remote) throw new Error("无法获取远程版本");
      finalEntity = {
        ...remote,
        version: current.version + 1,
        versionId: generateVersionId(),
        parentVersionId: current.conflict?.remoteVersionId || remote.versionId,
        editedAt: now,
        editedBy: "当前用户",
        syncStatus: "pending",
        conflict: {
          ...(current.conflict || { hasConflict: false }),
          hasConflict: false,
          resolution: "remote",
          resolvedAt: now
        }
      } as ArchiveEntity;
    } else if (resolution === "merge" && mergedData) {
      finalEntity = {
        ...mergedData,
        version: current.version + 1,
        versionId: generateVersionId(),
        parentVersionId: current.versionId,
        editedAt: now,
        editedBy: "当前用户",
        syncStatus: "pending",
        conflict: {
          ...(current.conflict || { hasConflict: false }),
          hasConflict: false,
          resolution: "manual",
          resolvedAt: now
        }
      } as ArchiveEntity;
    } else {
      throw new Error("无效的冲突解决方式");
    }

    await this.dbTx([storeName], "readwrite", (s) => {
      s[storeName].put(finalEntity);
    });

    await this.db.saveSnapshot(
      finalEntity,
      `冲突解决: ${resolution === "local" ? "保留本地" : resolution === "remote" ? "采用远程" : "手动合并"}`
    );

    this.emit("conflict:resolved", { entityType, entityId, resolution });

    await this.syncEntity(entityType, entityId);
    await this.refreshCounts();
  }

  async simulateRemoteConflict(
    entityType: EntityType,
    entityId: string,
    edits?: Partial<ArchiveEntity>
  ): Promise<void> {
    const local = await this.db.getEntityById(entityId);
    if (!local) return;

    if (this.remote.seedRemoteEntity) {
      await this.remote.seedRemoteEntity(local);
    }

    const defaultEdits = this.getDefaultRemoteEdits(entityType, local);
    const mergedEdits = { ...defaultEdits, ...(edits || {}) } as Partial<ArchiveEntity>;

    await this.remote.simulateRemoteEdit(entityType, entityId, mergedEdits);

    const remoteEntity = await this.remote.getEntity(entityType, entityId);
    if (!remoteEntity) return;

    const diffs = this.conflictResolver.detectConflicts(local, remoteEntity);

    const storeName = ENTITY_STORES[entityType];
    if (!storeName) return;

    await this.dbTx([storeName], "readwrite", (s) => {
      const updated: ArchiveEntity = {
        ...local,
        syncStatus: "conflict",
        conflict: {
          hasConflict: true,
          remoteVersionId: remoteEntity.versionId,
          remoteEditedAt: remoteEntity.editedAt,
          remoteEditedBy: remoteEntity.editedBy
        }
      } as ArchiveEntity;
      s[storeName].put(updated);
    });

    await this.db.saveSnapshot(
      {
        ...remoteEntity,
        syncStatus: "conflict",
        conflict: {
          hasConflict: true,
          remoteVersionId: remoteEntity.versionId,
          remoteEditedAt: remoteEntity.editedAt,
          remoteEditedBy: remoteEntity.editedBy
        }
      } as ArchiveEntity,
      "模拟远程端修改冲突"
    );

    this.emit("conflict:detected", {
      entityType,
      entityId,
      conflict: {
        localVersionId: local.versionId,
        remoteVersionId: remoteEntity.versionId,
        remoteEditedAt: remoteEntity.editedAt,
        remoteEditedBy: remoteEntity.editedBy,
        remoteEntity,
        diffs
      }
    });

    await this.refreshCounts();
  }

  async getRetryQueueStats(): Promise<RetryQueueStats> {
    return this.retryQueue.getStats();
  }

  async processRetryQueue(): Promise<void> {
    if (!this.state.isOnline) return;

    const items = await this.retryQueue.getRetryable();
    if (items.length === 0) return;

    for (const item of items) {
      try {
        const result = await this.remote.push({
          changes: [item.change],
          clientTime: Date.now()
        });

        if (result.accepted.length > 0) {
          await this.retryQueue.markSuccess(item.id);
          await this.markSynced(
            item.change.entityType,
            item.change.entityId,
            result.accepted[0].newVersionId
          );
          this.emit("retry:success", { entityId: item.change.entityId });
          this.emit("entity:synced", {
            entityType: item.change.entityType,
            entityId: item.change.entityId
          });
        } else if (result.rejected.length > 0) {
          if (result.rejected[0].conflict) {
            const entity = await this.db.getEntityById(item.change.entityId);
            if (entity) {
              await this.handlePushConflict(
                item.change.entityType,
                item.change.entityId,
                entity,
                result.rejected[0].conflict
              );
            }
            await this.retryQueue.markSuccess(item.id);
          } else {
            await this.retryQueue.markFailed(item.id, result.rejected[0].reason);
            this.emit("retry:failed", {
              entityId: item.change.entityId,
              error: result.rejected[0].reason
            });
          }
        }
      } catch (e) {
        await this.retryQueue.markFailed(item.id, (e as Error).message);
        this.emit("retry:failed", {
          entityId: item.change.entityId,
          error: (e as Error).message
        });
      }
    }
  }

  private async doPull(): Promise<number> {
    const response = await this.remote.pull(this.cursor.lastPullTime);
    const changes = response.changes;
    let processed = 0;

    this.setProgress(0, changes.length);

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      try {
        await this.applyRemoteChange(change);
        processed++;
      } catch (e) {
        console.warn(`Failed to apply change for ${change.entityId}:`, e);
      }
      this.setProgress(i + 1, changes.length);
    }

    this.cursor.lastPullTime = response.serverTime;
    return processed;
  }

  private async doPush(): Promise<number> {
    const pendingChanges = await this.collectPendingChanges();
    let processed = 0;

    this.setProgress(0, pendingChanges.length);

    if (pendingChanges.length === 0) return 0;

    const batchSize = 10;
    for (let i = 0; i < pendingChanges.length; i += batchSize) {
      const batch = pendingChanges.slice(i, i + batchSize);
      try {
        const result = await this.remote.push({
          changes: batch,
          clientTime: Date.now()
        });

        for (const accepted of result.accepted) {
          await this.markSynced(accepted.entityType, accepted.entityId, accepted.newVersionId);
          this.emit("entity:synced", {
            entityType: accepted.entityType,
            entityId: accepted.entityId
          });
          processed++;
        }

        for (const rejected of result.rejected) {
          if (rejected.conflict) {
            const entity = await this.db.getEntityById(rejected.entityId);
            if (entity) {
              await this.handlePushConflict(
                rejected.entityType,
                rejected.entityId,
                entity,
                rejected.conflict
              );
            }
          } else {
            const change = batch.find(
              (c) => c.entityId === rejected.entityId && c.entityType === rejected.entityType
            );
            if (change) {
              const item = await this.retryQueue.enqueue(change, rejected.reason);
              this.emit("retry:queued", { item });
            }
          }
        }
      } catch (e) {
        for (const change of batch) {
          const item = await this.retryQueue.enqueue(change, (e as Error).message);
          this.emit("retry:queued", { item });
        }
      }
      this.setProgress(Math.min(i + batchSize, pendingChanges.length), pendingChanges.length);
    }

    this.cursor.lastPushTime = Date.now();
    return processed;
  }

  private async applyRemoteChange(change: SyncChangeSet): Promise<void> {
    const storeName = ENTITY_STORES[change.entityType];
    if (!storeName) return;

    if (change.operation === "delete") {
      await this.dbTx([storeName], "readwrite", (s) => {
        return new Promise<void>((resolve, reject) => {
          const req = s[storeName].get(change.entityId);
          req.onsuccess = () => {
            const existing = req.result as ArchiveEntity | undefined;
            if (existing) {
              existing.deletedAt = change.timestamp;
              existing.syncStatus = "synced";
              (existing as { lastSyncedAt?: number }).lastSyncedAt = Date.now();
              s[storeName].put(existing);
            }
            resolve();
          };
          req.onerror = () => reject(req.error);
        });
      });
      return;
    }

    if (!change.entity) return;

    await this.dbTx([storeName], "readwrite", (s) => {
      return new Promise<void>((resolve, reject) => {
        const req = s[storeName].get(change.entityId);
        req.onsuccess = () => {
          const local = req.result as ArchiveEntity | undefined;
          if (!local) {
            const newEntity: ArchiveEntity = {
              ...change.entity!,
              syncStatus: "synced",
              lastSyncedAt: Date.now()
            } as ArchiveEntity;
            s[storeName].put(newEntity);
            this.db.saveSnapshot(newEntity, "远程创建").catch(() => {});
            resolve();
            return;
          }

          if (local.syncStatus === "pending" || local.syncStatus === "conflict") {
            const diffs = this.conflictResolver.detectConflicts(local, change.entity!);
            if (diffs.length > 0) {
              const mergeResult = this.conflictResolver.merge(local, change.entity!);
              if (mergeResult.hasConflict) {
                local.syncStatus = "conflict";
                local.conflict = {
                  hasConflict: true,
                  remoteVersionId: change.entity!.versionId,
                  remoteEditedAt: change.entity!.editedAt,
                  remoteEditedBy: change.entity!.editedBy
                };
                s[storeName].put(local);
                this.db.saveSnapshot(change.entity!, "远程变更-冲突").catch(() => {});
                this.emit("conflict:detected", {
                  entityType: change.entityType,
                  entityId: change.entityId,
                  conflict: {
                    localVersionId: local.versionId,
                    remoteVersionId: change.entity!.versionId,
                    remoteEditedAt: change.entity!.editedAt,
                    remoteEditedBy: change.entity!.editedBy,
                    remoteEntity: change.entity!,
                    diffs: mergeResult.manualRequiredFields
                  }
                });
              } else {
                const merged = mergeResult.merged;
                merged.syncStatus = "synced";
                (merged as { lastSyncedAt?: number }).lastSyncedAt = Date.now();
                s[storeName].put(merged);
                this.db.saveSnapshot(merged, "自动合并远程变更").catch(() => {});
              }
            } else {
              (local as { lastSyncedAt?: number }).lastSyncedAt = Date.now();
              s[storeName].put(local);
            }
          } else {
            const updated: ArchiveEntity = {
              ...change.entity!,
              syncStatus: "synced",
              lastSyncedAt: Date.now()
            } as ArchiveEntity;
            s[storeName].put(updated);
            this.db.saveSnapshot(updated, "远程更新").catch(() => {});
          }
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  private async handlePushConflict(
    entityType: EntityType,
    entityId: string,
    localEntity: ArchiveEntity,
    conflictInfo: RemoteConflictInfo
  ): Promise<void> {
    const storeName = ENTITY_STORES[entityType];
    if (!storeName) return;

    const mergeResult: MergeResult = this.conflictResolver.merge(
      localEntity,
      conflictInfo.remoteEntity
    );

    if (mergeResult.hasConflict) {
      await this.dbTx([storeName], "readwrite", (s) => {
        const updated: ArchiveEntity = {
          ...localEntity,
          syncStatus: "conflict",
          conflict: {
            hasConflict: true,
            remoteVersionId: conflictInfo.remoteVersionId,
            remoteEditedAt: conflictInfo.remoteEditedAt,
            remoteEditedBy: conflictInfo.remoteEditedBy
          }
        } as ArchiveEntity;
        s[storeName].put(updated);
      });

      await this.db.saveSnapshot(
        {
          ...conflictInfo.remoteEntity,
          syncStatus: "conflict"
        } as ArchiveEntity,
        "远程端冲突版本"
      );

      this.emit("conflict:detected", {
        entityType,
        entityId,
        conflict: conflictInfo
      });
    } else {
      const merged = mergeResult.merged;
      merged.syncStatus = "pending";
      (merged as { lastSyncedAt?: number }).lastSyncedAt = Date.now();
      await this.dbTx([storeName], "readwrite", (s) => {
        s[storeName].put(merged);
      });
      await this.db.saveSnapshot(merged, "自动合并后待同步");
    }
  }

  private async collectPendingChanges(): Promise<SyncChangeSet[]> {
    const changes: SyncChangeSet[] = [];

    const customers = await this.db.listCustomers();
    for (const c of customers) {
      if (c.syncStatus === "pending") {
        changes.push({
          entityType: "customer",
          entityId: c.id,
          operation: c.deletedAt ? "delete" : c.version === 1 ? "create" : "update",
          entity: c.deletedAt ? null : c,
          baseVersionId: c.parentVersionId,
          timestamp: c.updatedAt
        });
      }
    }

    const audiograms = await this.collectPendingFromStore<AudiogramRecord>("audiograms");
    const fittings = await this.collectPendingFromStore<FittingRecord>("fittings");
    const followups = await this.collectPendingFromStore<FollowUpRecord>("followups");
    const comparisons = await this.collectPendingFromStore<ComparisonRecord>("comparisons");

    for (const list of [audiograms, fittings, followups, comparisons]) {
      for (const entity of list) {
        changes.push({
          entityType: entity.entityType,
          entityId: entity.id,
          operation: entity.deletedAt ? "delete" : entity.version === 1 ? "create" : "update",
          entity: entity.deletedAt ? null : (entity as ArchiveEntity),
          baseVersionId: entity.parentVersionId,
          timestamp: entity.updatedAt
        });
      }
    }

    return changes;
  }

  private async collectPendingFromStore<T extends ArchiveEntity>(storeName: string): Promise<T[]> {
    return this.dbTx(storeName, "readonly", (s) => {
      return new Promise<T[]>((resolve, reject) => {
        const req = s[storeName].getAll();
        req.onsuccess = () => {
          resolve(
            (req.result as T[]).filter(
              (e) => !e.deletedAt && e.syncStatus === "pending"
            )
          );
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  private async markSynced(
    entityType: EntityType,
    entityId: string,
    _newVersionId?: string
  ): Promise<void> {
    const storeName = ENTITY_STORES[entityType];
    if (!storeName) return;

    await this.dbTx([storeName], "readwrite", (s) => {
      return new Promise<void>((resolve, reject) => {
        const req = s[storeName].get(entityId);
        req.onsuccess = () => {
          const entity = req.result as ArchiveEntity | undefined;
          if (entity) {
            entity.syncStatus = "synced";
            (entity as { lastSyncedAt?: number }).lastSyncedAt = Date.now();
            if (entity.conflict) {
              entity.conflict.hasConflict = false;
            }
            s[storeName].put(entity);
          }
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  private async markPending(entityType: EntityType, entityId: string): Promise<void> {
    const storeName = ENTITY_STORES[entityType];
    if (!storeName) return;

    await this.dbTx([storeName], "readwrite", (s) => {
      return new Promise<void>((resolve, reject) => {
        const req = s[storeName].get(entityId);
        req.onsuccess = () => {
          const entity = req.result as ArchiveEntity | undefined;
          if (entity && entity.syncStatus !== "conflict") {
            entity.syncStatus = "pending";
            s[storeName].put(entity);
          }
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  private async refreshCounts(): Promise<void> {
    try {
      const conflicts = await this.db.detectConflicts();
      const retryStats = await this.retryQueue.getStats();
      const pending = await this.collectPendingChanges();

      this.state.conflictCount = conflicts.length;
      this.state.retryCount = retryStats.total;
      this.state.pendingCount = pending.length;
    } catch (e) {
      console.warn("Failed to refresh counts:", e);
    }
  }

  private setPhase(phase: SyncPhase): void {
    this.state.phase = phase;
    this.emit("sync:progress", {
      completed: this.state.progress,
      total: this.state.total,
      phase
    });
  }

  private setProgress(progress: number, total: number): void {
    this.state.progress = progress;
    this.state.total = total;
    this.emit("sync:progress", {
      completed: progress,
      total,
      phase: this.state.phase
    });
  }

  private setOnline(isOnline: boolean): void {
    if (this.state.isOnline !== isOnline) {
      this.state.isOnline = isOnline;
      this.emit("network:change", { isOnline });
    }
  }

  private emit<K extends keyof SyncEventMap>(event: K, payload: SyncEventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        console.warn(`Event handler error for ${event}:`, e);
      }
    });
  }

  private loadCursor(): IncrementalSyncCursor {
    if (typeof window === "undefined") {
      return { lastPullTime: 0, lastPushTime: 0, entityCursors: {} };
    }
    try {
      const raw = window.localStorage.getItem(CURSOR_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to load sync cursor:", e);
    }
    return { lastPullTime: 0, lastPushTime: 0, entityCursors: {} };
  }

  private saveCursor(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(this.cursor));
    } catch (e) {
      console.warn("Failed to save sync cursor:", e);
    }
  }

  private getDefaultRemoteEdits(entityType: EntityType, local: ArchiveEntity): Partial<ArchiveEntity> {
    const now = Date.now() + 5000;
    const base: Partial<ArchiveEntity> = {
      editedAt: now,
      editedBy: "另一位听力师"
    };

    switch (entityType) {
      case "customer": {
        const cust = local as { remark?: string; occupation?: string };
        return {
          ...base,
          remark: cust.remark
            ? cust.remark + "\n[远程修改] 客户复诊日期调整至下周"
            : "[远程修改] 客户复诊日期调整至下周",
          occupation: cust.occupation || "远程端补充职业信息"
        } as Partial<ArchiveEntity>;
      }
      case "audiogram": {
        const aud = local as { remark?: string };
        return {
          ...base,
          remark: aud.remark
            ? aud.remark + "\n[远程] 复测确认阈值"
            : "[远程] 复测确认阈值"
        } as Partial<ArchiveEntity>;
      }
      case "fitting": {
        const fit = local as { remark?: string };
        return {
          ...base,
          remark: fit.remark
            ? fit.remark + "\n[远程] 调整增益参数"
            : "[远程] 调整增益参数"
        } as Partial<ArchiveEntity>;
      }
      case "followup": {
        const fu = local as { result?: string; remark?: string };
        return {
          ...base,
          result: fu.result || "远程端添加复诊结果",
          remark: fu.remark
            ? fu.remark + "\n[远程] 已电话确认下次预约"
            : "[远程] 已电话确认下次预约"
        } as Partial<ArchiveEntity>;
      }
      default:
        return base;
    }
  }
}

let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }
  return syncManagerInstance;
}

export { MockRemoteAdapter };
