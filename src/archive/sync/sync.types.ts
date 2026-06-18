import type {
  ArchiveEntity,
  AudiogramRecord,
  ComparisonRecord,
  ConflictDiff,
  CustomerProfile,
  EntityType,
  FollowUpRecord,
  FittingRecord,
  VersionSnapshot
} from "../archive.types";

export type SyncDirection = "push" | "pull" | "both";

export type SyncOperation = "create" | "update" | "delete";

export type SyncPhase =
  | "idle"
  | "checking"
  | "pulling"
  | "pushing"
  | "resolving"
  | "retrying"
  | "error";

export type SyncEntityStatus = "local" | "synced" | "conflict" | "pending" | "deleted";

export interface SyncState {
  phase: SyncPhase;
  progress: number;
  total: number;
  lastSyncAt: number | null;
  lastError: string | null;
  isOnline: boolean;
  pendingCount: number;
  conflictCount: number;
  retryCount: number;
}

export interface SyncChangeSet {
  entityType: EntityType;
  entityId: string;
  operation: SyncOperation;
  entity: ArchiveEntity | null;
  baseVersionId?: string;
  timestamp: number;
}

export interface SyncPullResponse {
  changes: SyncChangeSet[];
  serverTime: number;
  hasMore: boolean;
  cursor?: string;
}

export interface SyncPushRequest {
  changes: SyncChangeSet[];
  clientTime: number;
}

export interface SyncPushResult {
  accepted: Array<{ entityId: string; entityType: EntityType; newVersionId?: string }>;
  rejected: Array<{ entityId: string; entityType: EntityType; reason: string; conflict?: RemoteConflictInfo }>;
  serverTime: number;
}

export interface RemoteConflictInfo {
  localVersionId: string;
  remoteVersionId: string;
  remoteEditedAt: number;
  remoteEditedBy: string;
  remoteEntity: ArchiveEntity;
  diffs: ConflictDiff[];
}

export interface FieldMergeStrategy {
  field: string;
  strategy: "local" | "remote" | "newer" | "manual";
}

export interface MergeResult {
  merged: ArchiveEntity;
  autoMergedFields: string[];
  manualRequiredFields: ConflictDiff[];
  hasConflict: boolean;
}

export interface RetryItem {
  id: string;
  change: SyncChangeSet;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextRetryAt: number;
  backoffMs: number;
}

export interface RetryQueueStats {
  total: number;
  pending: number;
  failed: number;
}

export interface IncrementalSyncCursor {
  lastPullTime: number;
  lastPushTime: number;
  entityCursors: Partial<Record<EntityType, string>>;
}

export interface SyncEventMap {
  "sync:start": { direction: SyncDirection };
  "sync:progress": { completed: number; total: number; phase: SyncPhase };
  "sync:complete": { direction: SyncDirection; changesProcessed: number };
  "sync:error": { error: string; phase: SyncPhase };
  "conflict:detected": {
    entityType: EntityType;
    entityId: string;
    conflict: RemoteConflictInfo;
  };
  "conflict:resolved": {
    entityType: EntityType;
    entityId: string;
    resolution: "local" | "remote" | "merge";
  };
  "retry:queued": { item: RetryItem };
  "retry:success": { entityId: string };
  "retry:failed": { entityId: string; error: string };
  "entity:synced": { entityType: EntityType; entityId: string };
  "network:change": { isOnline: boolean };
}

export interface IRemoteAdapter {
  isAvailable(): Promise<boolean>;
  pull(since: number, cursor?: string): Promise<SyncPullResponse>;
  push(request: SyncPushRequest): Promise<SyncPushResult>;
  getEntity(entityType: EntityType, entityId: string): Promise<ArchiveEntity | null>;
  simulateRemoteEdit(entityType: EntityType, entityId: string, edits: Partial<ArchiveEntity>): Promise<void>;
}

export interface IConflictResolver {
  detectConflicts(
    localEntity: ArchiveEntity,
    remoteEntity: ArchiveEntity
  ): ConflictDiff[];
  merge(
    localEntity: ArchiveEntity,
    remoteEntity: ArchiveEntity,
    baseEntity?: ArchiveEntity,
    strategies?: FieldMergeStrategy[]
  ): MergeResult;
  applyFieldSelection(
    localEntity: ArchiveEntity,
    remoteEntity: ArchiveEntity,
    selections: Record<string, "local" | "remote">
  ): ArchiveEntity;
}

export interface IRetryQueue {
  enqueue(change: SyncChangeSet, error?: string): Promise<RetryItem>;
  dequeue(): Promise<RetryItem | null>;
  getRetryable(): Promise<RetryItem[]>;
  markSuccess(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  getStats(): Promise<RetryQueueStats>;
  clear(): Promise<void>;
}

export interface ISyncManager {
  start(): void;
  stop(): void;
  sync(direction?: SyncDirection): Promise<void>;
  syncEntity(entityType: EntityType, entityId: string): Promise<void>;
  getState(): SyncState;
  subscribe<K extends keyof SyncEventMap>(
    event: K,
    handler: (payload: SyncEventMap[K]) => void
  ): () => void;
  resolveConflict(
    entityType: EntityType,
    entityId: string,
    resolution: "local" | "remote" | "merge",
    mergedData?: ArchiveEntity
  ): Promise<void>;
  simulateRemoteConflict(
    entityType: EntityType,
    entityId: string,
    edits?: Partial<ArchiveEntity>
  ): Promise<void>;
  getRetryQueueStats(): Promise<RetryQueueStats>;
  processRetryQueue(): Promise<void>;
}

export type SyncableEntity =
  | CustomerProfile
  | AudiogramRecord
  | FittingRecord
  | FollowUpRecord
  | ComparisonRecord;

export interface SyncVersionInfo {
  entityType: EntityType;
  entityId: string;
  versionId: string;
  version: number;
  editedAt: number;
  editedBy: string;
}

export { type VersionSnapshot };
