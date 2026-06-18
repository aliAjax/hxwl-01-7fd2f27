import { useState, useMemo } from "react";
import { useWorkflow } from "./WorkflowContext";
import { STATUS_LABELS, PRIORITY_LABELS, canTransition, KEY_REVIEW_FIELDS } from "./workflow.types";
import type { WorkflowFittingRecord, RecordStatus, ReviewField, RejectedField } from "./workflow.types";

const statusFilterOptions: { key: RecordStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending_review", label: "待审核" },
  { key: "review_approved", label: "审核通过" },
  { key: "review_rejected", label: "审核驳回" },
  { key: "pending_followup", label: "待跟进" }
];

const FIELD_LABELS: Record<string, string> = {
  hearingLossType: "听损类型",
  hearingAidModel: "助听器型号",
  gainAdjustment: "增益调整",
  speechRecognitionRate: "言语识别率",
  leftPta: "左耳PTA",
  rightPta: "右耳PTA"
};

function getFieldValue(record: WorkflowFittingRecord, fieldName: string): string | number {
  const map: Record<string, string | number> = {
    hearingLossType: record.hearingLossType,
    hearingAidModel: record.hearingAidModel,
    gainAdjustment: record.gainAdjustment,
    speechRecognitionRate: `${record.speechRecognitionRate}%`,
    leftPta: `${record.leftPta} dB`,
    rightPta: `${record.rightPta} dB`
  };
  return map[fieldName] || "-";
}

function getRawFieldValue(record: WorkflowFittingRecord, fieldName: string): string | number {
  const map: Record<string, string | number> = {
    hearingLossType: record.hearingLossType,
    hearingAidModel: record.hearingAidModel,
    gainAdjustment: record.gainAdjustment,
    speechRecognitionRate: record.speechRecognitionRate,
    leftPta: record.leftPta,
    rightPta: record.rightPta
  };
  return map[fieldName] ?? "";
}

