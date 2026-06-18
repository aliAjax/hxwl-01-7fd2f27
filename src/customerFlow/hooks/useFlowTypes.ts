export type FlowStep = "profile" | "hearing" | "fitting" | "review" | "comparison" | "followup" | "summary";

export const FLOW_STEPS: { key: FlowStep; label: string; icon: string }[] = [
  { key: "profile", label: "客户档案", icon: "📋" },
  { key: "hearing", label: "听力录入", icon: "📈" },
  { key: "fitting", label: "验配记录", icon: "🔧" },
  { key: "review", label: "质控审核", icon: "✅" },
  { key: "comparison", label: "验配对比", icon: "📊" },
  { key: "followup", label: "安排复诊", icon: "📅" },
  { key: "summary", label: "摘要报告", icon: "🖨️" },
];
