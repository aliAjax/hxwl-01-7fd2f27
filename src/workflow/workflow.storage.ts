import type { WorkflowState, WorkflowFittingRecord, OperationLog, RoleType } from "./workflow.types";
import { generateId } from "./workflow.types";

const STORAGE_KEY = "hearing_workflow_state";
const STORAGE_VERSION = 1;

export interface StoredWorkflowData {
  version: number;
  state: WorkflowState;
  savedAt: number;
}

export function isStorageSupported(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

function getDefaultState(): WorkflowState {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (d: Date, days: number) => {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
  };

  const sampleRecords: WorkflowFittingRecord[] = [
    {
      id: generateId("rec"),
      customerId: "Liu-024",
      customerName: "刘建国",
      phone: "138****2345",
      hearingLossType: "双耳高频下降",
      fittingStage: "初配",
      hearingAidModel: "Phonak Audeo Paradise P90",
      gainAdjustment: "RIC机型，2kHz后增益提高4dB，高频压缩比调整为1.8:1",
      userFeedback: "佩戴一周后听人声更清晰，但嘈杂环境仍吃力",
      speechRecognitionRate: 76,
      leftPta: 58,
      rightPta: 62,
      status: "pending_review",
      priority: "high",
      followUpDays: 7,
      nextFollowUpDate: formatDate(addDays(today, 7)),
      createdBy: "张听力师",
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2,
      submittedAt: Date.now() - 86400000,
      version: 1,
      reviewFields: [
        { fieldName: "hearingLossType", fieldLabel: "听损类型", isKey: true, hasAbnormality: false },
        { fieldName: "hearingAidModel", fieldLabel: "助听器型号", isKey: true, hasAbnormality: false },
        { fieldName: "gainAdjustment", fieldLabel: "增益调整", isKey: true, hasAbnormality: true, abnormalityNote: "高频增益提升幅度较大，需确认是否有反馈风险" },
        { fieldName: "speechRecognitionRate", fieldLabel: "言语识别率", isKey: true, hasAbnormality: false },
        { fieldName: "leftPta", fieldLabel: "左耳PTA", isKey: true, hasAbnormality: false },
        { fieldName: "rightPta", fieldLabel: "右耳PTA", isKey: true, hasAbnormality: false }
      ]
    },
    {
      id: generateId("rec"),
      customerId: "Chen-118",
      customerName: "陈美玲",
      phone: "139****6789",
      hearingLossType: "单侧传导性损失",
      fittingStage: "复调",
      hearingAidModel: "Signia Pure Charge&Go 7X",
      gainAdjustment: "低频压缩略降5dB，反馈啸叫抑制阈值调高至65dB",
      userFeedback: "之前打电话有啸叫，现在已消失，看电视清楚多了",
      speechRecognitionRate: 82,
      leftPta: 42,
      rightPta: 38,
      status: "review_approved",
      priority: "medium",
      followUpDays: 14,
      nextFollowUpDate: formatDate(addDays(today, 14)),
      createdBy: "张听力师",
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 3,
      submittedAt: Date.now() - 86400000 * 4,
      reviewedAt: Date.now() - 86400000 * 3,
      reviewedBy: "李主管",
      reviewComment: "审核通过，反馈抑制调整合理，建议定期跟踪",
      version: 2,
      reviewFields: [
        { fieldName: "hearingLossType", fieldLabel: "听损类型", isKey: true, hasAbnormality: false },
        { fieldName: "hearingAidModel", fieldLabel: "助听器型号", isKey: true, hasAbnormality: false },
        { fieldName: "gainAdjustment", fieldLabel: "增益调整", isKey: true, hasAbnormality: false },
        { fieldName: "speechRecognitionRate", fieldLabel: "言语识别率", isKey: true, hasAbnormality: false },
        { fieldName: "leftPta", fieldLabel: "左耳PTA", isKey: true, hasAbnormality: false },
        { fieldName: "rightPta", fieldLabel: "右耳PTA", isKey: true, hasAbnormality: false }
      ]
    },
    {
      id: generateId("rec"),
      customerId: "Wang-056",
      customerName: "王淑芬",
      phone: "136****1234",
      hearingLossType: "老人语频区下降",
      fittingStage: "复诊",
      hearingAidModel: "Oticon Ruby 2",
      gainAdjustment: "500Hz-2kHz区间整体增益+3dB，噪声管理程序强度提升一档",
      userFeedback: "和家人交流明显顺畅了",
      speechRecognitionRate: 71,
      leftPta: 65,
      rightPta: 68,
      status: "pending_followup",
      priority: "high",
      followUpDays: 0,
      nextFollowUpDate: formatDate(today),
      createdBy: "张听力师",
      createdAt: Date.now() - 86400000 * 10,
      updatedAt: Date.now() - 86400000 * 6,
      submittedAt: Date.now() - 86400000 * 9,
      reviewedAt: Date.now() - 86400000 * 8,
      reviewedBy: "李主管",
      reviewComment: "审核通过，增益调整合理，需尽快安排复诊",
      followUpAssignedTo: "王助理",
      version: 2,
      reviewFields: [
        { fieldName: "hearingLossType", fieldLabel: "听损类型", isKey: true, hasAbnormality: false },
        { fieldName: "hearingAidModel", fieldLabel: "助听器型号", isKey: true, hasAbnormality: false },
        { fieldName: "gainAdjustment", fieldLabel: "增益调整", isKey: true, hasAbnormality: true, abnormalityNote: "整体增益提升，需关注患者适应情况" },
        { fieldName: "speechRecognitionRate", fieldLabel: "言语识别率", isKey: true, hasAbnormality: false },
        { fieldName: "leftPta", fieldLabel: "左耳PTA", isKey: true, hasAbnormality: false },
        { fieldName: "rightPta", fieldLabel: "右耳PTA", isKey: true, hasAbnormality: false }
      ]
    },
    {
      id: generateId("rec"),
      customerId: "Zhao-077",
      customerName: "赵小宝",
      phone: "137****5678",
      hearingLossType: "先天性感音神经性",
      fittingStage: "初配",
      hearingAidModel: "Oticon More 3 miniRITE R",
      gainAdjustment: "根据儿童处方公式设定，全频段增益适度提高",
      userFeedback: "儿童患者，家长反映孩子对声音反应更灵敏了",
      speechRecognitionRate: 68,
      leftPta: 72,
      rightPta: 75,
      status: "followup_in_progress",
      priority: "high",
      followUpDays: -3,
      nextFollowUpDate: formatDate(addDays(today, -3)),
      createdBy: "张听力师",
      createdAt: Date.now() - 86400000 * 15,
      updatedAt: Date.now() - 86400000 * 2,
      submittedAt: Date.now() - 86400000 * 14,
      reviewedAt: Date.now() - 86400000 * 13,
      reviewedBy: "李主管",
      reviewComment: "审核通过，儿童验配需特别注意定期复查",
      followUpAssignedTo: "王助理",
      followUpStartedAt: Date.now() - 86400000 * 2,
      followUpNote: "已电话联系家长，预约明日到店复查",
      version: 3,
      reviewFields: [
        { fieldName: "hearingLossType", fieldLabel: "听损类型", isKey: true, hasAbnormality: true, abnormalityNote: "先天性听损，需长期跟踪" },
        { fieldName: "hearingAidModel", fieldLabel: "助听器型号", isKey: true, hasAbnormality: false },
        { fieldName: "gainAdjustment", fieldLabel: "增益调整", isKey: true, hasAbnormality: false },
        { fieldName: "speechRecognitionRate", fieldLabel: "言语识别率", isKey: true, hasAbnormality: false },
        { fieldName: "leftPta", fieldLabel: "左耳PTA", isKey: true, hasAbnormality: true, abnormalityNote: "重度听损，需关注助听效果" },
        { fieldName: "rightPta", fieldLabel: "右耳PTA", isKey: true, hasAbnormality: true, abnormalityNote: "重度听损，需关注助听效果" }
      ]
    },
    {
      id: generateId("rec"),
      customerId: "Sun-045",
      customerName: "孙志强",
      phone: "135****9876",
      hearingLossType: "噪声性听力损失",
      fittingStage: "复调",
      hearingAidModel: "Starkey Evolv AI 2400",
      gainAdjustment: "开启AI降噪功能，高频增益适度提升",
      userFeedback: "工作环境噪声大，希望能改善交流",
      speechRecognitionRate: 74,
      leftPta: 55,
      rightPta: 58,
      status: "draft",
      priority: "low",
      followUpDays: 30,
      nextFollowUpDate: formatDate(addDays(today, 30)),
      createdBy: "张听力师",
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 43200000,
      version: 1,
      reviewFields: [
        { fieldName: "hearingLossType", fieldLabel: "听损类型", isKey: true, hasAbnormality: false },
        { fieldName: "hearingAidModel", fieldLabel: "助听器型号", isKey: true, hasAbnormality: false },
        { fieldName: "gainAdjustment", fieldLabel: "增益调整", isKey: true, hasAbnormality: false },
        { fieldName: "speechRecognitionRate", fieldLabel: "言语识别率", isKey: true, hasAbnormality: false },
        { fieldName: "leftPta", fieldLabel: "左耳PTA", isKey: true, hasAbnormality: false },
        { fieldName: "rightPta", fieldLabel: "右耳PTA", isKey: true, hasAbnormality: false }
      ]
    },
    {
      id: generateId("rec"),
      customerId: "Zhou-088",
      customerName: "周丽娟",
      phone: "133****4567",
      hearingLossType: "老年性听力下降",
      fittingStage: "复诊",
      hearingAidModel: "Phonak Naida P90-UP",
      gainAdjustment: "最大功率输出调整，确保响度足够",
      userFeedback: "佩戴三年，近期感觉声音变小了",
      speechRecognitionRate: 62,
      leftPta: 82,
      rightPta: 85,
      status: "completed",
      priority: "medium",
      followUpDays: 90,
      nextFollowUpDate: formatDate(addDays(today, 90)),
      createdBy: "张听力师",
      createdAt: Date.now() - 86400000 * 30,
      updatedAt: Date.now() - 86400000 * 5,
      submittedAt: Date.now() - 86400000 * 28,
      reviewedAt: Date.now() - 86400000 * 25,
      reviewedBy: "李主管",
      followUpAssignedTo: "王助理",
      followUpStartedAt: Date.now() - 86400000 * 10,
      followUpCompletedAt: Date.now() - 86400000 * 5,
      followUpNote: "患者到店复查，调试完成，效果满意",
      version: 4,
      reviewFields: [
        { fieldName: "hearingLossType", fieldLabel: "听损类型", isKey: true, hasAbnormality: true, abnormalityNote: "极重度听损，需定期检查助听器状态" },
        { fieldName: "hearingAidModel", fieldLabel: "助听器型号", isKey: true, hasAbnormality: false },
        { fieldName: "gainAdjustment", fieldLabel: "增益调整", isKey: true, hasAbnormality: false },
        { fieldName: "speechRecognitionRate", fieldLabel: "言语识别率", isKey: true, hasAbnormality: true, abnormalityNote: "识别率较低，需家属配合康复训练" },
        { fieldName: "leftPta", fieldLabel: "左耳PTA", isKey: true, hasAbnormality: true, abnormalityNote: "极重度听损" },
        { fieldName: "rightPta", fieldLabel: "右耳PTA", isKey: true, hasAbnormality: true, abnormalityNote: "极重度听损" }
      ]
    },
    {
      id: generateId("rec"),
      customerId: "Wu-023",
      customerName: "吴明亮",
      phone: "132****7890",
      hearingLossType: "突发性耳聋恢复期",
      fittingStage: "初配",
      hearingAidModel: "Signia Silk 7X",
      gainAdjustment: "保守验配，增益设置较低，预留调整空间",
      userFeedback: "突发性耳聋三个月，听力部分恢复",
      speechRecognitionRate: 58,
      leftPta: 48,
      rightPta: 52,
      status: "review_rejected",
      priority: "high",
      followUpDays: 7,
      nextFollowUpDate: formatDate(addDays(today, 7)),
      createdBy: "张听力师",
      createdAt: Date.now() - 86400000 * 4,
      updatedAt: Date.now() - 86400000 * 1,
      submittedAt: Date.now() - 86400000 * 3,
      reviewedAt: Date.now() - 86400000 * 2,
      reviewedBy: "李主管",
      reviewComment: "驳回：突发性耳聋处于恢复期，建议观察一个月后再考虑验配。如患者坚持，需签署知情同意书。",
      version: 1,
      reviewFields: [
        { fieldName: "hearingLossType", fieldLabel: "听损类型", isKey: true, hasAbnormality: true, abnormalityNote: "突发性耳聋，建议先医学观察" },
        { fieldName: "hearingAidModel", fieldLabel: "助听器型号", isKey: true, hasAbnormality: false },
        { fieldName: "gainAdjustment", fieldLabel: "增益调整", isKey: true, hasAbnormality: false },
        { fieldName: "speechRecognitionRate", fieldLabel: "言语识别率", isKey: true, hasAbnormality: false },
        { fieldName: "leftPta", fieldLabel: "左耳PTA", isKey: true, hasAbnormality: false },
        { fieldName: "rightPta", fieldLabel: "右耳PTA", isKey: true, hasAbnormality: false }
      ]
    }
  ];

  const sampleLogs: OperationLog[] = [
    {
      id: generateId("log"),
      recordId: sampleRecords[0].id,
      operatorRole: "audiologist",
      operatorName: "张听力师",
      action: "创建验配记录",
      actionType: "create",
      oldStatus: undefined,
      newStatus: "draft",
      detail: "为刘建国创建初配记录",
      timestamp: sampleRecords[0].createdAt
    },
    {
      id: generateId("log"),
      recordId: sampleRecords[0].id,
      operatorRole: "audiologist",
      operatorName: "张听力师",
      action: "提交审核",
      actionType: "submit",
      oldStatus: "draft",
      newStatus: "pending_review",
      detail: "记录填写完成，提交主管审核",
      timestamp: sampleRecords[0].submittedAt!
    },
    {
      id: generateId("log"),
      recordId: sampleRecords[1].id,
      operatorRole: "audiologist",
      operatorName: "张听力师",
      action: "创建验配记录",
      actionType: "create",
      oldStatus: undefined,
      newStatus: "draft",
      detail: "为陈美玲创建复调记录",
      timestamp: sampleRecords[1].createdAt
    },
    {
      id: generateId("log"),
      recordId: sampleRecords[1].id,
      operatorRole: "audiologist",
      operatorName: "张听力师",
      action: "提交审核",
      actionType: "submit",
      oldStatus: "draft",
      newStatus: "pending_review",
      detail: "复调记录提交审核",
      timestamp: sampleRecords[1].submittedAt!
    },
    {
      id: generateId("log"),
      recordId: sampleRecords[1].id,
      operatorRole: "supervisor",
      operatorName: "李主管",
      action: "审核通过",
      actionType: "approve",
      oldStatus: "pending_review",
      newStatus: "review_approved",
      detail: "审核通过，反馈抑制调整合理",
      timestamp: sampleRecords[1].reviewedAt!
    },
    {
      id: generateId("log"),
      recordId: sampleRecords[2].id,
      operatorRole: "supervisor",
      operatorName: "李主管",
      action: "分配跟进",
      actionType: "assign",
      oldStatus: "review_approved",
      newStatus: "pending_followup",
      detail: "分配给王助理跟进",
      timestamp: sampleRecords[2].updatedAt
    },
    {
      id: generateId("log"),
      recordId: sampleRecords[3].id,
      operatorRole: "assistant",
      operatorName: "王助理",
      action: "开始跟进",
      actionType: "followup",
      oldStatus: "pending_followup",
      newStatus: "followup_in_progress",
      detail: "已电话联系家长，预约明日到店复查",
      timestamp: sampleRecords[3].followUpStartedAt!
    },
    {
      id: generateId("log"),
      recordId: sampleRecords[6].id,
      operatorRole: "supervisor",
      operatorName: "李主管",
      action: "审核驳回",
      actionType: "reject",
      oldStatus: "pending_review",
      newStatus: "review_rejected",
      detail: "突发性耳聋处于恢复期，建议先医学观察",
      timestamp: sampleRecords[6].reviewedAt!
    }
  ];

  return {
    currentRole: "audiologist",
    currentUserName: "张听力师",
    records: sampleRecords,
    operationLogs: sampleLogs,
    selectedRecordId: null
  };
}

export function saveWorkflowState(state: WorkflowState): void {
  if (!isStorageSupported()) {
    console.warn("LocalStorage not supported");
    return;
  }

  try {
    const data: StoredWorkflowData = {
      version: STORAGE_VERSION,
      state,
      savedAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save workflow state:", e);
    throw new Error("本地存储失败，可能空间不足");
  }
}

export function loadWorkflowState(): WorkflowState {
  if (!isStorageSupported()) {
    console.warn("LocalStorage not supported, using default state");
    return getDefaultState();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultState();
    }

    const data = JSON.parse(raw) as StoredWorkflowData;

    if (data.version !== STORAGE_VERSION) {
      console.warn("Storage version mismatch, using default state");
      return getDefaultState();
    }

    return data.state;
  } catch (e) {
    console.error("Failed to load workflow state:", e);
    return getDefaultState();
  }
}

export function clearWorkflowState(): void {
  if (!isStorageSupported()) return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getCurrentUserByRole(role: RoleType): string {
  const userMap: Record<RoleType, string> = {
    audiologist: "张听力师",
    supervisor: "李主管",
    assistant: "王助理"
  };
  return userMap[role];
}

export { getDefaultState, STORAGE_VERSION };