export default function SupervisorView() {
  const {
    state,
    getFilteredRecords,
    approveReview,
    rejectReviewWithFields,
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
  const [selectedRejectFields, setSelectedRejectFields] = useState<Record<string, { selected: boolean; reason: string }>>({});

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
    if (action === "reject") {
      const initial: Record<string, { selected: boolean; reason: string }> = {};
      KEY_REVIEW_FIELDS.forEach(fieldName => {
        const reviewField = record.reviewFields.find(f => f.fieldName === fieldName);
        initial[fieldName] = {
          selected: reviewField?.hasAbnormality || false,
          reason: reviewField?.abnormalityNote || ""
        };
      });
      setSelectedRejectFields(initial);
    }
    setShowReviewModal(true);
  };

  const handleRejectFieldToggle = (fieldName: string) => {
    setSelectedRejectFields(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        selected: !prev[fieldName]?.selected
      }
    }));
  };

  const handleRejectFieldReasonChange = (fieldName: string, reason: string) => {
    setSelectedRejectFields(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        reason
      }
    }));
  };

  const canSubmitReject = () => {
    if (!reviewComment.trim()) return false;
    const selectedList = Object.entries(selectedRejectFields).filter(([, v]) => v.selected);
    if (selectedList.length === 0) return false;
    return selectedList.every(([, v]) => v.reason.trim().length > 0);
  };

  const handleReviewSubmit = () => {
    if (!reviewRecord) return;
    if (reviewAction === "approve") {
      approveReview(reviewRecord.id, reviewComment);
    } else {
      if (!canSubmitReject()) return;
      const rejectedFields: RejectedField[] = Object.entries(selectedRejectFields)
        .filter(([, v]) => v.selected)
        .map(([fieldName, v]) => ({
          fieldName,
          fieldLabel: FIELD_LABELS[fieldName] || fieldName,
          oldValue: getRawFieldValue(reviewRecord, fieldName),
          rejectReason: v.reason.trim()
        }));
      rejectReviewWithFields(reviewRecord.id, reviewComment.trim(), rejectedFields);
    }
    setShowReviewModal(false);
    setReviewRecord(null);
    setReviewAction(null);
    setSelectedRejectFields({});
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

  const selectedRejectCount = Object.values(selectedRejectFields).filter(v => v.selected).length;
  const validRejectCount = Object.entries(selectedRejectFields).filter(([, v]) => v.selected && v.reason.trim().length > 0).length;

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

                {record.rejectionHistory && record.rejectionHistory.length > 0 && (
                  <div className="rejection-history-banner">
                    <span className="rejection-icon">🔄</span>
                    <span>
                      已被驳回 {record.rejectionHistory.length} 次，最近一次：{record.rejectionHistory[record.rejectionHistory.length - 1].overallComment.slice(0, 30)}...
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

          {selectedRecord.rejectionHistory && selectedRecord.rejectionHistory.length > 0 && (
            <div className="detail-group full-width rejection-history-section">
              <h3>驳回历史记录 <span className="hint">（共 {selectedRecord.rejectionHistory.length} 次）</span></h3>
              {selectedRecord.rejectionHistory.map((rh, idx) => (
                <div key={rh.rejectionId} className="rejection-history-item">
                  <div className="rejection-history-header">
                    <span className="rejection-index">第 {idx + 1} 次驳回</span>
                    <span className="rejection-meta">
                      由 {rh.rejectedBy} 于 {new Date(rh.rejectedAt).toLocaleString("zh-CN")} 驳回
                    </span>
                    {rh.resubmittedAt && (
                      <span className="resubmit-meta">
                        → {rh.correctedBy} 于 {new Date(rh.resubmittedAt).toLocaleString("zh-CN")} 整改后重新提交
                      </span>
                    )}
                  </div>
                  <div className="rejection-overall-comment">
                    <strong>总体意见：</strong>{rh.overallComment}
                  </div>
                  <div className="rejection-fields-list">
                    {rh.rejectedFields.map(rf => (
                      <div key={rf.fieldName} className="rejection-field-row">
                        <span className="rejection-field-label">{rf.fieldLabel}</span>
                        <span className="rejection-field-old">原值：{String(rf.oldValue) || "-"}</span>
                        <span className="rejection-field-reason">问题：{rf.rejectReason}</span>
                        {rf.correctedValue !== undefined && (
                          <span className="rejection-field-corrected">整改后：{String(rf.correctedValue)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {rh.correctionFields && rh.correctionFields.length > 0 && (
                    <div className="correction-summary">
                      <strong>整改修改：</strong>
                      {rh.correctionFields.map(cf => `${cf.fieldLabel}: ${cf.oldValue} → ${cf.newValue}`).join("；")}
                    </div>
                  )}
                </div>
              ))}
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
          <div className={`modal-content ${reviewAction === "reject" ? "reject-modal" : ""}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {reviewAction === "approve" ? "审核通过" : "审核驳回"} - {reviewRecord.customerName}
              </h2>
              <button className="modal-close" onClick={() => setShowReviewModal(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={(e) => { e.preventDefault(); handleReviewSubmit(); }}>
              {reviewAction === "approve" ? (
                <label className="form-field full-width">
                  <span>审核意见（可选）</span>
                  <textarea
                    rows={4}
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder="请输入审核意见..."
                  />
                </label>
              ) : (
                <>
                  <div className="reject-section-title">
                    <h3>选择异常字段并填写整改说明 <span className="required">*</span></h3>
                    <p className="reject-progress">
                      已选 {selectedRejectCount} 个字段
                      {selectedRejectCount > 0 && `，已填说明 ${validRejectCount}/${selectedRejectCount}`}
                    </p>
                  </div>
                  <div className="reject-fields-list">
                    {KEY_REVIEW_FIELDS.map(fieldName => {
                      const fieldState = selectedRejectFields[fieldName] || { selected: false, reason: "" };
                      const label = FIELD_LABELS[fieldName] || fieldName;
                      return (
                        <div
                          key={fieldName}
                          className={`reject-field-item ${fieldState.selected ? "selected" : ""}`}
                        >
                          <label className="reject-field-checkbox">
                            <input
                              type="checkbox"
                              checked={fieldState.selected}
                              onChange={() => handleRejectFieldToggle(fieldName)}
                            />
                            <span className="reject-field-name">{label}</span>
                          </label>
                          <div className="reject-field-value">
                            当前值：{getFieldValue(reviewRecord, fieldName)}
                          </div>
                          {fieldState.selected && (
                            <textarea
                              className="reject-field-reason"
                              rows={2}
                              value={fieldState.reason}
                              onChange={e => handleRejectFieldReasonChange(fieldName, e.target.value)}
                              placeholder={`请说明"${label}"存在的问题及整改要求...`}
                              required
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <label className="form-field full-width">
                    <span>总体驳回意见 *</span>
                    <textarea
                      rows={3}
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      placeholder="请填写总体驳回意见，说明审核不通过的主要原因..."
                      required
                    />
                  </label>
                  {!canSubmitReject() && (
                    <div className="form-warning">
                      ⚠️ 请至少选择 1 个异常字段，并为每个选中字段填写整改说明，同时填写总体驳回意见
                    </div>
                  )}
                </>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowReviewModal(false)}>
                  取消
                </button>
                <button
                  type="submit"
                  className={`btn-primary ${reviewAction}`}
                  disabled={reviewAction === "reject" && !canSubmitReject()}
                >
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
