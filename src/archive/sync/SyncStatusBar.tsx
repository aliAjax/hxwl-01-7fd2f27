import { useSync } from "./SyncContext";

function formatTime(t: number | null): string {
  if (!t) return "从未";
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    idle: "空闲",
    checking: "检查中...",
    pulling: "拉取数据...",
    pushing: "推送数据...",
    pushing_versions: "推送版本快照...",
    resolving: "解决冲突...",
    retrying: "重试中...",
    error: "错误"
  };
  return map[phase] || phase;
}

export default function SyncStatusBar() {
  const { syncState, retryStats, sync, isSyncing, processRetryQueue } = useSync();

  const progress =
    syncState.total > 0 ? Math.round((syncState.progress / syncState.total) * 100) : 0;

  return (
    <div className="sync-status-bar">
      <div className="sync-status-left">
        <div
          className={`sync-indicator ${syncState.isOnline ? "online" : "offline"}`}
          title={syncState.isOnline ? "已连接" : "离线"}
        />
        <span className="sync-status-text">
          {syncState.isOnline ? "☁ 在线" : "📴 离线"}
          {isSyncing && <span className="sync-phase"> · {phaseLabel(syncState.phase)}</span>}
        </span>
      </div>

      {isSyncing && syncState.total > 0 && (
        <div className="sync-progress">
          <div className="sync-progress-bar" style={{ width: `${progress}%` }} />
          <span className="sync-progress-text">
            {syncState.progress}/{syncState.total}
          </span>
        </div>
      )}

      <div className="sync-status-right">
        {syncState.pendingCount > 0 && (
          <span className="sync-badge pending" title="待同步数量">
            ⏳ {syncState.pendingCount}
          </span>
        )}
        {syncState.pendingVersionCount > 0 && (
          <span className="sync-badge version" title="待同步版本快照">
            📋 {syncState.pendingVersionCount}
          </span>
        )}
        {syncState.conflictCount > 0 && (
          <span className="sync-badge conflict" title="冲突数量">
            ⚡ {syncState.conflictCount}
          </span>
        )}
        {retryStats && retryStats.total > 0 && (
          <span
            className="sync-badge retry"
            title="重试队列数量"
            onClick={processRetryQueue}
            style={{ cursor: "pointer" }}
          >
            🔄 {retryStats.total}
          </span>
        )}
        <span className="sync-last-sync" title="上次同步时间">
          ⟳ {formatTime(syncState.lastSyncAt)}
        </span>
        <button
          className="ghost-btn tiny sync-btn"
          onClick={() => sync("both")}
          disabled={isSyncing}
          title="立即同步"
        >
          {isSyncing ? "同步中..." : "同步"}
        </button>
      </div>

      {syncState.lastError && (
        <div className="sync-error-tooltip" title={syncState.lastError}>
          ⚠ {syncState.lastError}
        </div>
      )}
    </div>
  );
}
