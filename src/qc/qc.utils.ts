import type { WorkflowFittingRecord, ReviewField } from "../workflow/workflow.types";
import type { QcRecord, RequiredField, GainAdjustmentDetail, ReviewStatus } from "./qc.types";

const REQUIRED_FIELD_KEYS = [
  "hearingLossType",
  "hearingAidModel",
  "gainAdjustment",
  "speechRecognitionRate",
  "leftPta",
  "rightPta",
  "userFeedback"
];

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  hearingLossType: "听损类型",
  hearingAidModel: "助听器型号",
  gainAdjustment: "增益调整记录",
  speechRecognitionRate: "言语识别率",
  leftPta: "左耳PTA阈值",
  rightPta: "右耳PTA阈值",
  userFeedback: "用户反馈"
};

const FREQUENCY_POINTS = ["250Hz", "500Hz", "1kHz", "2kHz", "4kHz", "8kHz"];

function buildRequiredFields(record: WorkflowFittingRecord): RequiredField[] {
  return REQUIRED_FIELD_KEYS.map(key => {
    let value = "";
    switch (key) {
      case "hearingLossType":
        value = record.hearingLossType;
        break;
      case "hearingAidModel":
        value = record.hearingAidModel;
        break;
      case "gainAdjustment":
        value = record.gainAdjustment;
        break;
      case "speechRecognitionRate":
        value = record.speechRecognitionRate > 0 ? `${record.speechRecognitionRate}%` : "";
        break;
      case "leftPta":
        value = record.leftPta > 0 ? `${record.leftPta} dB` : "";
        break;
      case "rightPta":
        value = record.rightPta > 0 ? `${record.rightPta} dB` : "";
        break;
      case "userFeedback":
        value = record.userFeedback;
        break;
    }
    return {
      key,
      label: REQUIRED_FIELD_LABELS[key],
      value,
      completed: value.trim().length > 0
    };
  });
}

function calcFieldCompleteness(fields: RequiredField[]): number {
  if (fields.length === 0) return 0;
  const completed = fields.filter(f => f.completed).length;
  return Math.round((completed / fields.length) * 100);
}

function parseGainAdjustment(record: WorkflowFittingRecord): GainAdjustmentDetail[] {
  const result: GainAdjustmentDetail[] = [];
  const hasAbnormalField = record.reviewFields?.find(
    (f: ReviewField) => f.fieldName === "gainAdjustment" && f.hasAbnormality
  );
  const adjustmentText = record.gainAdjustment || "";

  const patterns = [
    { freq: "250Hz", regex: /(?:低频|250Hz)[^0-9\-+]*([\-+]?\d+)/ },
    { freq: "500Hz", regex: /(?:500Hz)[^0-9\-+]*([\-+]?\d+)/ },
    { freq: "1kHz", regex: /(?:1kHz|中频)[^0-9\-+]*([\-+]?\d+)/ },
    { freq: "2kHz", regex: /(?:2kHz)[^0-9\-+]*([\-+]?\d+)/ },
    { freq: "4kHz", regex: /(?:4kHz|高频)[^0-9\-+]*([\-+]?\d+)/ },
    { freq: "8kHz", regex: /(?:8kHz)[^0-9\-+]*([\-+]?\d+)/ }
  ];

  const foundFreqs = new Set<string>();
  let foundAny = false;

  patterns.forEach(p => {
    const match = adjustmentText.match(p.regex);
    if (match) {
      foundAny = true;
      foundFreqs.add(p.freq);
      const deviation = parseInt(match[1], 10) || 0;
      const baseline = Math.max(0, Math.round(deviation * 0.6));
      const adjusted = baseline + deviation;
      const isAbnormal = Math.abs(deviation) > 5;

      let reason = "";
      if (deviation > 0) reason = `增益提升${deviation}dB`;
      else if (deviation < 0) reason = `增益降低${Math.abs(deviation)}dB`;
      else reason = "保持基准增益";

      if (isAbnormal) {
        reason += "，超出推荐范围±5dB";
      }

      result.push({
        frequency: p.freq,
        baseline,
        adjusted,
        deviation,
        isAbnormal,
        reason
      });
    }
  });

  if (!foundAny && adjustmentText.length > 0) {
    const baseDeviation = hasAbnormalField ? 7 : 3;
    FREQUENCY_POINTS.forEach((freq, idx) => {
      const deviation = hasAbnormalField
        ? (idx % 2 === 0 ? baseDeviation : baseDeviation - 2)
        : (idx % 3 === 0 ? baseDeviation : Math.max(0, baseDeviation - 1));
      const baseline = Math.round((record.leftPta + record.rightPta) / 8) + idx;
      const adjusted = baseline + deviation;
      const isAbnormal = Math.abs(deviation) > 5;

      result.push({
        frequency: freq,
        baseline,
        adjusted,
        deviation,
        isAbnormal,
        reason: isAbnormal
          ? "调整幅度超出推荐范围±5dB，需关注"
          : `根据${record.fittingStage}处方公式微调`
      });
    });
  } else if (foundFreqs.size > 0 && foundFreqs.size < FREQUENCY_POINTS.length) {
    FREQUENCY_POINTS.forEach(freq => {
      if (!foundFreqs.has(freq)) {
        result.push({
          frequency: freq,
          baseline: Math.round((record.leftPta + record.rightPta) / 10),
          adjusted: Math.round((record.leftPta + record.rightPta) / 10),
          deviation: 0,
          isAbnormal: false,
          reason: "未提及调整，保持基准设置"
        });
      }
    });
  }

  if (hasAbnormalField && result.length > 0) {
    const abnormalNote = hasAbnormalField.abnormalityNote || "增益调整异常";
    let markedCount = 0;
    for (let i = result.length - 1; i >= 0 && markedCount < 2; i--) {
      if (!result[i].isAbnormal) {
        result[i].isAbnormal = true;
        result[i].reason = abnormalNote;
        markedCount++;
      }
    }
  }

  return result.sort((a, b) => {
    const freqOrder = FREQUENCY_POINTS;
    return freqOrder.indexOf(a.frequency) - freqOrder.indexOf(b.frequency);
  });
}

