import { useEffect, useRef } from "react";
import type { FittingSummaryData, SummaryPreviewConfig } from "./summary.types";
import { DEFAULT_SUMMARY_CONFIG } from "./summary.types";

interface FittingSummaryProps {
  data: FittingSummaryData | null;
  open: boolean;
  onClose: () => void;
  config?: SummaryPreviewConfig;
  onOpenConfig?: () => void;
}

function FittingSummary({
  data,
  open,
  onClose,
  config = DEFAULT_SUMMARY_CONFIG,
  onOpenConfig
}: FittingSummaryProps) {
  const summaryRef = useRef<HTMLDivElement>(null);

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

  const handlePrint = () => {
    window.print();
  };

  const hasKeyMetrics = data && data.keyMetrics && data.keyMetrics.length > 0;
  const hasAdjustments = data && data.adjustments && data.adjustments.length > 0;
  const hasFollowUpAdvice = data && data.followUpAdvice && data.followUpAdvice.trim().length > 0;

  const showKeyMetrics = config.showKeyMetrics && hasKeyMetrics;
  const showAdjustments = config.showAdjustments && hasAdjustments;
  const showFollowUpAdvice = config.showFollowUpAdvice && hasFollowUpAdvice;

  if (!open) return null;

  return (
    <div className="summary-modal-overlay" onClick={onClose}>
      <div
        className={`summary-modal ${open ? "summary-modal-open" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="summary-modal-header no-print">
          <div>
            <p className="summary-modal-eyebrow">验配摘要</p>
            <h2 className="summary-modal-title">
              {data?.customerName || "未命名客户"}
              <span className="summary-modal-cid">{data?.customerId}</span>
            </h2>
          </div>
          <div className="summary-modal-actions">
            {onOpenConfig && (
              <button className="summary-btn summary-btn-config" onClick={onOpenConfig}>
                ⚙️ 内容配置
              </button>
            )}
            <button className="summary-btn summary-btn-print" onClick={handlePrint}>
              🖨️ 打印摘要
            </button>
            <button className="summary-modal-close" onClick={onClose} aria-label="关闭预览">
              ×
            </button>
          </div>
        </div>

        <div className="summary-modal-body">
          {data ? (
            <div className="summary-document" ref={summaryRef}>
              <div className="summary-doc-header">
                <div>
                  <h1 className="summary-doc-title">听力验配摘要报告</h1>
                  {config.showEnglishSubtitle && (
                    <p className="summary-doc-subtitle">Hearing Fitting Summary Report</p>
                  )}
                </div>
                <div className="summary-doc-meta">
                  <p>
                    <span>报告日期：</span>
                    <strong>{data.summaryDate || "-"}</strong>
                  </p>
                  <p>
                    <span>验配师：</span>
                    <strong>{data.audiologist || "-"}</strong>
                  </p>
                </div>
              </div>

              <section className="summary-section">
                <h3 className="summary-section-title">
                  <span className="summary-section-num">01</span>
                  客户编号
                </h3>
                <div className="summary-info-grid">
                  <div className="summary-info-item">
                    <span className="summary-info-label">客户编号</span>
                    <span className="summary-info-value">{data.customerId}</span>
                  </div>
                  <div className="summary-info-item">
                    <span className="summary-info-label">客户姓名</span>
                    <span className="summary-info-value">{data.customerName || "-"}</span>
                  </div>
                </div>
              </section>

              {data.hearingLossDescription && data.hearingLossDescription.trim().length > 0 && (
                <section className="summary-section">
                  <h3 className="summary-section-title">
                    <span className="summary-section-num">02</span>
                    听损描述
                  </h3>
                  <div className="summary-text-block">{data.hearingLossDescription}</div>
                </section>
              )}

              {data.hearingAidModel && data.hearingAidModel.trim().length > 0 && (
                <section className="summary-section">
                  <h3 className="summary-section-title">
                    <span className="summary-section-num">03</span>
                    助听器型号
                  </h3>
                  <div className="summary-text-block summary-highlight">{data.hearingAidModel}</div>
                </section>
              )}

              {showKeyMetrics && (
                <section className="summary-section">
                  <h3 className="summary-section-title">
                    <span className="summary-section-num">04</span>
                    关键指标
                  </h3>
                  <div className="summary-metrics-grid">
                    {data.keyMetrics.map((metric, index) => (
                      <div key={index} className="summary-metric-card">
                        <span className="summary-metric-label">{metric.label}</span>
                        <div className="summary-metric-value-wrap">
                          <strong className="summary-metric-value">{metric.value}</strong>
                          {metric.unit && (
                            <span className="summary-metric-unit">{metric.unit}</span>
                          )}
                        </div>
                        {metric.trend && (
                          <span className={`summary-metric-trend trend-${metric.trend}`}>
                            {metric.trend === "up" && "↑ 改善"}
                            {metric.trend === "down" && "↓ 关注"}
                            {metric.trend === "stable" && "— 稳定"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {showAdjustments && (
                <section className="summary-section">
                  <h3 className="summary-section-title">
                    <span className="summary-section-num">05</span>
                    调整记录
                  </h3>
                  <div className="summary-timeline">
                    {data.adjustments.map((adj, index) => (
                      <div key={index} className="summary-timeline-item">
                        <div className="summary-timeline-marker" />
                        <div className="summary-timeline-content">
                          <div className="summary-timeline-header">
                            <span className="summary-timeline-date">{adj.date}</span>
                            <span className="summary-timeline-stage">{adj.stage}</span>
                          </div>
                          <p className="summary-timeline-desc">{adj.description}</p>
                          {adj.operator && (
                            <p className="summary-timeline-operator">操作人：{adj.operator}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {showFollowUpAdvice && (
                <section className="summary-section">
                  <h3 className="summary-section-title">
                    <span className="summary-section-num">06</span>
                    复诊建议
                  </h3>
                  <div className="summary-advice-block">{data.followUpAdvice}</div>
                </section>
              )}

              <div className="summary-doc-footer">
                <p>— 本报告由听力验配系统自动生成，仅供参考 —</p>
                <p className="summary-footer-meta">
                  打印时间：{new Date().toLocaleString("zh-CN")}
                </p>
              </div>
            </div>
          ) : (
            <div className="summary-empty">
              <div className="summary-empty-icon">📄</div>
              <h3>暂无摘要数据</h3>
              <p>请选择一条客户记录后再查看摘要</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FittingSummary;
