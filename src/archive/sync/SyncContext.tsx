import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode
} from "react";
import type {
  ArchiveEntity,
  EntityType
} from "../archive.types";
import { getSyncManager } from "./sync.manager";
import type { SyncManager } from "./sync.manager";
import type {
  RetryQueueStats,
  SyncDirection,
  SyncState
} from "./sync.types";

interface SyncContextValue {
  syncManager: SyncManager;
  syncState: SyncState;
  retryStats: RetryQueueStats | null;
  sync: (direction?: SyncDirection) => Promise<void>;
  syncEntity: (entityType: EntityType, entityId: string) => Promise<void>;
  resolveConflict: (
    entityType: EntityType,
    entityId: string,
    resolution: "local" | "remote" | "merge",
    mergedData?: ArchiveEntity
  ) => Promise<void>;
  simulateRemoteConflict: (
    entityType: EntityType,
    entityId: string,
    edits?: Partial<ArchiveEntity>
  ) => Promise<void>;
  processRetryQueue: () => Promise<void>;
  startSync: () => void;
  stopSync: () => void;
  isSyncing: boolean;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const syncManager = useMemo(() => getSyncManager(), []);
  const [syncState, setSyncState] = useState<SyncState>(syncManager.getState());
  const [retryStats, setRetryStats] = useState<RetryQueueStats | null>(null);

  const refreshState = useCallback(() => {
    setSyncState(syncManager.getState());
    syncManager.getRetryQueueStats().then(setRetryStats);
  }, [syncManager]);

  useEffect(() => {
    refreshState();

    const unsubs = [
      syncManager.subscribe("sync:start", () => refreshState()),
      syncManager.subscribe("sync:progress", () => refreshState()),
      syncManager.subscribe("sync:complete", () => refreshState()),
      syncManager.subscribe("sync:error", () => refreshState()),
      syncManager.subscribe("conflict:detected", () => refreshState()),
      syncManager.subscribe("conflict:resolved", () => refreshState()),
      syncManager.subscribe("retry:queued", () => refreshState()),
      syncManager.subscribe("retry:success", () => refreshState()),
      syncManager.subscribe("retry:failed", () => refreshState()),
      syncManager.subscribe("entity:synced", () => refreshState()),
      syncManager.subscribe("network:change", () => refreshState())
    ];

    syncManager.start();

    return () => {
      syncManager.stop();
      unsubs.forEach((u) => u());
    };
  }, [syncManager, refreshState]);

  const sync = useCallback(
    async (direction?: SyncDirection) => {
      await syncManager.sync(direction);
      refreshState();
    },
    [syncManager, refreshState]
  );

  const syncEntity = useCallback(
    async (entityType: EntityType, entityId: string) => {
      await syncManager.syncEntity(entityType, entityId);
      refreshState();
    },
    [syncManager, refreshState]
  );

  const resolveConflict = useCallback(
    async (
      entityType: EntityType,
      entityId: string,
      resolution: "local" | "remote" | "merge",
      mergedData?: ArchiveEntity
    ) => {
      await syncManager.resolveConflict(entityType, entityId, resolution, mergedData);
      refreshState();
    },
    [syncManager, refreshState]
  );

  const simulateRemoteConflict = useCallback(
    async (entityType: EntityType, entityId: string, edits?: Partial<ArchiveEntity>) => {
      await syncManager.simulateRemoteConflict(entityType, entityId, edits);
      refreshState();
    },
    [syncManager, refreshState]
  );

  const processRetryQueue = useCallback(async () => {
    await syncManager.processRetryQueue();
    refreshState();
  }, [syncManager, refreshState]);

  const startSync = useCallback(() => {
    syncManager.start();
    refreshState();
  }, [syncManager, refreshState]);

  const stopSync = useCallback(() => {
    syncManager.stop();
    refreshState();
  }, [syncManager, refreshState]);

  const isSyncing = useMemo(
    () => !["idle", "error"].includes(syncState.phase),
    [syncState.phase]
  );

  const value: SyncContextValue = {
    syncManager,
    syncState,
    retryStats,
    sync,
    syncEntity,
    resolveConflict,
    simulateRemoteConflict,
    processRetryQueue,
    startSync,
    stopSync,
    isSyncing
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}
