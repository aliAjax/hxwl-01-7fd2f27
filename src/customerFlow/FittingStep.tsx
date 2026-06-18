import { useState, useMemo } from "react";
import { useCustomerFlow } from "./CustomerFlowContext";
import { useWorkflow } from "../workflow/WorkflowContext";
import type { CustomerProfile } from "../archive/archive.types";
import type { WorkflowFittingRecord } from "../workflow/workflow.types";
import { ROLE_LABELS, STATUS_LABELS } from "../workflow/workflow.types";

function StatusBadge({ status }: { status: WorkflowFittingRecord["status"] }) {
  const label = STATUS_LABELS[status] || status;
  return (
    <span className={`fitting-status status-${status}`}>
      {label}
    </span>
  );
}

export function FittingStep({ customerId, profile }: { customerId: string | null; profile: CustomerProfile }) {
  const {
    createFittingFromFlow,
    submitForReviewFromFlow,
    activeWorkflowRecord,
    refreshFlow,
    getCustomerWorkflowRecords,
    syncWorkflowToArchive,
    dataConsistency,
    fixDataConsistency,
    aggregate,
  } = useCustomerFlow();

  const {
    state,
    submitForReview,
    approveReview,
    rejectReview,
    canPerformAction,
  } = useWorkflow();

  const [fittingData, setFittingData] = useState({
    fittingStage: "初配" as "初配" | "复调" | "复诊",
    hearingAidModel: "",
    gainAdjustment: "",
    userFeedback: "",
  });

  const [saving, setSaving] = useState(false);

  const handleCreateFitting = async () => {
    if (!customerId) return;
    setSaving(true);
    try {
      const result = await createFittingFromFlow({
        fittingStage: fittingData.fittingStage,
        hearingAidModel: fittingData.hearingAidModel,
        gainAdjustment: fittingData.gainAdjustment,
        userFeedback: fittingData.userFeedback,
      });

      if (result) {
        setFittingData({
          fittingStage: "初配",
          hearingAidModel: "",
          gainAdjustment: "",
          userFeedback: "",
        });
      }
    } catch (e) {
      alert(`创建验配记录失败: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = () => {
    submitForReviewFromFlow();
  };

  const handleSyncToArchive = async (recordId: string) => {
    try {
      await syncWorkflowToArchive(recordId);
      await refreshFlow();
    } catch (e) {
      alert(`同步失败: ${(e as Error).message}`);
    }
  };

  const workflowRecords = getCustomerWorkflowRecords();

  const canSubmit = canPerformAction("canSubmitForReview");
  const canReview = canPerformAction("canReview");

  const archiveFittings = aggregate?.fittings || [];

  const hasAnyData = fittingData.hearingAidModel || fittingData.gainAdjustment || fittingData.userFeedback;
  const canCreate = customerId && hasAnyData;

  return (
    <div className="fitting-step">
      {!dataConsistency.isConsistent && dataConsistency.issues.length > 0 && (
        <div className="data-consistency-warning">
          <div className="consistency-warning-content">
            <span className="consistency-icon">⚠️</span>
            <div>
              <strong>数据不一致提示</strong>
              <p className="muted">
                工作流记录 {dataConsistency.workflowCount} 条，档案库记录 {dataConsistency.archiveCount} 条
              </p>
              <ul className="consistency-issues">
                {dataConsistency.issues.slice(0, 3).map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
                {dataConsistency.issues.length > 3 && (
                  <li className="muted">...还有 {dataConsistency.issues.length - 3} 个问题</li>
                )}
              </ul>
            </div>
          </div>
          <button className="primary-action" onClick={fixDataConsistency}>
            🔄 一键同步所有数据
          </button>
        </div>
      )}

      <div className="fitting-form-section">
        <div className="section-heading">
          <div>
            <h3>新建验配记录</h3>
            <p className="muted">创建后将自动同步到档案库和工作流</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            <span>验配阶段</span>
            <select
              value={fittingData.fittingStage}
              onChange={(e) => setFittingData((prev) => ({ ...prev, fittingStage: e.target.value as typeof fittingData.fittingStage }))}
            >
              <option value="初配">初配</option>
              <option value="复调">复调</option>
              <option value="复诊">复诊</option>
            </select>
          </label>
          <label>
            <span>助听器型号</span>
            <input
              value={fittingData.hearingAidModel}
              onChange={(e) => setFittingData((prev) => ({ ...prev, hearingAidModel: e.target.value }))}
              placeholder="如：Phonak Audeo Paradise P90"
            />
          </label>
          <label className="span-2">
            <span>增益调整</span>
            <textarea
              rows={3}
              value={fittingData.gainAdjustment}
              onChange={(e) => setFittingData((prev) => ({ ...prev, gainAdjustment: e.target.value }))}
              placeholder="描述增益调整的频段、幅度、压缩比变化等"
            />
          </label>
          <label className="span-2">
            <span>用户反馈</span>
            <textarea
              rows={3}
              value={fittingData.userFeedback}
              onChange={(e) => setFittingData((prev) => ({ ...prev, userFeedback: e.target.value }))}
              placeholder="佩戴后的反馈，如清晰度、舒适度、啸叫情况等"
            />
          </label>
        </div>
        <div className="fitting-step-actions">
          <button
            className="primary-action"
            onClick={handleCreateFitting}
            disabled={saving || !canCreate}
          >
            {saving ? "保存中..." : "💾 创建验配记录（同步到档案+工作流）"}
          </button>
        </div>
      </div>

      {workflowRecords.length > 0 && (
        <div className="fitting-records-section">
          <div className="section-heading">
            <div>
              <h3>该客户的验配流程记录</h3>
              <p className="muted">工作流中的验配记录，可提交审核</p>
            </div>
          </div>
          <div className="fitting-records-list">
            {workflowRecords.map((rec) => {
              const isSynced = archiveFittings.some(
                af => af.id === rec.id || af.id === `fit-${rec.id}`
              );
              return (
                <div key={rec.id} className={`fitting-record-card status-${rec.status}`}>
                  <div className="fitting-record-header">
                    <div>
                      <strong>{rec.fittingStage}</strong>
                      <StatusBadge status={rec.status} />
                      {isSynced ? (
                        <span className="sync-badge sync-ok">✓ 已同步档案</span>
                      ) : (
                        <span className="sync-badge sync-pending">⚠️ 未同步档案</span>
                      )}
                    </div>
                    <div className="fitting-record-meta">
                      <span className="muted">
                        由 {rec.createdBy}（{ROLE_LABELS[state.currentRole]}）创建
                      </span>
                    </div>
                  </div>
                  <div className="fitting-record-body">
                    <p><span className="muted">助听器：</span>{rec.hearingAidModel || "—"}</p>
                    <p><span className="muted">增益调整：</span>{rec.gainAdjustment || "—"}</p>
                    <p><span className="muted">用户反馈：</span>{rec.userFeedback || "—"}</p>
                    {rec.speechRecognitionRate > 0 && (
                      <p><span className="muted">言语识别率：</span>{rec.speechRecognitionRate}%</p>
                    )}
                    {(rec.leftPta > 0 || rec.rightPta > 0) && (
                      <p>
                        <span className="muted">PTA：</span>
                        左耳 {rec.leftPta || "—"} dB · 右耳 {rec.rightPta || "—"} dB
                      </p>
                    )}
                  </div>
                  <div className="fitting-record-actions">
                    {!isSynced && (
                      <button
                        className="ghost-btn"
                        onClick={() => handleSyncToArchive(rec.id)}
                      >
                        📤 同步到档案
                      </button>
                    )}
                    {rec.status === "draft" && canSubmit && (
                      <button className="primary-action" onClick={() => submitForReview(rec.id)}>
                        提交审核
                      </button>
                    )}
                    {rec.status === "pending_review" && canReview && (
                      <>
                        <button className="ghost-btn" onClick={() => rejectReview(rec.id, "需要修改")}>
                          退回
                        </button>
                        <button className="primary-action" onClick={() => approveReview(rec.id)}>
                          通过
                        </button>
                      </>
                    )}
                    {rec.status === "review_rejected" && rec.reviewComment && (
                      <div className="rejection-note">
                        <span>📌 退回原因：</span>
                        {rec.reviewComment}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {archiveFittings.length > 0 && (
        <div className="fitting-archive-section">
          <div className="section-heading">
            <div>
              <h3>档案库中的验配记录</h3>
              <p className="muted">已归档的历史验配记录</p>
            </div>
          </div>
          <div className="fitting-records-list">
            {archiveFittings.map((f) => (
              <div key={f.id} className="fitting-record-card status-archived">
                <div className="fitting-record-header">
                  <strong>{f.stage}</strong>
                  <span className="fitting-status status-archived">已归档</span>
                </div>
                <div className="fitting-record-body">
                  <p><span className="muted">日期：</span>{f.fittingDate}</p>
                  <p><span className="muted">助听器：</span>{f.hearingAid?.left?.model || f.hearingAid?.right?.model || "—"}</p>
                  <p><span className="muted">听力师：</span>{f.fitter || "—"}</p>
                  <p><span className="muted">增益调整：</span>{f.gainAdjustment?.binaural || f.gainAdjustment?.left || "—"}</p>
                  {f.userFeedback && <p><span className="muted">用户反馈：</span>{f.userFeedback}</p>}
                  {f.nextFollowUpDate && <p><span className="muted">下次复诊：</span>{f.nextFollowUpDate}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {workflowRecords.length === 0 && archiveFittings.length === 0 && (
        <div className="flow-empty-state">
          <div className="flow-empty-icon">📝</div>
          <h3>暂无验配记录</h3>
          <p>请在上方填写验配信息并创建记录</p>
        </div>
      )}
    </div>
  );
}
