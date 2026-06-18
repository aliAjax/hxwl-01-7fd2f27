import { useState, useMemo, useEffect } from "react";
import { useWorkflow } from "./WorkflowContext";
import { STATUS_LABELS, PRIORITY_LABELS, canTransition, KEY_REVIEW_FIELDS } from "./workflow.types";
import type { WorkflowFittingRecord, RecordStatus, FieldChange, RejectionRecord } from "./workflow.types";

const statusFilterOptions: { key: RecordStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "pending_review", label: "待审核" },
  { key: "review_approved", label: "审核通过" },
  { key: "review_rejected", label: "审核驳回" }
];

const FIELD_LABELS: Record<string, string> = {
  hearingLossType: "听损类型",
  hearingAidModel: "助听器型号",
  gainAdjustment: "增益调整",
  speechRecognitionRate: "言语识别率",
  leftPta: "左耳PTA",
  rightPta: "右耳PTA"
};

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

function formatFieldValue(fieldName: string, value: string | number): string {
  if (fieldName === "speechRecognitionRate") return `${value}%`;
  if (fieldName === "leftPta" || fieldName === "rightPta") return `${value} dB`;
  return String(value || "-");
}

export default function AudiologistView() {
  const {
    state,
    getFilteredRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    submitForReview,
    resubmitForReview,
    selectRecord,
    canPerformAction
  } = useWorkflow();

  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WorkflowFittingRecord | null>(null);
  const [formData, setFormData] = useState<Partial<WorkflowFittingRecord>>({});
  const [activeRejection, setActiveRejection] = useState<RejectionRecord | null>(null);
  const [originalValues, setOriginalValues] = useState<Record<string, string | number>>({});

  const records = useMemo(() => {
    const filtered = getFilteredRecords();
    if (statusFilter === "all") return filtered;
    return filtered.filter(r => r.status === statusFilter);
  }, [getFilteredRecords, statusFilter]);

  const selectedRecord = useMemo(() => {
    return state.records.find(r => r.id === state.selectedRecordId) || null;
  }, [state.records, state.selectedRecordId]);

  const latestRejection = useMemo(() => {
    if (!editingRecord?.rejectionHistory || editingRecord.rejectionHistory.length === 0) return null;
    const rejections = editingRecord.rejectionHistory;
    return rejections[rejections.length - 1];
  }, [editingRecord]);

  const modifiedRejectedFields = useMemo(() => {
    if (!activeRejection) return {} as Record<string, boolean>;
    const result: Record<string, boolean> = {};
    activeRejection.rejectedFields.forEach(rf => {
      const current = formData[rf.fieldName as keyof WorkflowFittingRecord];
      const orig = originalValues[rf.fieldName];
      if (current !== undefined && orig !== undefined) {
        result[rf.fieldName] = String(current).trim() !== String(orig).trim();
      }
    });
    return result;
  }, [activeRejection, formData, originalValues]);

  const allRejectedFieldsModified = useMemo(() => {
    if (!activeRejection) return true;
    return activeRejection.rejectedFields.every(rf => modifiedRejectedFields[rf.fieldName]);
  }, [activeRejection, modifiedRejectedFields]);

  const modifiedCount = useMemo(() => {
    return Object.values(modifiedRejectedFields).filter(Boolean).length;
  }, [modifiedRejectedFields]);

  const handleCreate = () => {
    setFormData({});
    setShowCreateForm(true);
    setEditingRecord(null);
    setActiveRejection(null);
    setOriginalValues({});
  };

  const handleEdit = (record: WorkflowFittingRecord) => {
    if (!canPerformAction("canEditRecord") || record.status !== "draft" && record.status !== "review_rejected") return;
    setEditingRecord(record);
    setFormData({ ...record });
    const orig: Record<string, string | number> = {};
    KEY_REVIEW_FIELDS.forEach(fn => {
      orig[fn] = getRawFieldValue(record, fn);
    });
    setOriginalValues(orig);

    if (record.status === "review_rejected" && record.rejectionHistory && record.rejectionHistory.length > 0) {
      setActiveRejection(record.rejectionHistory[record.rejectionHistory.length - 1]);
    } else {
      setActiveRejection(null);
    }
    setShowCreateForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      const fieldChanges: FieldChange[] = [];
      KEY_REVIEW_FIELDS.forEach(fn => {
        const orig = originalValues[fn];
        const current = formData[fn as keyof WorkflowFittingRecord];
        if (orig !== undefined && current !== undefined && String(orig).trim() !== String(current).trim()) {
          fieldChanges.push({
            fieldName: fn,
            fieldLabel: FIELD_LABELS[fn] || fn,
            oldValue: orig,
            newValue: current as string | number
          });
        }
      });
      updateRecord(editingRecord.id, formData, fieldChanges.length > 0 ? fieldChanges : undefined);
    } else {
      createRecord(formData);
    }
    setShowCreateForm(false);
    setEditingRecord(null);
    setFormData({});
    setActiveRejection(null);
    setOriginalValues({});
  };

  const handleSubmitForReview = (recordId: string) => {
    if (!canPerformAction("canSubmitForReview")) return;
    submitForReview(recordId);
  };

  const handleResubmitForReview = () => {
    if (!editingRecord || !activeRejection) return;
    if (!allRejectedFieldsModified) return;

    const fieldChanges: FieldChange[] = [];
    activeRejection.rejectedFields.forEach(rf => {
      const current = formData[rf.fieldName as keyof WorkflowFittingRecord] as string | number;
      if (String(rf.oldValue).trim() !== String(current).trim()) {
        fieldChanges.push({
          fieldName: rf.fieldName,
          fieldLabel: rf.fieldLabel,
          oldValue: rf.oldValue,
          newValue: current
        });
      }
    });

    if (fieldChanges.length === 0) return;
    resubmitForReview(editingRecord.id, fieldChanges, activeRejection.rejectionId);
    setShowCreateForm(false);
    setEditingRecord(null);
    setFormData({});
    setActiveRejection(null);
    setOriginalValues({});
  };

  const handleDelete = (recordId: string) => {
    if (!canPerformAction("canDeleteRecord")) return;
    if (confirm("确定要删除这条记录吗？")) {
      deleteRecord(recordId);
    }
  };

  const handleRecordClick = (record: WorkflowFittingRecord) => {
    selectRecord(record.id);
  };

  const canEdit = (record: WorkflowFittingRecord) => {
    return canPerformAction("canEditRecord") &&
           (record.status === "draft" || record.status === "review_rejected");
  };

  const canSubmit = (record: WorkflowFittingRecord) => {
    return canPerformAction("canSubmitForReview") &&
           canTransition(record.status, "pending_review", state.currentRole);
  };

  useEffect(() => {
    if (editingRecord && !showCreateForm) {
      setEditingRecord(null);
      setActiveRejection(null);
      setOriginalValues({});
    }
  }, [showCreateForm, editingRecord]);

  return (
    <div className="role-view audiologist-view">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">听力师工作台</p>
            <h2>验配记录管理</h2>
          </div>
          {canPerformAction("canCreateRecord") && (
            <button className="primary-action" onClick={handleCreate}>
              ➕ 新增记录
            </button>
          )}
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
              <div className="empty-icon">📋</div>
              <h3>暂无记录</h3>
              <p>点击"新增记录"创建第一条验配记录</p>
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
                <div className="record-details">
                  <p>{record.hearingLossType} · {record.fittingStage}</p>
                  <p className="record-model">{record.hearingAidModel || "未指定助听器型号"}</p>
                  <p className="record-meta">
                    创建于 {new Date(record.createdAt).toLocaleDateString("zh-CN")}
                  </p>
                  {record.status === "review_rejected" && record.rejectionHistory && record.rejectionHistory.length > 0 && (
                    <div className="rejection-alert">
                      <span className="rejection-alert-icon">⚠️</span>
                      <span className="rejection-alert-text">
                        已被驳回 {record.rejectionHistory.length} 次，请根据整改意见修改后重新提交
                      </span>
                      <button
                        className="rejection-alert-btn"
                        onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
                      >
                        立即整改 ✏️
                      </button>
                    </div>
                  )}
                </div>
                <div className="record-actions">
                  {canEdit(record) && (
                    <button
                      className="record-btn"
                      onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
                    >
                      {record.status === "review_rejected" ? "✏️ 整改" : "✏️ 编辑"}
                    </button>
                  )}
                  {canSubmit(record) && (
                    <button
                      className="record-btn primary"
                      onClick={(e) => { e.stopPropagation(); handleSubmitForReview(record.id); }}
                    >
                      📤 提交审核
                    </button>
                  )}
                  {record.status === "draft" && canPerformAction("canDeleteRecord") && (
                    <button
                      className="record-btn danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                    >
                      🗑️ 删除
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {selectedRecord && !showCreateForm && (
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

          {selectedRecord.status === "review_rejected" && selectedRecord.rejectionHistory && selectedRecord.rejectionHistory.length > 0 && (
            <div className="detail-group full-width current-rejection-section">
              <div className="current-rejection-header">
                <h3>⚠️ 当前整改要求 <span className="hint">（最新驳回）</span></h3>
                <button className="rectify-btn" onClick={() => handleEdit(selectedRecord)}>
                  ✏️ 开始整改
                </button>
              </div>
              {(() => {
                const latest = selectedRecord.rejectionHistory[selectedRecord.rejectionHistory.length - 1];
                return (
                  <div className="current-rejection-content">
                    <div className="current-rejection-meta">
                      由 <strong>{latest.rejectedBy}</strong> 于 {new Date(latest.rejectedAt).toLocaleString("zh-CN")} 驳回
                    </div>
                    <div className="current-rejection-comment">
                      <strong>总体意见：</strong>{latest.overallComment}
                    </div>
                    <div className="current-rejection-fields">
                      <h4>需要整改的字段（{latest.rejectedFields.length} 项）：</h4>
                      {latest.rejectedFields.map(rf => (
                        <div key={rf.fieldName} className="current-rejection-field">
                          <span className="crf-label">📍 {rf.fieldLabel}</span>
                          <span className="crf-old">原值：{formatFieldValue(rf.fieldName, rf.oldValue)}</span>
                          <span className="crf-reason">问题：{rf.rejectReason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {selectedRecord.rejectionHistory && selectedRecord.rejectionHistory.length > 0 && (
            <div className="detail-group full-width rejection-history-section">
              <h3>驳回历史 <span className="hint">（共 {selectedRecord.rejectionHistory.length} 次）</span></h3>
              {selectedRecord.rejectionHistory.map((rh, idx) => (
                <div key={rh.rejectionId} className="rejection-history-item">
                  <div className="rejection-history-header">
                    <span className="rejection-index">第 {idx + 1} 次驳回</span>
                    <span className="rejection-meta">
                      由 {rh.rejectedBy} 于 {new Date(rh.rejectedAt).toLocaleString("zh-CN")}
                    </span>
                    {rh.resubmittedAt && (
                      <span className="resubmit-tag">
                        ✅ {rh.correctedBy} 于 {new Date(rh.resubmittedAt).toLocaleString("zh-CN")} 整改后重新提交
                      </span>
                    )}
                    {!rh.resubmittedAt && idx === selectedRecord.rejectionHistory!.length - 1 && (
                      <span className="pending-correction-tag">⏳ 待整改</span>
                    )}
                  </div>
                  <div className="rejection-overall-comment">
                    <strong>总体意见：</strong>{rh.overallComment}
                  </div>
                  <div className="rejection-fields-list">
                    {rh.rejectedFields.map(rf => (
                      <div key={rf.fieldName} className="rejection-field-row">
                        <span className="rejection-field-label">{rf.fieldLabel}</span>
                        <span className="rejection-field-old">原值：{formatFieldValue(rf.fieldName, rf.oldValue)}</span>
                        <span className="rejection-field-reason">问题：{rf.rejectReason}</span>
                      </div>
                    ))}
                  </div>
                  {rh.correctionFields && rh.correctionFields.length > 0 && (
                    <div className="correction-summary">
                      <strong>✅ 整改修改内容：</strong>
                      {rh.correctionFields.map(cf => `${cf.fieldLabel}: ${formatFieldValue(cf.fieldName, cf.oldValue)} → ${formatFieldValue(cf.fieldName, cf.newValue)}`).join("；")}
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

      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className={`modal-content ${activeRejection ? "correction-modal" : ""}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {activeRejection ? "🔧 整改验配记录" : editingRecord ? "编辑验配记录" : "新增验配记录"}
              </h2>
              <button className="modal-close" onClick={() => setShowCreateForm(false)}>×</button>
            </div>

            {activeRejection && (
              <div className="correction-banner">
                <div className="correction-banner-title">
                  ⚠️ 整改要求（{modifiedCount}/{activeRejection.rejectedFields.length} 项已修改）
                </div>
                <div className="correction-banner-progress">
                  <div
                    className="correction-progress-bar"
                    style={{ width: `${(modifiedCount / activeRejection.rejectedFields.length) * 100}%` }}
                  />
                </div>
                <div className="correction-fields-summary">
                  {activeRejection.rejectedFields.map(rf => {
                    const isModified = modifiedRejectedFields[rf.fieldName];
                    return (
                      <div
                        key={rf.fieldName}
                        className={`correction-field-chip ${isModified ? "done" : "pending"}`}
                      >
                        <span className="cficon">{isModified ? "✅" : "⏳"}</span>
                        <span className="cflabel">{rf.fieldLabel}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="correction-overall-comment">
                  <strong>主管意见：</strong>{activeRejection.overallComment}
                </div>
              </div>
            )}

            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label
                  className={`form-field ${
                    activeRejection?.rejectedFields.some(rf => rf.fieldName === "customerName") ? "needs-correction" : ""
                  }`}
                >
                  <span>客户姓名 *</span>
                  <input
                    type="text"
                    value={formData.customerName || ""}
                    onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="请输入客户姓名"
                    required
                  />
                </label>
                <label className="form-field">
                  <span>联系电话</span>
                  <input
                    type="tel"
                    value={formData.phone || ""}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="请输入联系电话"
                  />
                </label>
                {(() => {
                  const rejField = activeRejection?.rejectedFields.find(rf => rf.fieldName === "hearingLossType");
                  return (
                    <label className={`form-field ${rejField ? "needs-correction" : ""}`}>
                      <span>
                        听损类型 *
                        {rejField && <em className="rej-badge">需整改</em>}
                      </span>
                      <input
                        type="text"
                        value={formData.hearingLossType || ""}
                        onChange={e => setFormData({ ...formData, hearingLossType: e.target.value })}
                        placeholder="如：双耳高频下降"
                        required
                      />
                      {rejField && (
                        <div className="rej-hint">
                          <span className="rej-hint-label">问题：</span>
                          <span className="rej-hint-text">{rejField.rejectReason}</span>
                          {rejField.oldValue !== undefined && rejField.oldValue !== "" && (
                            <span className="rej-hint-old">（原值：{formatFieldValue("hearingLossType", rejField.oldValue)}）</span>
                          )}
                          {modifiedRejectedFields["hearingLossType"] && (
                            <span className="rej-hint-modified">✅ 已修改</span>
                          )}
                        </div>
                      )}
                    </label>
                  );
                })()}
                <label className="form-field">
                  <span>验配阶段</span>
                  <select
                    value={formData.fittingStage || "初配"}
                    onChange={e => setFormData({ ...formData, fittingStage: e.target.value as "初配" | "复调" | "复诊" })}
                  >
                    <option value="初配">初配</option>
                    <option value="复调">复调</option>
                    <option value="复诊">复诊</option>
                  </select>
                </label>
                {(() => {
                  const rejField = activeRejection?.rejectedFields.find(rf => rf.fieldName === "hearingAidModel");
                  return (
                    <label className={`form-field ${rejField ? "needs-correction" : ""}`}>
                      <span>
                        助听器型号
                        {rejField && <em className="rej-badge">需整改</em>}
                      </span>
                      <input
                        type="text"
                        value={formData.hearingAidModel || ""}
                        onChange={e => setFormData({ ...formData, hearingAidModel: e.target.value })}
                        placeholder="如：Phonak Audeo Paradise P90"
                      />
                      {rejField && (
                        <div className="rej-hint">
                          <span className="rej-hint-label">问题：</span>
                          <span className="rej-hint-text">{rejField.rejectReason}</span>
                          {rejField.oldValue !== undefined && rejField.oldValue !== "" && (
                            <span className="rej-hint-old">（原值：{formatFieldValue("hearingAidModel", rejField.oldValue)}）</span>
                          )}
                          {modifiedRejectedFields["hearingAidModel"] && (
                            <span className="rej-hint-modified">✅ 已修改</span>
                          )}
                        </div>
                      )}
                    </label>
                  );
                })()}
                <label className="form-field">
                  <span>优先级</span>
                  <select
                    value={formData.priority || "medium"}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as "high" | "medium" | "low" })}
                  >
                    <option value="high">高优先级</option>
                    <option value="medium">中优先级</option>
                    <option value="low">低优先级</option>
                  </select>
                </label>
                {(() => {
                  const rejField = activeRejection?.rejectedFields.find(rf => rf.fieldName === "speechRecognitionRate");
                  return (
                    <label className={`form-field ${rejField ? "needs-correction" : ""}`}>
                      <span>
                        言语识别率 (%)
                        {rejField && <em className="rej-badge">需整改</em>}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.speechRecognitionRate || 0}
                        onChange={e => setFormData({ ...formData, speechRecognitionRate: Number(e.target.value) })}
                      />
                      {rejField && (
                        <div className="rej-hint">
                          <span className="rej-hint-label">问题：</span>
                          <span className="rej-hint-text">{rejField.rejectReason}</span>
                          {rejField.oldValue !== undefined && (
                            <span className="rej-hint-old">（原值：{formatFieldValue("speechRecognitionRate", rejField.oldValue)}）</span>
                          )}
                          {modifiedRejectedFields["speechRecognitionRate"] && (
                            <span className="rej-hint-modified">✅ 已修改</span>
                          )}
                        </div>
                      )}
                    </label>
                  );
                })()}
                <label className="form-field">
                  <span>复诊天数</span>
                  <input
                    type="number"
                    min="1"
                    value={formData.followUpDays || 7}
                    onChange={e => setFormData({ ...formData, followUpDays: Number(e.target.value) })}
                  />
                </label>
                {(() => {
                  const rejField = activeRejection?.rejectedFields.find(rf => rf.fieldName === "leftPta");
                  return (
                    <label className={`form-field small ${rejField ? "needs-correction" : ""}`}>
                      <span>
                        左耳PTA (dB)
                        {rejField && <em className="rej-badge">需整改</em>}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={formData.leftPta || 0}
                        onChange={e => setFormData({ ...formData, leftPta: Number(e.target.value) })}
                      />
                      {rejField && (
                        <div className="rej-hint compact">
                          <span className="rej-hint-text">{rejField.rejectReason}</span>
                          {modifiedRejectedFields["leftPta"] && <span className="rej-hint-modified">✅</span>}
                        </div>
                      )}
                    </label>
                  );
                })()}
                {(() => {
                  const rejField = activeRejection?.rejectedFields.find(rf => rf.fieldName === "rightPta");
                  return (
                    <label className={`form-field small ${rejField ? "needs-correction" : ""}`}>
                      <span>
                        右耳PTA (dB)
                        {rejField && <em className="rej-badge">需整改</em>}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={formData.rightPta || 0}
                        onChange={e => setFormData({ ...formData, rightPta: Number(e.target.value) })}
                      />
                      {rejField && (
                        <div className="rej-hint compact">
                          <span className="rej-hint-text">{rejField.rejectReason}</span>
                          {modifiedRejectedFields["rightPta"] && <span className="rej-hint-modified">✅</span>}
                        </div>
                      )}
                    </label>
                  );
                })()}
                {(() => {
                  const rejField = activeRejection?.rejectedFields.find(rf => rf.fieldName === "gainAdjustment");
                  return (
                    <label className={`form-field full-width ${rejField ? "needs-correction" : ""}`}>
                      <span>
                        增益调整
                        {rejField && <em className="rej-badge">需整改</em>}
                      </span>
                      <textarea
                        rows={3}
                        value={formData.gainAdjustment || ""}
                        onChange={e => setFormData({ ...formData, gainAdjustment: e.target.value })}
                        placeholder="详细描述增益调整方案..."
                      />
                      {rejField && (
                        <div className="rej-hint">
                          <span className="rej-hint-label">问题：</span>
                          <span className="rej-hint-text">{rejField.rejectReason}</span>
                          {rejField.oldValue !== undefined && rejField.oldValue !== "" && (
                            <span className="rej-hint-old">（原值：{String(rejField.oldValue) || "-"}）</span>
                          )}
                          {modifiedRejectedFields["gainAdjustment"] && (
                            <span className="rej-hint-modified">✅ 已修改</span>
                          )}
                        </div>
                      )}
                    </label>
                  );
                })()}
                <label className="form-field full-width">
                  <span>用户反馈</span>
                  <textarea
                    rows={3}
                    value={formData.userFeedback || ""}
                    onChange={e => setFormData({ ...formData, userFeedback: e.target.value })}
                    placeholder="记录用户佩戴感受和反馈..."
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateForm(false)}>
                  取消
                </button>
                {activeRejection ? (
                  <>
                    <button type="submit" className="btn-secondary">
                      💾 暂存修改
                    </button>
                    <button
                      type="button"
                      className="btn-primary resubmit"
                      onClick={handleResubmitForReview}
                      disabled={!allRejectedFieldsModified}
                    >
                      {allRejectedFieldsModified
                        ? "📤 整改完成，重新提交审核"
                        : `请完成全部整改 (${modifiedCount}/${activeRejection.rejectedFields.length})`}
                    </button>
                  </>
                ) : (
                  <button type="submit" className="btn-primary">
                    {editingRecord ? "保存修改" : "创建记录"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
