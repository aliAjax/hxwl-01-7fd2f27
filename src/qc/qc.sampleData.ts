import { QcRecord, RequiredField, GainAdjustmentDetail } from "./qc.types";

const REQUIRED_FIELD_KEYS = ["airConduction", "boneConduction", "speechRecognition", "hearingAidModel", "gainAdjustment", "userFeedback"];
const REQUIRED_FIELD_LABELS: Record<string, string> = {
  airConduction: "气导阈值",
  boneConduction: "骨导阈值",
  speechRecognition: "言语识别率",
  hearingAidModel: "助听器型号",
  gainAdjustment: "增益调整记录",
  userFeedback: "用户反馈"
};

function buildRequiredFields(values: Partial<Record<string, string>>): RequiredField[] {
  return REQUIRED_FIELD_KEYS.map(key => {
    const value = values[key] ?? "";
    return {
      key,
      label: REQUIRED_FIELD_LABELS[key],
      value,
      completed: value.trim().length > 0
    };
  });
}

function calcFieldCompleteness(fields: RequiredField[]): number {
  const completed = fields.filter(f => f.completed).length;
  return Math.round((completed / fields.length) * 100);
}

function buildGainAdjustments(data: Array<{ freq: string; base: number; adj: number; dev: number; abnormal: boolean; reason: string }>): GainAdjustmentDetail[] {
  return data.map(d => ({
    frequency: d.freq,
    baseline: d.base,
    adjusted: d.adj,
    deviation: d.dev,
    isAbnormal: d.abnormal,
    reason: d.reason
  }));
}

