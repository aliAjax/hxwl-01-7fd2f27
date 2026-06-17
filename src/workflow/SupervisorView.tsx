import { useState, useMemo } from "react";
import { useWorkflow } from "./WorkflowContext";
import { STATUS_LABELS, PRIORITY_LABELS, canTransition, KEY_REVIEW_FIELDS } from "./workflow.types";
import type { WorkflowFittingRecord, RecordStatus, ReviewField } from "./workflow.types";

const statusFilterOptions: { key: RecordStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending_review", label: "待审核" },
  { key: "review_approved", label: "审核通过" },
  { key: "review_rejected", label: "审核驳回" },
  { key: "pending_followup", label: "待跟进" }
];

export default function SupervisorView() {
  const {
    state,
    getFilteredRecords,
    approveReview,
    rejectReview,
    assignFollowUp,
    updateReviewField,
    selectRecord,
    canPerformAction
  } = useWorkflow();

  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">("all");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRecord, setReviewRecord] = useState<WorkflowFittingRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [assignDays, setAssignDays] = useState(7);

  const records = useMemo(() => {
    const filtered = getFilteredRecords();
    if (statusFilter === "all") return filtered;
    return filtered.filter(r => r.status === statusFilter);
  }, [getFilteredRecords, statusFilter]);

  const selectedRecord = useMemo(() => {
    return state.records.find(r => r.id === state.selectedRecordId) || null;
  }, [state.records, state.selectedRecordId]);

  const pendingCount = useMemo(() => {
    return state.records.filter(r => r.status === "pending_review").length;
  }, [state.records]);

  const hasAbnormalityCount = useMemo(() => {
    return state.records.filter(r =>
      r.status === "pending_review" &&
      r.reviewFields.some(f => f.hasAbnormality)
    ).length;
  }, [state.records]);

  const handleRecordClick = (record: WorkflowFittingRecord) => {
    selectRecord(record.id);
  };

  const openReviewModal = (record: WorkflowFittingRecord, action: "approve" | "reject") => {
    setReviewRecord(record);
    setReviewAction(action);
    setReviewComment("");
    setShowReviewModal(true);
  };

  const handleReviewSubmit = () => {
    if (!reviewRecord) return;
    if (reviewAction === "approve") {
      approveReview(reviewRecord.id, reviewComment);
    } else {
      rejectReview(reviewRecord.id, reviewComment);
    }
    setShowReviewModal(false);
    setReviewRecord(null);
    setReviewAction(null);
  };

  const handleAssignFollowUp = (record: WorkflowFittingRecord) => {
    if (!canPerformAction("canAssignFollowUp")) return;
    assignFollowUp(record.id, assignDays);
  };

  const handleToggleAbnormality = (recordId: string, field: ReviewField) => {
    if (!canPerformAction("canReview")) return;
    updateReviewField(
      recordId,
      field.fieldName,
      !field.hasAbnormality,
      field.hasAbnormality ? undefined : "请主管关注此字段"
    );
  };

  const getFieldValue = (record: WorkflowFittingRecord, fieldName: string): string | number => {
    const map: Record<string, string | number> = {
      hearingLossType: record.hearingLossType,
      hearingAidModel: record.hearingAidModel,
      gainAdjustment: record.gainAdjustment,
      speechRecognitionRate: `${record.speechRecognitionRate}%`,
      leftPta: `${record.leftPta} dB`,
      rightPta: `${record.rightPta} dB`
    };
    return map[fieldName] || "-";
  };

  return (
    <div className="role-view supervisor-view">
      <section className="metrics-grid">
        <div className="metric-card">
          <span>待审核记录</span>
          <strong>{pendingCount}</strong>
          <i className="status-watch" />
        </div>
        <div className="metric-card">
          <span>含异常字段</span>
          <strong>{hasAbnormalityCount}</strong>
          <i className="status-danger" />
        </div>
        <div className="metric-card">
          <span>本月审核通过</span>
          <strong>{state.records.filter(r => r.status === "review_approved").length}</strong>
          <i className="status-ok" />
        </div>
        <div className="metric-card">
          <span>待分配跟进</span>
          <strong>{state.records.filter(r => r.status === "review_approved").length}</strong>
          <i className="status-watch" />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">主管工作台</p>
            <h2>审核与分配</h2>
          </div>
        </div>

        <div className="record-filters">
          {statusFilterOptions.map(opt => (
            <button
              key={opt.key}
              className={`filter-chip ${statusFilter === opt.key ? "filter-active" : ""}`}
              onClick={() => setStatusFilter(opt.key)}
            >
              {opt.label}
              <span className="filter-count">
                {opt.key === "all"
                  ? records.length
                  : records.filter(r => r.status === opt.key).length}
              </span>
            </button>
          ))}
        </div>

        <div className="record-list">
          {records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <h3>暂无记录</h3>
              <p>当前筛选条件下没有记录</p>
            </div>
          ) : (
            records.map(record => (
              <article
                key={record.id}
                className={`record-card ${state.selectedRecordId === record.id ? "record-card-active" : ""}`}
                onClick={() => handleRecordClick(record)}
              >
                <div className="record-header">
                  <div className="record-customer">
                    <h3>{record.customerName || record.customerId}</h3>
                    <span className="customer-id">{record.customerId}</span>
                  </div>
                  <div className="record-status">
                    <span className={`status-tag status-${record.status}`}>
                      {STATUS_LABELS[record.status]}
                    </span>
                    <span className={`priority-tag priority-${record.priority}`}>
                      {PRIORITY_LABELS[record.priority]}
                    </span>
                  </div>
                </div>

                {record.status === "pending_review" && record.reviewFields.some(f => f.hasAbnormality) && (
                  <div className="abnormality-banner">
                    <span className="abnormality-icon">⚠️</span>
                    <span>
                      包含 {record.reviewFields.filter(f => f.hasAbnormality).length} 个异常字段，需重点关注
                    </span>
                  </div>
                )}

                <div className="record-details">
                  <p>{record.hearingLossType} · {record.fittingStage}</p>
                  <p className="record-model">{record.hearingAidModel}</p>
                  <div className="review-fields-preview">
                    {record.reviewFields.slice(0, 3).map(field => (
                      <span
                        key={field.fieldName}
                        className={`review-field-tag ${field.hasAbnormality ? "abnormal" : ""}`}
                      >
                        {field.fieldLabel}: {getFieldValue(record, field.fieldName)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="record-actions">
                  {record.status === "pending_review" && canPerformAction("canReview") && (
                    <>
                      <button
                        className="record-btn approve"
                        onClick={(e) => { e.stopPropagation(); openReviewModal(record, "approve"); }}
                      >
                        ✅ 通过
                      </button>
                      <button
                        className="record-btn reject"
                        onClick={(e) => { e.stopPropagation(); openReviewModal(record, "reject"); }}
                      >
                        ❌ 驳回
                      </button>
                    </>
                  )}
                  {record.status === "review_approved" && canPerformAction("canAssignFollowUp") && (
                    <div className="assign-group">
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={assignDays}
                        onChange={(e) => setAssignDays(Number(e.target.value))}
                        className="days-input"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="days-label">天</span>
                      <button
                        className="record-btn primary"
                        onClick={(e) => { e.stopPropagation(); handleAssignFollowUp(record); }}
                      >
                        📤 分配跟进
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {selectedRecord && (
        <section className="panel record-detail">
          <div className="section-heading">
            <div>
              <p className="eyebrow">记录详情</p>
              <h2>{selectedRecord.customerName || selectedRecord.customerId}</h2>
            </div>
            <div className="record-version">
              <span>版本 v{selectedRecord.version}</span>
            </div>
          </div>

          {selectedRecord.status === "pending_review" && (
            <div className="detail-group">
              <h3>关键字段审核 <span className="hint">（点击标记异常）</span></h3>
              <div className="review-fields-table">
                {selectedRecord.reviewFields.map(field => (
                  <div
                    key={field.fieldName}
                    className={`review-field-row ${field.hasAbnormality ? "abnormal" : ""}`}
                    onClick={() => handleToggleAbnormality(selectedRecord.id, field)}
                  >
                    <div className="review-field-header">
                      <span className="field-key-badge">关键字段</span>
                      <span className="field-name">{field.fieldLabel}</span>
                      <span className={`field-abnormality-toggle ${field.hasAbnormality ? "active" : ""}`}>
                        {field.hasAbnormality ? "⚠️ 异常" : "✓ 正常"}
                      </span>
                    </div>
                    <div className="review-field-value">
                      {getFieldValue(selectedRecord, field.fieldName)}
                    </div>
                    {field.hasAbnormality && field.abnormalityNote && (
                      <div className="review-field-note">
                        💡 {field.abnormalityNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="detail-grid">
            <div className="detail-group">
              <h3>基本信息</h3>
              <div className="detail-items">
                <div className="detail-item">
                  <span className="detail-label">客户编号</span>
                  <span className="detail-value">{selectedRecord.customerId}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">联系电话</span>
                  <span className="detail-value">{selectedRecord.phone || "-"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">听损类型</span>
                  <span className="detail-value">{selectedRecord.hearingLossType || "-"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">验配阶段</span>
                  <span className="detail-value">{selectedRecord.fittingStage}</span>
                </div>
              </div>
            </div>

            <div className="detail-group">
              <h3>验配数据</h3>
              <div className="detail-items">
                <div className="detail-item">
                  <span className="detail-label">助听器型号</span>
                  <span className="detail-value strong">{selectedRecord.hearingAidModel || "-"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">言语识别率</span>
                  <span className="detail-value">{selectedRecord.speechRecognitionRate}%</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">左耳PTA</span>
                  <span className="detail-value">{selectedRecord.leftPta} dB</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">右耳PTA</span>
                  <span className="detail-value">{selectedRecord.rightPta} dB</span>
                </div>
              </div>
            </div>

            <div className="detail-group full-width">
              <h3>增益调整</h3>
              <p className="block-text">{selectedRecord.gainAdjustment || "暂无"}</p>
            </div>

            <div className="detail-group full-width">
              <h3>用户反馈</h3>
              <p className="block-text">{selectedRecord.userFeedback || "暂无"}</p>
            </div>

            {selectedRecord.reviewComment && (
              <div className="detail-group full-width review-section">
                <h3>审核意见</h3>
                <p className="block-text">{selectedRecord.reviewComment}</p>
                <p className="review-meta">
                  由 {selectedRecord.reviewedBy} 于 {new Date(selectedRecord.reviewedAt!).toLocaleString("zh-CN")} 审核
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {showReviewModal && reviewRecord && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {reviewAction === "approve" ? "审核通过" : "审核驳回"} - {reviewRecord.customerName}
              </h2>
              <button className="modal-close" onClick={() => setShowReviewModal(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={(e) => { e.preventDefault(); handleReviewSubmit(); }}>
              <label className="form-field full-width">
                <span>{reviewAction === "approve" ? "审核意见（可选）" : "驳回原因 *"}</span>
                <textarea
                  rows={4}
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder={reviewAction === "approve" ? "请输入审核意见..." : "请详细说明驳回原因..."}
                  required={reviewAction === "reject"}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowReviewModal(false)}>
                  取消
                </button>
                <button type="submit" className={`btn-primary ${reviewAction}`}>
                  {reviewAction === "approve" ? "确认通过" : "确认驳回"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
