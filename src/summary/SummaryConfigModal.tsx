import { useEffect, useState } from "react";
import type { SummaryPreviewConfig } from "./summary.types";
import { DEFAULT_SUMMARY_CONFIG } from "./summary.types";

interface SummaryConfigModalProps {
  open: boolean;
  initialConfig?: SummaryPreviewConfig;
  onClose: () => void;
  onConfirm: (config: SummaryPreviewConfig) => void;
}

function SummaryConfigModal({
  open,
  initialConfig = DEFAULT_SUMMARY_CONFIG,
  onClose,
  onConfirm,
}: SummaryConfigModalProps) {
  const [config, setConfig] = useState<SummaryPreviewConfig>(initialConfig);

  useEffect(() => {
    if (open) {
      setConfig(initialConfig);
    }
  }, [open, initialConfig]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const toggleOption = (key: keyof SummaryPreviewConfig) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = () => {
    setConfig({
      showKeyMetrics: true,
      showAdjustments: true,
      showFollowUpAdvice: true,
      showEnglishSubtitle: true,
    });
  };

  const handleClearAll = () => {
    setConfig({
      showKeyMetrics: false,
      showAdjustments: false,
      showFollowUpAdvice: false,
      showEnglishSubtitle: false,
    });
  };

  const handleConfirm = () => {
    onConfirm(config);
  };

  const configOptions: {
    key: keyof SummaryPreviewConfig;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      key: "showKeyMetrics",
      label: "关键指标",
      description: "包含PTA、言语识别率、佩戴时长等核心数据指标",
      icon: "📊",
    },
    {
      key: "showAdjustments",
      label: "调整记录",
      description: "包含初配、复调等各阶段的参数调整历史记录",
      icon: "📝",
    },
    {
      key: "showFollowUpAdvice",
      label: "复诊建议",
      description: "包含后续佩戴建议、复诊时间及注意事项",
      icon: "💡",
    },
    {
      key: "showEnglishSubtitle",
      label: "英文副标题",
      description: "显示报告标题下方的英文副标题",
      icon: "🌐",
    },
  ];

  return (
    <div className="summary-config-overlay" onClick={onClose}>
      <div
        className={`summary-config-modal ${open ? "summary-config-modal-open" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="summary-config-header">
          <div>
            <p className="summary-config-eyebrow">摘要内容预览配置</p>
            <h2 className="summary-config-title">选择要包含的内容</h2>
          </div>
          <button
            className="summary-config-close"
            onClick={onClose}
            aria-label="关闭配置"
          >
            ×
          </button>
        </div>

        <div className="summary-config-body">
          <div className="summary-config-quick-actions">
            <button
              className="summary-config-quick-btn"
              onClick={handleSelectAll}
              type="button"
            >
              全选
            </button>
            <button
              className="summary-config-quick-btn"
              onClick={handleClearAll}
              type="button"
            >
              清空
            </button>
          </div>

          <div className="summary-config-options">
            {configOptions.map((option) => (
              <label
                key={option.key}
                className={`summary-config-option ${
                  config[option.key] ? "config-option-active" : ""
                }`}
              >
                <div className="config-option-checkbox">
                  <input
                    type="checkbox"
                    checked={config[option.key]}
                    onChange={() => toggleOption(option.key)}
                  />
                  <span className="config-option-checkmark">
                    {config[option.key] && "✓"}
                  </span>
                </div>
                <div className="config-option-icon">{option.icon}</div>
                <div className="config-option-content">
                  <span className="config-option-label">{option.label}</span>
                  <span className="config-option-description">
                    {option.description}
                  </span>
                </div>
              </label>
            ))}
          </div>

          <div className="summary-config-hint">
            <span className="summary-config-hint-icon">ℹ️</span>
            <p>没有数据的模块将自动隐藏，不会显示空白区块。</p>
          </div>
        </div>

        <div className="summary-config-footer">
          <button
            className="summary-config-btn summary-config-btn-cancel"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="summary-config-btn summary-config-btn-confirm"
            onClick={handleConfirm}
            type="button"
          >
            查看摘要
          </button>
        </div>
      </div>
    </div>
  );
}

export default SummaryConfigModal;