export const SAMPLE_QC_RECORDS: QcRecord[] = [
  {
    id: "qc-001",
    recordId: "rec-001",
    customerId: "Liu-024",
    customerName: "刘先生",
    hearingLossType: "双耳高频下降",
    fittingStage: "初配",
    hearingAidModel: "Phonak Audeo Paradise P90",
    audiologist: "陈医生",
    fittingDate: "2026-06-10",
    submittedDate: "2026-06-11 14:32",
    requiredFields: buildRequiredFields({
      airConduction: "左耳：250Hz 35dB, 500Hz 40dB, 1kHz 45dB, 2kHz 55dB, 4kHz 65dB, 8kHz 70dB",
      boneConduction: "左耳：500Hz 30dB, 1kHz 38dB, 2kHz 48dB, 4kHz 58dB",
      speechRecognition: "左耳68%，右耳72%",
      hearingAidModel: "Phonak Audeo Paradise P90",
      gainAdjustment: "RIC机型，2kHz后增益提高4dB，高频压缩比调整为1.8:1",
      userFeedback: "佩戴一周后听人声更清晰，但在嘈杂环境下仍有些吃力，需要继续调试。"
    }),
    fieldCompleteness: 0,
    gainAdjustments: buildGainAdjustments([
      { freq: "250Hz", base: 0, adj: 2, dev: 2, abnormal: false, reason: "低频轻度提升" },
      { freq: "500Hz", base: 2, adj: 4, dev: 2, abnormal: false, reason: "按处方公式调整" },
      { freq: "1kHz", base: 5, adj: 7, dev: 2, abnormal: false, reason: "言语频段增益" },
      { freq: "2kHz", base: 10, adj: 14, dev: 4, abnormal: false, reason: "高频下降补偿" },
      { freq: "4kHz", base: 15, adj: 22, dev: 7, abnormal: true, reason: "超出推荐范围±5dB，增益过高" }
    ]),
    hasAbnormalGain: true,
    userFeedback: "佩戴一周后听人声更清晰，但在嘈杂环境下仍有些吃力，需要继续调试。",
    feedbackMissing: false,
    feedbackMissingReason: "",
    reviewStatus: "pending"
  },
  {
    id: "qc-002",
    recordId: "rec-002",
    customerId: "Chen-118",
    customerName: "陈女士",
    hearingLossType: "单侧传导性损失",
    fittingStage: "复调",
    hearingAidModel: "Signia Pure Charge&Go 7X",
    audiologist: "王医生",
    fittingDate: "2026-06-08",
    submittedDate: "2026-06-12 09:15",
    requiredFields: buildRequiredFields({
      airConduction: "右耳：各频率均在正常范围",
      boneConduction: "",
      speechRecognition: "右耳90%",
      hearingAidModel: "Signia Pure Charge&Go 7X",
      gainAdjustment: "低频压缩略降5dB，反馈啸叫抑制阈值调高至65dB",
      userFeedback: "之前打电话有啸叫，现在已经完全消失，看电视也比以前清楚多了。"
    }),
    fieldCompleteness: 0,
    gainAdjustments: buildGainAdjustments([
      { freq: "250Hz", base: 8, adj: 3, dev: -5, abnormal: false, reason: "低频衰减降低堵耳感" },
      { freq: "500Hz", base: 10, adj: 8, dev: -2, abnormal: false, reason: "轻微调整" },
      { freq: "1kHz", base: 12, adj: 12, dev: 0, abnormal: false, reason: "保持不变" },
      { freq: "2kHz", base: 8, adj: 8, dev: 0, abnormal: false, reason: "保持不变" }
    ]),
    hasAbnormalGain: false,
    userFeedback: "之前打电话有啸叫，现在已经完全消失，看电视也比以前清楚多了。",
    feedbackMissing: false,
    feedbackMissingReason: "",
    reviewStatus: "pending"
  },
  {
    id: "qc-003",
    recordId: "rec-003",
    customerId: "Zhao-077",
    customerName: "赵奶奶",
    hearingLossType: "老人语频区下降",
    fittingStage: "复诊",
    hearingAidModel: "Oticon More 3 miniRITE R",
    audiologist: "李医生",
    fittingDate: "2026-06-05",
    submittedDate: "2026-06-13 16:48",
    requiredFields: buildRequiredFields({
      airConduction: "500Hz-2kHz范围55-65dB",
      boneConduction: "500Hz-2kHz范围50-60dB",
      speechRecognition: "64%→76%",
      hearingAidModel: "Oticon More 3 miniRITE R",
      gainAdjustment: "500Hz-2kHz区间整体增益+3dB，噪声管理程序强度提升一档",
      userFeedback: ""
    }),
    fieldCompleteness: 0,
    gainAdjustments: buildGainAdjustments([
      { freq: "500Hz", base: 10, adj: 13, dev: 3, abnormal: false, reason: "语频区整体提升" },
      { freq: "1kHz", base: 12, adj: 15, dev: 3, abnormal: false, reason: "按患者反馈调整" },
      { freq: "2kHz", base: 14, adj: 17, dev: 3, abnormal: false, reason: "言语清晰度提升" },
      { freq: "4kHz", base: 10, adj: 10, dev: 0, abnormal: false, reason: "保持不变" }
    ]),
    hasAbnormalGain: false,
    userFeedback: "",
    feedbackMissing: true,
    feedbackMissingReason: "复诊当日未完成佩戴体验回访，用户反馈待补充",
    reviewStatus: "pending"
  },
  {
    id: "qc-004",
    recordId: "rec-004",
    customerId: "Wang-056",
    customerName: "王阿姨",
    hearingLossType: "双耳中度感音神经性",
    fittingStage: "初配",
    hearingAidModel: "Oticon Ruby 2",
    audiologist: "陈医生",
    fittingDate: "2026-06-12",
    submittedDate: "2026-06-14 10:22",
    requiredFields: buildRequiredFields({
      airConduction: "左耳：轻中度下降；右耳：中度下降",
      boneConduction: "测试未完成",
      speechRecognition: "",
      hearingAidModel: "Oticon Ruby 2",
      gainAdjustment: "",
      userFeedback: ""
    }),
    fieldCompleteness: 0,
    gainAdjustments: buildGainAdjustments([]),
    hasAbnormalGain: false,
    userFeedback: "",
    feedbackMissing: true,
    feedbackMissingReason: "用户首次佩戴，尚未收集反馈",
    reviewStatus: "pending"
  },
  {
    id: "qc-005",
    recordId: "rec-005",
    customerId: "Zhang-091",
    customerName: "张大爷",
    hearingLossType: "重度混合性听损",
    fittingStage: "复调",
    hearingAidModel: "Widex Moment 440",
    audiologist: "王医生",
    fittingDate: "2026-06-01",
    submittedDate: "2026-06-10 15:30",
    requiredFields: buildRequiredFields({
      airConduction: "双耳重度下降，8kHz可达85dB",
      boneConduction: "双耳500-4kHz 60-75dB",
      speechRecognition: "左耳52%，右耳48%",
      hearingAidModel: "Widex Moment 440",
      gainAdjustment: "全频段增益大幅提升，低频+10dB，中频+8dB，高频+12dB",
      userFeedback: "声音大了但有些刺耳，听孙子说话清楚多了。"
    }),
    fieldCompleteness: 0,
    gainAdjustments: buildGainAdjustments([
      { freq: "250Hz", base: 5, adj: 15, dev: 10, abnormal: true, reason: "低频增益超出推荐范围，可能导致堵耳感" },
      { freq: "500Hz", base: 8, adj: 18, dev: 10, abnormal: true, reason: "增益提升过大，建议分阶段调整" },
      { freq: "1kHz", base: 12, adj: 20, dev: 8, abnormal: true, reason: "中频增益接近上限，需关注响度适应" },
      { freq: "2kHz", base: 15, adj: 22, dev: 7, abnormal: true, reason: "超出推荐范围±5dB" },
      { freq: "4kHz", base: 12, adj: 24, dev: 12, abnormal: true, reason: "高频增益过高，可能产生反馈啸叫风险" }
    ]),
    hasAbnormalGain: true,
    userFeedback: "声音大了但有些刺耳，听孙子说话清楚多了。",
    feedbackMissing: false,
    feedbackMissingReason: "",
    reviewStatus: "rejected",
    reviewedBy: "主管-孙",
    reviewedAt: "2026-06-12 11:00",
    rejectReason: "增益调整幅度普遍超出推荐范围，建议分阶段逐步调整，并补充响度适应测试数据。"
  },
  {
    id: "qc-006",
    recordId: "rec-006",
    customerId: "Li-132",
    customerName: "李先生",
    hearingLossType: "单侧神经性高频下降",
    fittingStage: "初配",
    hearingAidModel: "ReSound One 9",
    audiologist: "李医生",
    fittingDate: "2026-06-14",
    submittedDate: "2026-06-15 08:50",
    requiredFields: buildRequiredFields({
      airConduction: "左耳：250-1kHz正常，2-8kHz 45-65dB下降；右耳：正常",
      boneConduction: "左耳：2-4kHz 40-55dB",
      speechRecognition: "左耳80%，右耳95%",
      hearingAidModel: "ReSound One 9",
      gainAdjustment: "左耳2-4kHz增益+4~6dB，噪声管理开启",
      userFeedback: "开会时听得清楚多了，电话效果也不错。"
    }),
    fieldCompleteness: 0,
    gainAdjustments: buildGainAdjustments([
      { freq: "1kHz", base: 0, adj: 0, dev: 0, abnormal: false, reason: "正常听力，无需增益" },
      { freq: "2kHz", base: 3, adj: 7, dev: 4, abnormal: false, reason: "轻度高频下降补偿" },
      { freq: "4kHz", base: 8, adj: 14, dev: 6, abnormal: true, reason: "略超推荐范围±5dB，建议观察反馈情况" },
      { freq: "8kHz", base: 10, adj: 14, dev: 4, abnormal: false, reason: "高频清晰度补偿" }
    ]),
    hasAbnormalGain: true,
    userFeedback: "开会时听得清楚多了，电话效果也不错。",
    feedbackMissing: false,
    feedbackMissingReason: "",
    reviewStatus: "approved",
    reviewedBy: "主管-孙",
    reviewedAt: "2026-06-16 09:30"
  },
  {
    id: "qc-007",
    recordId: "rec-007",
    customerId: "Sun-045",
    customerName: "孙先生",
    hearingLossType: "双耳对称性轻度下降",
    fittingStage: "初配",
    hearingAidModel: "Starkey Evolv AI 2400",
    audiologist: "陈医生",
    fittingDate: "2026-06-11",
    submittedDate: "2026-06-13 11:20",
    requiredFields: buildRequiredFields({
      airConduction: "双耳250-8kHz 25-40dB",
      boneConduction: "双耳250-8kHz 20-35dB",
      speechRecognition: "双耳92%",
      hearingAidModel: "Starkey Evolv AI 2400",
      gainAdjustment: "AI模式默认配置，轻度增益补偿",
      userFeedback: "环境噪音下听人说话好多了，佩戴舒适。"
    }),
    fieldCompleteness: 0,
    gainAdjustments: buildGainAdjustments([
      { freq: "250Hz", base: 0, adj: 1, dev: 1, abnormal: false, reason: "轻度低频补偿" },
      { freq: "500Hz", base: 2, adj: 3, dev: 1, abnormal: false, reason: "按处方微调" },
      { freq: "1kHz", base: 3, adj: 4, dev: 1, abnormal: false, reason: "言语频段轻度增强" },
      { freq: "2kHz", base: 4, adj: 5, dev: 1, abnormal: false, reason: "常规调整" },
      { freq: "4kHz", base: 3, adj: 4, dev: 1, abnormal: false, reason: "常规调整" }
    ]),
    hasAbnormalGain: false,
    userFeedback: "环境噪音下听人说话好多了，佩戴舒适。",
    feedbackMissing: false,
    feedbackMissingReason: "",
    reviewStatus: "approved",
    reviewedBy: "主管-孙",
    reviewedAt: "2026-06-14 14:15"
  }
];

SAMPLE_QC_RECORDS.forEach(r => {
  r.fieldCompleteness = calcFieldCompleteness(r.requiredFields);
});

export function getQcRecordById(id: string): QcRecord | undefined {
  return SAMPLE_QC_RECORDS.find(r => r.id === id);
}
