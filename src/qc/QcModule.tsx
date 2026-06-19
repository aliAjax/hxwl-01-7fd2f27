import { useState, useMemo, useEffect } from "react";
import {
  QcRecord,
  ReviewStatus,
  QcFilter,
  reviewStatusLabelMap,
  qcFilterOptions
} from "./qc.types";
import { useWorkflow } from "../workflow/WorkflowContext";
import { getReviewableRecords, getAuditReasons } from "./qc.utils";

function CompletenessBar({ value }: { value: number }) {
  let colorClass = "qc-complete-high";
  if (value < 60) colorClass = "qc-complete-low";
  else if (value < 85) colorClass = "qc-complete-mid";

  return (
    <div className="qc-completeness-wrap">
      <div className="qc-completeness-bar">
        <div className={`qc-completeness-fill ${colorClass}`} style={{ width: `${value}%` }} />
      </div>
      <span className="qc-completeness-text">{value}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`qc-status-badge qc-status-${status}`}>{reviewStatusLabelMap[status]}</span>
  );
}

function AlertChips({ record }: { record: QcRecord }) {
  const chips: { text: string; type: "incomplete" | "abnormal" | "feedback" }[] = [];
  if (record.fieldCompleteness < 85) {
    chips.push({
      text: `${record.requiredFields.filter((f) => !f.completed).length}项字段缺失`,
      type: "incomplete"
    });
  }
  if (record.hasAbnormalGain) {
    const abnormalCount = record.gainAdjustments.filter((g) => g.isAbnormal).length;
    chips.push({ text: `${abnormalCount}处增益异常`, type: "abnormal" });
  }
  if (record.feedbackMissing) {
    chips.push({ text: "用户反馈缺失", type: "feedback" });
  }
  if (chips.length === 0) return null;
  return (
    <div className="qc-alert-chips">
      {chips.map((chip, i) => (
        <span key={i} className={`qc-alert-chip qc-alert-${chip.type}`}>
          {chip.type === "abnormal" && "⚠️ "}
          {chip.type === "incomplete" && "📋 "}
          {chip.type === "feedback" && "💬 "}
          {chip.text}
        </span>
      ))}
    </div>
  );
}