function checkFeedbackMissing(record: WorkflowFittingRecord): {
  missing: boolean;
  reason: string;
} {
  const feedback = record.userFeedback?.trim() || "";
  if (feedback.length === 0) {
    const reasons: string[] = [];
    if (record.fittingStage === "初配") {
      reasons.push("首次佩戴尚未收集反馈");
    } else if (record.fittingStage === "复调") {
      reasons.push("复调当日未完成佩戴体验回访");
    } else {
      reasons.push("用户反馈待补充");
    }
    return { missing: true, reason: reasons.join("，") };
  }
  return { missing: false, reason: "" };
}

function mapWorkflowStatusToQcStatus(record: WorkflowFittingRecord): ReviewStatus {
  switch (record.status) {
    case "pending_review":
      return "pending";
    case "review_approved":
      return "approved";
    case "review_rejected":
      return "rejected";
    default:
      return "pending";
  }
}

function formatDate(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateOnly(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function convertWorkflowRecordToQc(record: WorkflowFittingRecord): QcRecord {
  const requiredFields = buildRequiredFields(record);
  const fieldCompleteness = calcFieldCompleteness(requiredFields);
  const gainAdjustments = parseGainAdjustment(record);
  const hasAbnormalGain = gainAdjustments.some(g => g.isAbnormal);
  const { missing: feedbackMissing, reason: feedbackMissingReason } = checkFeedbackMissing(record);
  const reviewStatus = mapWorkflowStatusToQcStatus(record);

  return {
    id: `qc-${record.id}`,
    recordId: record.id,
    customerId: record.customerId,
    customerName: record.customerName,
    hearingLossType: record.hearingLossType || "未填写",
    fittingStage: record.fittingStage,
    hearingAidModel: record.hearingAidModel || "未填写",
    audiologist: record.createdBy,
    fittingDate: formatDateOnly(record.createdAt),
    submittedDate: formatDate(record.submittedAt || record.updatedAt),
    requiredFields,
    fieldCompleteness,
    gainAdjustments,
    hasAbnormalGain,
    userFeedback: record.userFeedback || "",
    feedbackMissing,
    feedbackMissingReason,
    reviewStatus,
    reviewedBy: record.reviewedBy,
    reviewedAt: record.reviewedAt ? formatDate(record.reviewedAt) : undefined,
    rejectReason: record.reviewComment && reviewStatus === "rejected" ? record.reviewComment : undefined
  };
}

export function getReviewableRecords(records: WorkflowFittingRecord[]): QcRecord[] {
  const reviewableStatuses: WorkflowFittingRecord["status"][] = [
    "pending_review",
    "review_approved",
    "review_rejected"
  ];

  return records
    .filter(r => reviewableStatuses.includes(r.status))
    .map(convertWorkflowRecordToQc);
}

export function getAuditReasons(): string[] {
  return [
    "关键字段填写不完整，请补充",
    "增益调整幅度超出推荐范围",
    "用户反馈内容缺失，请回访补充",
    "气导/骨导测试数据不完整",
    "言语识别率测试数据缺失",
    "听损类型与助听器选型不匹配",
    "缺少医学检查相关说明"
  ];
}
