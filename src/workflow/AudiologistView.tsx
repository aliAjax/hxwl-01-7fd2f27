import { useState, useMemo } from "react";
import { useWorkflow } from "./WorkflowContext";
import { STATUS_LABELS, PRIORITY_LABELS, canTransition } from "./workflow.types";
import type { WorkflowFittingRecord, RecordStatus } from "./workflow.types";

const statusFilterOptions: { key: RecordStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "pending_review", label: "待审核" },
  { key: "review_approved", label: "审核通过" },
  { key: "review_rejected", label: "审核驳回" }
];

export default function AudiologistView() {
  const {
    state,
    getFilteredRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    submitForReview,
    selectRecord,
    canPerformAction
  } = useWorkflow();

  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WorkflowFittingRecord | null>(null);
  const [formData, setFormData] = useState<Partial<WorkflowFittingRecord>>({});

  const records = useMemo(() => {
    const filtered = getFilteredRecords();
    if (statusFilter === "all") return filtered;
    return filtered.filter(r => r.status === statusFilter);
  }, [getFilteredRecords, statusFilter]);

  const selectedRecord = useMemo(() => {
    return state.records.find(r => r.id === state.selectedRecordId) || null;
  }, [state.records, state.selectedRecordId]);

  const handleCreate = () => {
    setFormData({});
    setShowCreateForm(true);
    setEditingRecord(null);
  };

  const handleEdit = (record: WorkflowFittingRecord) => {
    if (!canPerformAction("canEditRecord") || record.status !== "draft" && record.status !== "review_rejected") return;
    setEditingRecord(record);
    setFormData({ ...record });
    setShowCreateForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      updateRecord(editingRecord.id, formData);
    } else {
      createRecord(formData);
    }
    setShowCreateForm(false);
    setEditingRecord(null);
    setFormData({});
  };

  const handleSubmitForReview = (recordId: string) => {
    if (!canPerformAction("canSubmitForReview")) return;
    submitForReview(recordId);
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
                    {record.reviewComment && (
                      <span className="review-comment"> · 审核意见：{record.reviewComment}</span>
                    )}
                  </p>
                </div>
                <div className="record-actions">
                  {canEdit(record) && (
                    <button
                      className="record-btn"
                      onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
                    >
                      ✏️ 编辑
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
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRecord ? "编辑验配记录" : "新增验配记录"}</h2>
              <button className="modal-close" onClick={() => setShowCreateForm(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="form-field">
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
                <label className="form-field">
                  <span>听损类型 *</span>
                  <input
                    type="text"
                    value={formData.hearingLossType || ""}
                    onChange={e => setFormData({ ...formData, hearingLossType: e.target.value })}
                    placeholder="如：双耳高频下降"
                    required
                  />
                </label>
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
                <label className="form-field">
                  <span>助听器型号</span>
                  <input
                    type="text"
                    value={formData.hearingAidModel || ""}
                    onChange={e => setFormData({ ...formData, hearingAidModel: e.target.value })}
                    placeholder="如：Phonak Audeo Paradise P90"
                  />
                </label>
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
                <label className="form-field">
                  <span>言语识别率 (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.speechRecognitionRate || 0}
                    onChange={e => setFormData({ ...formData, speechRecognitionRate: Number(e.target.value) })}
                  />
                </label>
                <label className="form-field">
                  <span>复诊天数</span>
                  <input
                    type="number"
                    min="1"
                    value={formData.followUpDays || 7}
                    onChange={e => setFormData({ ...formData, followUpDays: Number(e.target.value) })}
                  />
                </label>
                <label className="form-field small">
                  <span>左耳PTA (dB)</span>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={formData.leftPta || 0}
                    onChange={e => setFormData({ ...formData, leftPta: Number(e.target.value) })}
                  />
                </label>
                <label className="form-field small">
                  <span>右耳PTA (dB)</span>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={formData.rightPta || 0}
                    onChange={e => setFormData({ ...formData, rightPta: Number(e.target.value) })}
                  />
                </label>
                <label className="form-field full-width">
                  <span>增益调整</span>
                  <textarea
                    rows={3}
                    value={formData.gainAdjustment || ""}
                    onChange={e => setFormData({ ...formData, gainAdjustment: e.target.value })}
                    placeholder="详细描述增益调整方案..."
                  />
                </label>
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
                <button type="submit" className="btn-primary">
                  {editingRecord ? "保存修改" : "创建记录"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
