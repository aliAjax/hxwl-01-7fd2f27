import { useState, useEffect } from "react";
import { useCustomerFlow } from "./CustomerFlowContext";
import { useWorkflow } from "../workflow/WorkflowContext";
import { useArchive } from "../archive/ArchiveContext";
import type { CustomerProfile } from "../archive/archive.types";
import type { WorkflowFittingRecord } from "../workflow/workflow.types";
import { ROLE_LABELS, STATUS_LABELS } from "../workflow/workflow.types";

export function FittingStep({ customerId, profile }: { customerId: string | null; profile: CustomerProfile }) {
  const { createFittingAndWorkflow, activeWorkflowRecords, activeLatestWorkflowRecord, refreshFlow, submitForReviewFromFlow, goToNextStep } = useCustomerFlow();
  const { state, submitForReview, approveReview, rejectReview, canPerformAction } = useWorkflow();
  const { aggregate } = useArchive();

  const [fittingData, setFittingData] = useState({
    fittingStage: "初配" as "初配" | "复调" | "复诊",
    hearingAidModel: "",
    gainAdjustment: "",
    userFeedback: "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeLatestWorkflowRecord && activeLatestWorkflowRecord.status === "draft") {
      setFittingData({
        fittingStage: activeLatestWorkflowRecord.fittingStage as "初配" | "复调" | "复诊",
        hearingAidModel: activeLatestWorkflowRecord.hearingAidModel,
        gainAdjustment: activeLatestWorkflowRecord.gainAdjustment,
        userFeedback: activeLatestWorkflowRecord.userFeedback,
      });
    }
  }, [activeLatestWorkflowRecord]);

  const handleCreateFitting = async () => {
    if (!customerId) return;
    setSaving(true);
    try {
      await createFittingAndWorkflow({
        fittingDate: new Date().toISOString().slice(0, 10),
        stage: fittingData.fittingStage,
        hearingAid: {
          left: { model: fittingData.hearingAidModel },
          right: { model: fittingData.hearingAidModel },
        },
        gainAdjustment: { binaural: fittingData.gainAdjustment },
        userFeedback: fittingData.userFeedback,
        fitter: state.currentUserName,
      });

      await refreshFlow();
    } catch (e) {
      alert(`创建验配记录失败: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = () => {
    if (!activeLatestWorkflowRecord) return;
    submitForReviewFromFlow(activeLatestWorkflowRecord.id);
  };

  const canSubmit = canPerformAction("canSubmitForReview");
  const canReview = canPerformAction("canReview");

  const fittings = aggregate?.fittings || [];

  return (
    <div className="fitting-step">
      <div className="fitting-form-section">
        <h3>
          {activeLatestWorkflowRecord && activeLatestWorkflowRecord.status === "draft"
            ? "编辑验配记录（草稿）"
            : "新建验配记录"}
        </h3>
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
          <button className="primary-action" onClick={handleCreateFitting} disabled={saving || !customerId}>
            {saving ? "保存中..." : "💾 保存验配记录"}
          </button>
          {activeLatestWorkflowRecord && activeLatestWorkflowRecord.status === "draft" && canSubmit && (
            <button className="primary-action" onClick={handleSubmitForReview}>
              ✅ 提交审核
            </button>
          )}
        </div>
      </div>

      {activeWorkflowRecords.length > 0 && (
        <div className="fitting-records-section">
          <h3>该客户的验配流程记录</h3>
          <div className="fitting-records-list">
            {activeWorkflowRecords.map((rec) => (
              <div key={rec.id} className={`fitting-record-card status-${rec.status}`}>
                <div className="fitting-record-header">
                  <strong>{rec.fittingStage}</strong>
                  <span className={`fitting-status status-${rec.status}`}>
                    {STATUS_LABELS[rec.status]}
                  </span>
                </div>
                <div className="fitting-record-body">
                  <p><span className="muted">助听器：</span>{rec.hearingAidModel || "—"}</p>
                  <p><span className="muted">增益调整：</span>{rec.gainAdjustment || "—"}</p>
                  <p><span className="muted">用户反馈：</span>{rec.userFeedback || "—"}</p>
                  <p><span className="muted">左耳PTA：</span>{rec.leftPta || 0} dB</p>
                  <p><span className="muted">右耳PTA：</span>{rec.rightPta || 0} dB</p>
                  <p><span className="muted">言语识别率：</span>{rec.speechRecognitionRate || 0}%</p>
                </div>
                <div className="fitting-record-actions">
                  {rec.status === "draft" && canSubmit && (
                    <button className="primary-action" onClick={() => submitForReview(rec.id)}>
                      提交审核
                    </button>
                  )}
                  {rec.status === "pending_review" && canReview && (
                    <>
                      <button className="ghost-btn" onClick={() => rejectReview(rec.id, "需要修改")}>退回</button>
                      <button className="primary-action" onClick={() => approveReview(rec.id)}>通过</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fittings.length > 0 && (
        <div className="fitting-archive-section">
          <h3>档案库中的验配记录</h3>
          <div className="fitting-records-list">
            {fittings.map((f) => (
              <div key={f.id} className="fitting-record-card status-archived">
                <div className="fitting-record-header">
                  <strong>{f.stage}</strong>
                  <span className="fitting-status status-archived">已归档</span>
                </div>
                <div className="fitting-record-body">
                  <p><span className="muted">日期：</span>{f.fittingDate}</p>
                  <p><span className="muted">助听器：</span>{f.hearingAid?.left?.model || f.hearingAid?.right?.model || "—"}</p>
                  <p><span className="muted">增益调整：</span>{f.gainAdjustment?.binaural || f.gainAdjustment?.left || "—"}</p>
                  {f.userFeedback && <p><span className="muted">用户反馈：</span>{f.userFeedback}</p>}
                  {f.fitter && <p><span className="muted">验配师：</span>{f.fitter}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
