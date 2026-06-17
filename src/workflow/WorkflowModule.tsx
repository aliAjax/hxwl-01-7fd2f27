import { useState } from "react";
import { WorkflowProvider, useWorkflow } from "./WorkflowContext";
import RoleSwitcher from "./RoleSwitcher";
import OperationLog from "./OperationLog";
import AudiologistView from "./AudiologistView";
import SupervisorView from "./SupervisorView";
import AssistantView from "./AssistantView";
import { ROLE_LABELS, STATUS_LABELS } from "./workflow.types";

function WorkflowContent() {
  const { state } = useWorkflow();
  const [showLogs, setShowLogs] = useState(false);

  const renderRoleView = () => {
    switch (state.currentRole) {
      case "audiologist":
        return <AudiologistView />;
      case "supervisor":
        return <SupervisorView />;
      case "assistant":
        return <AssistantView />;
      default:
        return <AudiologistView />;
    }
  };

  const getStatusCounts = () => {
    const counts: Record<string, number> = {};
    state.records.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="workflow-module">
      <section className="hero workflow-hero">
        <div>
          <p className="eyebrow">多角色协同工作流</p>
          <h1>听力验配工作流管理</h1>
          <p className="subtitle">
            听力师创建记录 → 主管审核关键字段 → 复诊助理跟进客户，全流程可视化管理
          </p>
        </div>
        <div className="workflow-status-summary">
          <div className="status-summary-item">
            <span className="status-count">{state.records.length}</span>
            <span className="status-label">总记录数</span>
          </div>
          <div className="status-summary-item">
            <span className="status-count draft">{statusCounts.draft || 0}</span>
            <span className="status-label">草稿</span>
          </div>
          <div className="status-summary-item">
            <span className="status-count pending">{statusCounts.pending_review || 0}</span>
            <span className="status-label">待审核</span>
          </div>
          <div className="status-summary-item">
            <span className="status-count approved">{statusCounts.review_approved || 0}</span>
            <span className="status-label">已通过</span>
          </div>
          <div className="status-summary-item">
            <span className="status-count followup">{statusCounts.pending_followup || 0} + {statusCounts.followup_in_progress || 0}</span>
            <span className="status-label">跟进中</span>
          </div>
          <div className="status-summary-item">
            <span className="status-count completed">{statusCounts.completed || 0}</span>
            <span className="status-label">已完成</span>
          </div>
        </div>
      </section>

      <section className="workflow-flow-diagram panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">工作流程</p>
            <h2>状态流转图</h2>
          </div>
          <button
            className={`toggle-logs-btn ${showLogs ? "active" : ""}`}
            onClick={() => setShowLogs(!showLogs)}
          >
            📋 {showLogs ? "隐藏日志" : "查看操作日志"}
          </button>
        </div>
        <div className="flow-steps">
          <div className="flow-step">
            <div className="flow-step-icon">👨‍⚕️</div>
            <div className="flow-step-content">
              <h3>听力师</h3>
              <p>创建验配记录</p>
              <div className="flow-statuses">
                <span className="flow-status draft">草稿</span>
                <span className="flow-arrow">→</span>
                <span className="flow-status pending">待审核</span>
              </div>
            </div>
          </div>
          <div className="flow-connector">→</div>
          <div className="flow-step">
            <div className="flow-step-icon">👔</div>
            <div className="flow-step-content">
              <h3>门店主管</h3>
              <p>审核关键字段和异常</p>
              <div className="flow-statuses">
                <span className="flow-status approved">审核通过</span>
                <span className="flow-status rejected">审核驳回</span>
              </div>
            </div>
          </div>
          <div className="flow-connector">→</div>
          <div className="flow-step">
            <div className="flow-step-icon">📞</div>
            <div className="flow-step-content">
              <h3>复诊助理</h3>
              <p>根据复诊天数跟进</p>
              <div className="flow-statuses">
                <span className="flow-status followup">待跟进</span>
                <span className="flow-arrow">→</span>
                <span className="flow-status in-progress">跟进中</span>
                <span className="flow-arrow">→</span>
                <span className="flow-status completed">已完成</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <RoleSwitcher />

      {showLogs && (
        <OperationLog limit={30} />
      )}

      {state.selectedRecordId && showLogs && (
        <OperationLog recordId={state.selectedRecordId} limit={20} />
      )}

      {renderRoleView()}
    </div>
  );
}

function WorkflowModule() {
  return (
    <WorkflowProvider>
      <WorkflowContent />
    </WorkflowProvider>
  );
}

export { WorkflowModule };
export default WorkflowModule;

export { WorkflowProvider, useWorkflow } from "./WorkflowContext";
export type {
  WorkflowFittingRecord,
  OperationLog,
  RoleType,
  RecordStatus,
  FollowUpPriority,
  ReviewField,
  WorkflowState,
  PermissionConfig
} from "./workflow.types";
export {
  ROLE_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  ROLE_PERMISSIONS,
  canTransition
} from "./workflow.types";
