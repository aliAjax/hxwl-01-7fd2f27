import { useWorkflow } from "./WorkflowContext";
import { ROLE_LABELS, STATUS_LABELS } from "./workflow.types";
import type { OperationLog as OperationLogType } from "./workflow.types";

interface OperationLogProps {
  recordId?: string;
  limit?: number;
}

const actionTypeIcons: Record<OperationLogType["actionType"], string> = {
  create: "➕",
  update: "✏️",
  submit: "📤",
  approve: "✅",
  reject: "❌",
  assign: "👥",
  followup: "📞",
  complete: "🎉",
  status_change: "🔄"
};

export default function OperationLog({ recordId, limit = 50 }: OperationLogProps) {
  const { getRecordLogs, state } = useWorkflow();

  const logs = recordId ? getRecordLogs(recordId) : state.operationLogs;
  const displayLogs = logs.slice(0, limit);

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    return date.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return (
    <section className="operation-log panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">审计追踪</p>
          <h2>操作日志 {recordId ? `（当前记录）` : `（全部）`}</h2>
        </div>
        <span className="log-count">共 {logs.length} 条</span>
      </div>

      <div className="log-list">
        {displayLogs.length === 0 ? (
          <div className="log-empty">
            <div className="empty-icon">📋</div>
            <p>暂无操作记录</p>
          </div>
        ) : (
          <div className="log-timeline">
            {displayLogs.map((log, index) => (
              <div key={log.id} className="log-item">
                <div className="log-timeline-line">
                  <div className="log-timeline-dot">
                    {actionTypeIcons[log.actionType]}
                  </div>
                  {index < displayLogs.length - 1 && <div className="log-timeline-connector" />}
                </div>
                <div className="log-content">
                  <div className="log-header">
                    <span className="log-action">{log.action}</span>
                    <span className="log-time">{formatTime(log.timestamp)}</span>
                  </div>
                  <div className="log-meta">
                    <span className={`log-role role-${log.operatorRole}`}>
                      {ROLE_LABELS[log.operatorRole]}
                    </span>
                    <span className="log-operator">{log.operatorName}</span>
                    {log.oldStatus && log.newStatus && (
                      <span className="log-status-transition">
                        {STATUS_LABELS[log.oldStatus]} → {STATUS_LABELS[log.newStatus]}
                      </span>
                    )}
                  </div>
                  {log.detail && (
                    <p className="log-detail">{log.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
