import { useWorkflow } from "../workflow/WorkflowContext";
import type { RoleType } from "../workflow/workflow.types";
import { ROLE_LABELS } from "../workflow/workflow.types";

export function WorkbenchRoleChips() {
  const { state, switchRole } = useWorkflow();
  const roleMap: { label: string; role: RoleType }[] = [
    { label: "听力师", role: "audiologist" },
    { label: "门店主管", role: "supervisor" },
    { label: "复诊助理", role: "assistant" }
  ];
  return (
    <div className="chips">
      {roleMap.map(({ label, role }) => (
        <button
          key={role}
          className={state.currentRole === role ? "chip-active" : ""}
          onClick={() => switchRole(role)}
          style={{
            cursor: "pointer",
            padding: "6px 14px",
            borderRadius: "999px",
            border: state.currentRole === role ? "2px solid #155e75" : "1px solid #d1d5db",
            background: state.currentRole === role ? "#ecfeff" : "#fff",
            color: state.currentRole === role ? "#155e75" : "#374151",
            fontWeight: state.currentRole === role ? 600 : 400,
            fontSize: "14px"
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