function GainTable({ record }: { record: QcRecord }) {
  if (record.gainAdjustments.length === 0) {
    return (
      <div className="qc-gain-empty">
        <span>暂无增益调整明细</span>
      </div>
    );
  }
  return (
    <div className="qc-gain-table-wrap">
      <table className="qc-gain-table">
        <thead>
          <tr>
            <th>频率</th>
            <th>基准增益</th>
            <th>调整后增益</th>
            <th>偏差</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {record.gainAdjustments.map((g, i) => (
            <tr key={i} className={g.isAbnormal ? "qc-gain-row-abnormal" : ""}>
              <td className="qc-gain-freq">{g.frequency}</td>
              <td>{g.baseline} dB</td>
              <td>{g.adjusted} dB</td>
              <td
                className={
                  g.isAbnormal
                    ? "qc-dev-abnormal"
                    : g.deviation < 0
                      ? "qc-dev-negative"
                      : "qc-dev-positive"
                }
              >
                {g.deviation > 0 ? `+${g.deviation}` : g.deviation} dB
              </td>
              <td className="qc-gain-reason">{g.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldList({ record }: { record: QcRecord }) {
  return (
    <div className="qc-field-list">
      {record.requiredFields.map((field) => (
        <div
          key={field.key}
          className={`qc-field-row ${field.completed ? "qc-field-done" : "qc-field-miss"}`}
        >
          <div className="qc-field-head">
            <span className={`qc-field-dot ${field.completed ? "qc-dot-ok" : "qc-dot-miss"}`} />
            <span className="qc-field-label">{field.label}</span>
          </div>
          <div className="qc-field-value">
            {field.completed ? field.value : <em className="qc-field-empty">未填写</em>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewModal({
  record,
  mode,
  onClose,
  onConfirm
}: {
  record: QcRecord;
  mode: "approve" | "reject";
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}) {
  const [comment, setComment] = useState("");
  const isApprove = mode === "approve";

  const handleConfirm = () => {
    if (!isApprove && comment.trim().length === 0) return;
    onConfirm(comment.trim().length > 0 ? comment.trim() : undefined);
  };

  return (
    <>
      <div className="qc-modal-overlay" onClick={onClose} />
      <div className="qc-modal">
        <div className="qc-modal-header">
          <h3>{isApprove ? "审核通过确认" : "填写退回原因"}</h3>
          <button className="qc-modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="qc-modal-body">
          <div className="qc-modal-record-info">
            <span className="qc-modal-customer">{record.customerName}</span>
            <span className="qc-modal-cid">{record.customerId}</span>
            <span className="qc-modal-stage">{record.fittingStage}</span>
          </div>

          {isApprove ? (
            <div className="qc-modal-approve-tip">
              <div className="qc-modal-icon">✅</div>
              <p>
                确认将 <strong>{record.customerName}</strong> 的验配记录标记为审核通过？
              </p>
              <p className="qc-modal-sub">通过后该记录将归档为已审核状态。</p>
            </div>
          ) : (
            <div className="qc-modal-reject-tip">
              <div className="qc-modal-icon">↩️</div>
              <p>
                将 <strong>{record.customerName}</strong> 的记录退回给听力师修改
              </p>
              <p className="qc-modal-sub">退回后记录恢复为草稿状态，需填写退回原因。</p>
            </div>
          )}

          <div
            className={`qc-modal-comment-form ${isApprove ? "qc-comment-optional" : "qc-comment-required"}`}
          >
            <label className="qc-comment-label">
              <span>
                {isApprove ? "审核意见（可选）" : "退回原因"}
                {!isApprove && <em className="qc-required">*</em>}
              </span>
              <textarea
                className="qc-comment-textarea"
                placeholder={
                  isApprove
                    ? "可填写本次审核的备注说明，例如：字段完整、增益调整合理、用户反馈充分等"
                    : "请详细描述退回原因，便于听力师修正（例如：增益调整异常、关键字段缺失、反馈内容不完整等）"
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
            </label>
            {!isApprove && (
              <div className="qc-comment-suggest">
                <span className="qc-suggest-label">常用原因：</span>
                <div className="qc-suggest-chips">
                  {getAuditReasons().map((s) => (
                    <button
                      key={s}
                      className="qc-suggest-chip"
                      onClick={() => setComment(s)}
                      type="button"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="qc-modal-footer">
          <button className="qc-btn qc-btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            className={`qc-btn ${isApprove ? "qc-btn-approve" : "qc-btn-reject"}`}
            onClick={handleConfirm}
            disabled={!isApprove && comment.trim().length === 0}
          >
            {isApprove ? "确认通过" : "提交退回"}
          </button>
        </div>
      </div>
    </>
  );
}

function DetailDrawer({
  record,
  open,
  onClose,
  onApprove,
  onReject,
  canReview
}: {
  record: QcRecord | null;
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  canReview: boolean;
}) {
  if (!record) return null;

  const showReviewComment = record.reviewStatus !== "pending" && record.reviewComment;

  return (
    <>
      <div
        className={`qc-drawer-overlay ${open ? "qc-drawer-overlay-visible" : ""}`}
        onClick={onClose}
      />
      <aside className={`qc-drawer ${open ? "qc-drawer-open" : ""}`}>
        <div className="qc-drawer-header">
          <div>
            <p className="eyebrow">质控审核详情</p>
            <h2>
              {record.customerName}
              <span className="qc-drawer-cid">{record.customerId}</span>
            </h2>
            <div className="qc-drawer-status-row">
              <StatusBadge status={record.reviewStatus} />
              {record.reviewedAt && (
                <span className="qc-reviewed-info">
                  {record.reviewedBy} · {record.reviewedAt}
                </span>
              )}
            </div>
          </div>
          <button className="qc-drawer-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="qc-drawer-content">
          {record.rejectReason && (
            <div className="qc-reject-reason-box">
              <div className="qc-reject-reason-title">
                <span>📌</span>
                <strong>退回原因</strong>
              </div>
              <p>{record.rejectReason}</p>
            </div>
          )}

          {record.reviewStatus === "approved" && showReviewComment && (
            <div className="qc-approve-comment-box">
              <div className="qc-approve-comment-title">
                <span>✅</span>
                <strong>审核意见</strong>
              </div>
              <p>{record.reviewComment}</p>
            </div>
          )}

          {!canReview && record.reviewStatus === "pending" && (
            <div className="qc-permission-tip">
              <span>🔒</span>
              <p>
                当前角色无审核权限，请切换为 <strong>门店主管</strong> 后进行审核操作
              </p>
            </div>
          )}

          <AlertChips record={record} />

          <section className="qc-drawer-section">
            <div className="qc-section-title-row">
              <h3>基本信息</h3>
            </div>
            <div className="qc-info-grid">
              <div className="qc-info-item">
                <span className="qc-info-label">听损类型</span>
                <span className="qc-info-value">{record.hearingLossType}</span>
              </div>
              <div className="qc-info-item">
                <span className="qc-info-label">验配阶段</span>
                <span className="qc-info-value">{record.fittingStage}</span>
              </div>
              <div className="qc-info-item">
                <span className="qc-info-label">助听器型号</span>
                <span className="qc-info-value qc-info-strong">{record.hearingAidModel}</span>
              </div>
              <div className="qc-info-item">
                <span className="qc-info-label">听力师</span>
                <span className="qc-info-value">{record.audiologist}</span>
              </div>
              <div className="qc-info-item">
                <span className="qc-info-label">验配日期</span>
                <span className="qc-info-value">{record.fittingDate}</span>
              </div>
              <div className="qc-info-item">
                <span className="qc-info-label">提交时间</span>
                <span className="qc-info-value">{record.submittedDate}</span>
              </div>
            </div>
          </section>

          <section className="qc-drawer-section">
            <div className="qc-section-title-row">
              <h3>字段完整度</h3>
              <CompletenessBar value={record.fieldCompleteness} />
            </div>
            <FieldList record={record} />
          </section>

          <section className="qc-drawer-section">
            <div className="qc-section-title-row">
              <h3>
                增益调整明细
                {record.hasAbnormalGain && (
                  <span className="qc-section-alert">⚠️ 存在异常调整</span>
                )}
              </h3>
            </div>
            <GainTable record={record} />
          </section>

          <section className="qc-drawer-section">
            <div className="qc-section-title-row">
              <h3>
                用户反馈
                {record.feedbackMissing && <span className="qc-section-alert">💬 反馈缺失</span>}
              </h3>
            </div>
            {record.feedbackMissing ? (
              <div className="qc-feedback-missing">
                <div className="qc-feedback-missing-box">
                  <span className="qc-feedback-icon">⚠️</span>
                  <div>
                    <p className="qc-feedback-missing-title">用户反馈未填写</p>
                    <p className="qc-feedback-missing-desc">
                      {record.feedbackMissingReason || "请联系听力师补充回访记录"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="qc-feedback-content">
                <p>{record.userFeedback}</p>
              </div>
            )}
          </section>
        </div>

        {record.reviewStatus === "pending" && (
          <div className={`qc-drawer-footer ${!canReview ? "qc-footer-disabled" : ""}`}>
            <button
              className="qc-btn qc-btn-reject"
              onClick={onReject}
              disabled={!canReview}
              title={!canReview ? "仅门店主管可执行退回操作" : ""}
            >
              ↩️ 退回修改
            </button>
            <button
              className="qc-btn qc-btn-approve"
              onClick={onApprove}
              disabled={!canReview}
              title={!canReview ? "仅门店主管可执行审核通过操作" : ""}
            >
              ✅ 审核通过
            </button>
            {!canReview && (
              <span className="qc-footer-hint">🔒 请切换为「门店主管」角色后执行审核</span>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

interface QcModuleProps {
  customerId?: string;
  customerNo?: string;
}

export default function QcModule({ customerId, customerNo }: QcModuleProps) {
  const { state, approveReview, rejectReview, canPerformAction } = useWorkflow();

  const records = useMemo<QcRecord[]>(() => {
    let reviewable = getReviewableRecords(state.records);
    if (customerId || customerNo) {
      reviewable = reviewable.filter(
        (r) =>
          (customerId && r.customerId === customerId) || (customerNo && r.customerId === customerNo)
      );
    }
    return reviewable;
  }, [state.records, customerId, customerNo]);

  const canReview = canPerformAction("canReview");

  const [activeFilter, setActiveFilter] = useState<QcFilter>("all");
  const [selectedRecord, setSelectedRecord] = useState<QcRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reviewModal, setReviewModal] = useState<{
    record: QcRecord;
    mode: "approve" | "reject";
  } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (toastMsg) {
      const t = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);

  useEffect(() => {
    if (selectedRecord) {
      const updated = records.find((r) => r.id === selectedRecord.id);
      if (updated) {
        setSelectedRecord(updated);
      }
    }
  }, [records, selectedRecord?.id]);

  const counts = useMemo(
    () => ({
      all: records.length,
      pending: records.filter((r) => r.reviewStatus === "pending").length,
      approved: records.filter((r) => r.reviewStatus === "approved").length,
      rejected: records.filter((r) => r.reviewStatus === "rejected").length,
      incomplete: records.filter((r) => r.fieldCompleteness < 85).length,
      abnormal: records.filter((r) => r.hasAbnormalGain).length,
      feedbackMissing: records.filter((r) => r.feedbackMissing).length
    }),
    [records]
  );

  const filteredRecords = useMemo(() => {
    let list = records;
    switch (activeFilter) {
      case "pending":
        list = list.filter((r) => r.reviewStatus === "pending");
        break;
      case "approved":
        list = list.filter((r) => r.reviewStatus === "approved");
        break;
      case "rejected":
        list = list.filter((r) => r.reviewStatus === "rejected");
        break;
      case "incomplete":
        list = list.filter((r) => r.fieldCompleteness < 85);
        break;
      case "abnormal":
        list = list.filter((r) => r.hasAbnormalGain);
        break;
      case "feedbackMissing":
        list = list.filter((r) => r.feedbackMissing);
        break;
      default:
        break;
    }
    return [...list].sort((a, b) => {
      const statusOrder: Record<ReviewStatus, number> = { pending: 0, rejected: 1, approved: 2 };
      if (statusOrder[a.reviewStatus] !== statusOrder[b.reviewStatus]) {
        return statusOrder[a.reviewStatus] - statusOrder[b.reviewStatus];
      }
      return a.submittedDate > b.submittedDate ? -1 : 1;
    });
  }, [records, activeFilter]);

  const pendingCount = counts.pending;
  const alertCount = counts.incomplete + counts.abnormal + counts.feedbackMissing;

  const handleRecordClick = (record: QcRecord) => {
    setSelectedRecord(record);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
  };

  const handleApproveClick = (record: QcRecord) => {
    if (!canReview) {
      setToastMsg("🔒 当前角色无审核权限，请切换为门店主管");
      return;
    }
    setReviewModal({ record, mode: "approve" });
  };

  const handleRejectClick = (record: QcRecord) => {
    if (!canReview) {
      setToastMsg("🔒 当前角色无退回权限，请切换为门店主管");
      return;
    }
    setReviewModal({ record, mode: "reject" });
  };

  const handleReviewConfirm = (reason?: string) => {
    if (!reviewModal) return;
    if (!canReview) {
      setToastMsg("🔒 权限不足，操作已取消");
      setReviewModal(null);
      return;
    }
    const { record, mode } = reviewModal;

    if (mode === "approve") {
      approveReview(record.recordId, reason);
      setToastMsg(`✅ ${record.customerName} 审核通过${reason ? "（已附意见）" : ""}`);
    } else {
      const finalReason = reason || "退回修改";
      rejectReview(record.recordId, finalReason);
      setToastMsg(
        `↩️ ${record.customerName} 已退回：${finalReason.slice(0, 20)}${finalReason.length > 20 ? "..." : ""}`
      );
    }

    setReviewModal(null);
  };

  return (
    <section className="qc-module panel">
      {toastMsg && (
        <div className="qc-toast" role="alert">
          {toastMsg}
        </div>
      )}
      <div className="section-heading">
        <div>
          <p>门店主管工作台</p>
          <h2>记录质控审核</h2>
        </div>
        <div className="qc-header-actions">
          {!canReview && (
            <div className="qc-permission-badge" title="仅门店主管可执行审核操作">
              <span>🔒</span>
              <span>只读模式</span>
            </div>
          )}
          <div className="qc-header-stats">
            <span className="qc-stat-pending">待审核 {pendingCount}</span>
            <span className="qc-stat-alert">风险提示 {alertCount}</span>
          </div>
        </div>
      </div>

      <div className="qc-summary-bar">
        <div className="qc-summary-item qc-summary-pending">
          <span className="qc-summary-count">{counts.pending}</span>
          <span className="qc-summary-label">待审核</span>
        </div>
        <div className="qc-summary-item qc-summary-approved">
          <span className="qc-summary-count">{counts.approved}</span>
          <span className="qc-summary-label">已通过</span>
        </div>
        <div className="qc-summary-item qc-summary-rejected">
          <span className="qc-summary-count">{counts.rejected}</span>
          <span className="qc-summary-label">已退回</span>
        </div>
        <div className="qc-summary-item qc-summary-incomplete">
          <span className="qc-summary-count">{counts.incomplete}</span>
          <span className="qc-summary-label">字段不完整</span>
        </div>
        <div className="qc-summary-item qc-summary-abnormal">
          <span className="qc-summary-count">{counts.abnormal}</span>
          <span className="qc-summary-label">增益异常</span>
        </div>
        <div className="qc-summary-item qc-summary-feedback">
          <span className="qc-summary-count">{counts.feedbackMissing}</span>
          <span className="qc-summary-label">反馈缺失</span>
        </div>
      </div>

      <div className="qc-filters">
        {qcFilterOptions.map((opt) => (
          <button
            key={opt.key}
            className={`qc-filter-chip ${activeFilter === opt.key ? "qc-filter-active" : ""}`}
            onClick={() => setActiveFilter(opt.key)}
          >
            {opt.label}
            <span className="qc-filter-count">{counts[opt.key]}</span>
          </button>
        ))}
      </div>

      <div className="qc-record-list">
        {filteredRecords.length === 0 ? (
          <div className="qc-empty">
            <div className="empty-icon">📋</div>
            <h3>暂无{qcFilterOptions.find((f) => f.key === activeFilter)?.label}的审核记录</h3>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <article
              key={record.id}
              className={`qc-record-card qc-status-card-${record.reviewStatus}`}
              onClick={() => handleRecordClick(record)}
            >
              <div className="qc-card-left">
                <div className="qc-card-index">{record.fittingStage.slice(0, 2)}</div>
              </div>
              <div className="qc-card-main">
                <div className="qc-card-header">
                  <div className="qc-card-title">
                    <h3>{record.customerName}</h3>
                    <span className="qc-card-cid">{record.customerId}</span>
                  </div>
                  <StatusBadge status={record.reviewStatus} />
                </div>
                <div className="qc-card-meta">
                  <span>{record.hearingLossType}</span>
                  <span className="qc-card-sep">·</span>
                  <span>{record.hearingAidModel}</span>
                </div>
                <div className="qc-card-submeta">
                  <span>听力师：{record.audiologist}</span>
                  <span className="qc-card-sep">·</span>
                  <span>提交：{record.submittedDate}</span>
                </div>
                <AlertChips record={record} />
                <div className="qc-card-completeness">
                  <span className="qc-card-complete-label">字段完整度</span>
                  <CompletenessBar value={record.fieldCompleteness} />
                </div>
              </div>
              {record.reviewStatus === "pending" && (
                <div
                  className={`qc-card-actions ${!canReview ? "qc-actions-disabled" : ""}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="qc-card-btn qc-card-btn-reject"
                    onClick={() => handleRejectClick(record)}
                    disabled={!canReview}
                    title={!canReview ? "仅门店主管可执行退回操作" : ""}
                  >
                    {canReview ? "退回" : "🔒 退回"}
                  </button>
                  <button
                    className="qc-card-btn qc-card-btn-approve"
                    onClick={() => handleApproveClick(record)}
                    disabled={!canReview}
                    title={!canReview ? "仅门店主管可执行审核通过操作" : ""}
                  >
                    {canReview ? "通过" : "🔒 通过"}
                  </button>
                </div>
              )}
              {record.reviewStatus !== "pending" && <div className="qc-card-arrow">→</div>}
            </article>
          ))
        )}
      </div>

      <DetailDrawer
        record={selectedRecord}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        onApprove={() => selectedRecord && handleApproveClick(selectedRecord)}
        onReject={() => selectedRecord && handleRejectClick(selectedRecord)}
        canReview={canReview}
      />

      {reviewModal && (
        <ReviewModal
          record={reviewModal.record}
          mode={reviewModal.mode}
          onClose={() => setReviewModal(null)}
          onConfirm={handleReviewConfirm}
        />
      )}
    </section>
  );
}
