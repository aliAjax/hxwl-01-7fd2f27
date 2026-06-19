import { useState, useMemo } from "react";
import { useWorkflow } from "./WorkflowContext";
import { STATUS_LABELS, PRIORITY_LABELS, canTransition } from "./workflow.types";
import type { WorkflowFittingRecord, RecordStatus, FollowUpPriority } from "./workflow.types";

type FollowUpFilter = "all" | "today" | "overdue" | "week" | "completed";

const filterOptions: { key: FollowUpFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "overdue", label: "已逾期" },
  { key: "today", label: "今日到期" },
  { key: "week", label: "本周到期" },
  { key: "completed", label: "已完成" }
];

export default function AssistantView() {
  const {
    state,
    getFilteredRecords,
    startFollowUp,
    completeFollowUp,
    selectRecord,
    canPerformAction
  } = useWorkflow();

  const [activeFilter, setActiveFilter] = useState<FollowUpFilter>("all");
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingRecord, setCompletingRecord] = useState<WorkflowFittingRecord | null>(null);
  const [completeNote, setCompleteNote] = useState("");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const records = useMemo(() => {
    const filtered = getFilteredRecords();

    switch (activeFilter) {
      case "overdue":
        return filtered.filter((r) => {
          const nextDate = new Date(r.nextFollowUpDate);
          nextDate.setHours(0, 0, 0, 0);
          return nextDate.getTime() < today.getTime() && r.status !== "completed";
        });
      case "today":
        return filtered.filter((r) => {
          const nextDate = new Date(r.nextFollowUpDate);
          nextDate.setHours(0, 0, 0, 0);
          return nextDate.getTime() === today.getTime();
        });
      case "week":
        return filtered.filter((r) => {
          const nextDate = new Date(r.nextFollowUpDate);
          nextDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil(
            (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          return diffDays > 0 && diffDays <= 7;
        });
      case "completed":
        return filtered.filter((r) => r.status === "completed");
      default:
        return filtered;
    }
  }, [getFilteredRecords, activeFilter]);

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const dateA = new Date(a.nextFollowUpDate).getTime();
      const dateB = new Date(b.nextFollowUpDate).getTime();
      return dateA - dateB;
    });
  }, [records]);

  const selectedRecord = useMemo(() => {
    return state.records.find((r) => r.id === state.selectedRecordId) || null;
  }, [state.records, state.selectedRecordId]);

  const counts = useMemo(() => {
    const all = getFilteredRecords();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return {
      all: all.length,
      overdue: all.filter((r) => {
        const d = new Date(r.nextFollowUpDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() < todayStart.getTime() && r.status !== "completed";
      }).length,
      today: all.filter((r) => {
        const d = new Date(r.nextFollowUpDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === todayStart.getTime();
      }).length,
      week: all.filter((r) => {
        const d = new Date(r.nextFollowUpDate);
        d.setHours(0, 0, 0, 0);
        const diff = Math.ceil((d.getTime() - todayStart.getTime()) / 86400000);
        return diff > 0 && diff <= 7;
      }).length,
      completed: all.filter((r) => r.status === "completed").length
    };
  }, [getFilteredRecords]);

  const getDaysInfo = (record: WorkflowFittingRecord) => {
    const nextDate = new Date(record.nextFollowUpDate);
    nextDate.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((nextDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

    if (record.status === "completed") {
      return { text: "已完成", className: "days-completed" };
    }
    if (diffDays < 0) {
      return { text: `逾期 ${Math.abs(diffDays)} 天`, className: "days-overdue" };
    }
    if (diffDays === 0) {
      return { text: "今日到期", className: "days-today" };
    }
    return { text: `${diffDays} 天后`, className: diffDays <= 3 ? "days-soon" : "days-normal" };
  };

  const handleRecordClick = (record: WorkflowFittingRecord) => {
    selectRecord(record.id);
  };

  const handleStartFollowUp = (recordId: string) => {
    if (!canPerformAction("canStartFollowUp")) return;
    startFollowUp(recordId);
  };

  const openCompleteModal = (record: WorkflowFittingRecord) => {
    setCompletingRecord(record);
    setCompleteNote(record.followUpNote || "");
    setShowCompleteModal(true);
  };

  const handleCompleteSubmit = () => {
    if (!completingRecord || !completeNote.trim()) return;
    completeFollowUp(completingRecord.id, completeNote);
    setShowCompleteModal(false);
    setCompletingRecord(null);
    setCompleteNote("");
  };

  const priorityOrder: Record<FollowUpPriority, number> = { high: 0, medium: 1, low: 2 };

  return (
    <div className="role-view assistant-view">
      <section className="metrics-grid">
        <div className="metric-card danger">
          <span>已逾期</span>
          <strong>{counts.overdue}</strong>
          <i className="status-danger" />
        </div>
        <div className="metric-card warning">
          <span>今日到期</span>
          <strong>{counts.today}</strong>
          <i className="status-watch" />
        </div>
        <div className="metric-card">
          <span>本周到期</span>
          <strong>{counts.week}</strong>
          <i className="status-watch" />
        </div>
        <div className="metric-card success">
          <span>已完成</span>
          <strong>{counts.completed}</strong>
          <i className="status-ok" />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">复诊助理工作台</p>
            <h2>客户跟进列表</h2>
          </div>
        </div>

        <div className="followup-filters">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              className={`filter-chip ${activeFilter === opt.key ? "filter-active" : ""}`}
              onClick={() => setActiveFilter(opt.key)}
            >
              {opt.label}
              <span className="filter-count">{counts[opt.key]}</span>
            </button>
          ))}
        </div>

        <div className="followup-list">
          {sortedRecords.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <h3>暂无记录</h3>
              <p>当前筛选条件下没有需要跟进的客户</p>
            </div>
          ) : (
            sortedRecords.map((record) => {
              const daysInfo = getDaysInfo(record);
              return (
                <article
                  key={record.id}
                  className={`followup-card ${daysInfo.className} priority-${record.priority} ${state.selectedRecordId === record.id ? "followup-active" : ""}`}
                  onClick={() => handleRecordClick(record)}
                >
                  <div className="followup-days">
                    <span className={`days-badge ${daysInfo.className}`}>{daysInfo.text}</span>
                    <span className="followup-date">下次复诊：{record.nextFollowUpDate}</span>
                  </div>

                  <div className="followup-main">
                    <div className="followup-header">
                      <h3>{record.customerName}</h3>
                      <span className="customer-id">{record.customerId}</span>
                      <span className={`priority-tag priority-${record.priority}`}>
                        {PRIORITY_LABELS[record.priority]}
                      </span>
                    </div>
                    <p className="followup-model">{record.hearingAidModel}</p>
                    <p className="followup-notes">
                      {record.followUpNote || "请及时联系客户确认复诊时间"}
                    </p>
                    {record.reviewFields.some((f) => f.hasAbnormality) && (
                      <div className="abnormality-tags">
                        {record.reviewFields
                          .filter((f) => f.hasAbnormality)
                          .map((f) => (
                            <span key={f.fieldName} className="abnormality-tag">
                              ⚠️ {f.fieldLabel}异常
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="followup-tags">
                    <span className={`status-tag status-${record.status}`}>
                      {STATUS_LABELS[record.status]}
                    </span>
                    <span className="stage-tag">{record.fittingStage}</span>
                  </div>

                  <div className="followup-actions">
                    {record.status === "pending_followup" &&
                      canPerformAction("canStartFollowUp") && (
                        <button
                          className="followup-btn primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartFollowUp(record.id);
                          }}
                        >
                          📞 开始跟进
                        </button>
                      )}
                    {record.status === "followup_in_progress" &&
                      canPerformAction("canCompleteFollowUp") && (
                        <button
                          className="followup-btn success"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCompleteModal(record);
                          }}
                        >
                          ✅ 完成跟进
                        </button>
                      )}
                    <button className="followup-btn secondary">📱 发送短信</button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {selectedRecord && (
        <section className="panel record-detail">
          <div className="section-heading">
            <div>
              <p className="eyebrow">客户详情</p>
              <h2>{selectedRecord.customerName}</h2>
            </div>
            <div className="record-version">
              <span className={`status-tag status-${selectedRecord.status}`}>
                {STATUS_LABELS[selectedRecord.status]}
              </span>
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
                  <span className="detail-value strong">{selectedRecord.phone || "-"}</span>
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
              <h3>跟进信息</h3>
              <div className="detail-items">
                <div className="detail-item">
                  <span className="detail-label">下次复诊</span>
                  <span className="detail-value highlight">{selectedRecord.nextFollowUpDate}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">复诊天数</span>
                  <span className="detail-value">{selectedRecord.followUpDays} 天</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">分配给</span>
                  <span className="detail-value">{selectedRecord.followUpAssignedTo || "-"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">优先级</span>
                  <span className={`priority-tag priority-${selectedRecord.priority}`}>
                    {PRIORITY_LABELS[selectedRecord.priority]}
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-group">
              <h3>验配数据</h3>
              <div className="detail-items">
                <div className="detail-item">
                  <span className="detail-label">助听器型号</span>
                  <span className="detail-value strong">
                    {selectedRecord.hearingAidModel || "-"}
                  </span>
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

            {selectedRecord.reviewFields.some((f) => f.hasAbnormality) && (
              <div className="detail-group">
                <h3>异常字段（需关注）</h3>
                <div className="abnormality-list">
                  {selectedRecord.reviewFields
                    .filter((f) => f.hasAbnormality)
                    .map((field) => (
                      <div key={field.fieldName} className="abnormality-item">
                        <span className="abnormality-icon">⚠️</span>
                        <div>
                          <strong>{field.fieldLabel}</strong>
                          <p>{field.abnormalityNote}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="detail-group full-width">
              <h3>增益调整</h3>
              <p className="block-text">{selectedRecord.gainAdjustment || "暂无"}</p>
            </div>

            <div className="detail-group full-width">
              <h3>用户反馈</h3>
              <p className="block-text">{selectedRecord.userFeedback || "暂无"}</p>
            </div>

            {selectedRecord.followUpNote && (
              <div className="detail-group full-width followup-note-section">
                <h3>跟进记录</h3>
                <p className="block-text">{selectedRecord.followUpNote}</p>
              </div>
            )}

            {selectedRecord.reviewComment && (
              <div className="detail-group full-width review-section">
                <h3>审核意见</h3>
                <p className="block-text">{selectedRecord.reviewComment}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {showCompleteModal && completingRecord && (
        <div className="modal-overlay" onClick={() => setShowCompleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>完成跟进 - {completingRecord.customerName}</h2>
              <button className="modal-close" onClick={() => setShowCompleteModal(false)}>
                ×
              </button>
            </div>
            <form
              className="modal-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleCompleteSubmit();
              }}
            >
              <label className="form-field full-width">
                <span>跟进结果 *</span>
                <textarea
                  rows={5}
                  value={completeNote}
                  onChange={(e) => setCompleteNote(e.target.value)}
                  placeholder="请详细记录跟进结果，包括客户反馈、预约情况等..."
                  required
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCompleteModal(false)}
                >
                  取消
                </button>
                <button type="submit" className="btn-primary success">
                  确认完成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
