import { DraftStatus, formatLastSaved } from "./useDraft";

interface DraftIndicatorProps {
  status: DraftStatus;
  lastSavedAt: number | null;
  isSupported: boolean;
  hasDraft: boolean;
  onClear?: () => void;
  onSave?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<
  DraftStatus,
  { icon: string; text: string; className: string }
> = {
  idle: { icon: "✓", text: "已就绪", className: "draft-idle" },
  saving: { icon: "⟳", text: "保存中...", className: "draft-saving" },
  saved: { icon: "✓", text: "已保存", className: "draft-saved" },
  loading: { icon: "⟳", text: "加载中...", className: "draft-loading" },
  error: { icon: "!", text: "保存失败", className: "draft-error" },
  unsupported: {
    icon: "!",
    text: "浏览器不支持本地存储",
    className: "draft-unsupported"
  }
};

export default function DraftIndicator({
  status,
  lastSavedAt,
  isSupported,
  hasDraft,
  onClear,
  onSave,
  className = ""
}: DraftIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const lastSavedText = formatLastSaved(lastSavedAt);

  if (!isSupported) {
    return (
      <div className={`draft-indicator draft-unsupported ${className}`}>
        <span className="draft-icon">⚠</span>
        <div className="draft-info">
          <span className="draft-status draft-status-unsupported">
            您的浏览器不支持本地草稿功能
          </span>
          <span className="draft-hint">
            请使用现代浏览器（Chrome、Firefox、Safari）以启用自动保存
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`draft-indicator ${config.className} ${className}`}>
      <span className="draft-icon">{config.icon}</span>
      <div className="draft-info">
      <span className={`draft-status ${config.className}`}>{config.text}</span>
      {lastSavedAt && (
        <span className="draft-time">{lastSavedText}</span>
      )}
      </div>
      <div className="draft-actions">
        {onSave && status !== "saving" && (
          <button
            className="draft-action-btn"
            onClick={onSave}
            title="立即保存"
          >
            保存
          </button>
        )}
        {onClear && hasDraft && (
          <button
            className="draft-action-btn draft-clear-btn"
            onClick={onClear}
            title="清空草稿"
          >
            清空草稿
          </button>
        )}
      </div>
    </div>
  );
}
