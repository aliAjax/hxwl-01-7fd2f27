import { useWorkflow } from "./WorkflowContext";
import type { RoleType } from "./workflow.types";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_PERMISSIONS } from "./workflow.types";

const roleIcons: Record<RoleType, string> = {
  audiologist: "👨‍⚕️",
  supervisor: "👔",
  assistant: "📞"
};

export default function RoleSwitcher() {
  const { state, switchRole } = useWorkflow();
  const roles: RoleType[] = ["audiologist", "supervisor", "assistant"];

  return (
    <section className="role-switcher panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">角色管理</p>
          <h2>当前角色：{roleIcons[state.currentRole]} {ROLE_LABELS[state.currentRole]}</h2>
        </div>
        <div className="role-user-badge">
          <span className="user-avatar">👤</span>
          <span className="user-name">{state.currentUserName}</span>
        </div>
      </div>

      <div className="role-cards">
        {roles.map(role => (
          <button
            key={role}
            className={`role-card ${state.currentRole === role ? "role-card-active" : ""}`}
            onClick={() => switchRole(role)}
          >
            <div className="role-card-header">
              <span className="role-icon">{roleIcons[role]}</span>
              <span className="role-name">{ROLE_LABELS[role]}</span>
            </div>
            <p className="role-desc">{ROLE_DESCRIPTIONS[role]}</p>
            <div className="role-permissions">
              <span className="perm-title">权限：</span>
              <div className="perm-tags">
                {Object.entries(ROLE_PERMISSIONS[role])
                  .filter(([, value]) => value === true)
                  .slice(0, 4)
                  .map(([key]) => (
                    <span key={key} className="perm-tag">
                      {formatPermission(key)}
                    </span>
                  ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="role-info-panel">
        <div className="info-item">
          <span className="info-label">可见状态</span>
          <div className="info-tags">
            {ROLE_PERMISSIONS[state.currentRole].visibleStatuses.map(status => (
              <span key={status} className={`status-tag status-${status}`}>
                {formatStatus(status)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatPermission(key: string): string {
  const map: Record<string, string> = {
    canCreateRecord: "创建记录",
    canEditRecord: "编辑记录",
    canDeleteRecord: "删除记录",
    canSubmitForReview: "提交审核",
    canReview: "审核记录",
    canAssignFollowUp: "分配跟进",
    canStartFollowUp: "开始跟进",
    canCompleteFollowUp: "完成跟进",
    canViewAllRecords: "查看全部",
    canViewOperationLogs: "查看日志"
  };
  return map[key] || key;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    draft: "草稿",
    pending_review: "待审核",
    review_approved: "审核通过",
    review_rejected: "审核驳回",
    pending_followup: "待跟进",
    followup_in_progress: "跟进中",
    completed: "已完成",
    cancelled: "已取消"
  };
  return map[status] || status;
}
