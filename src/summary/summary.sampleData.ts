import type { FittingSummaryData } from "./summary.types";

export const summarySampleData: Record<string, FittingSummaryData> = {
  "Liu-024": {
    customerId: "Liu-024",
    customerName: "刘先生",
    hearingLossDescription:
      "双耳高频下降型感音神经性听损，左耳PTA 42dB，右耳PTA 38dB，言语识别率左耳72%、右耳78%。患者主诉在嘈杂环境下听辨困难，尤其是高频辅音清晰度不足。",
    hearingAidModel: "Phonak Audeo Paradise P90（RIC受话器外置式）",
    keyMetrics: [
      { label: "左耳PTA", value: "42", unit: "dB", trend: "down" },
      { label: "右耳PTA", value: "38", unit: "dB", trend: "stable" },
      { label: "言语识别率", value: "76", unit: "%", trend: "up" },
      { label: "佩戴时长", value: "8.5", unit: "小时/天", trend: "up" }
    ],
    adjustments: [
      {
        date: "2026-05-10",
        stage: "初配",
        description:
          "首次验配，按NAL-NL2处方公式设置增益，2kHz后增益提高4dB，高频压缩比调整为1.8:1，启用自动降噪程序。",
        operator: "张验配师"
      },
      {
        date: "2026-05-17",
        stage: "首次复调",
        description:
          "患者反馈佩戴一周后听人声更清晰，但嘈杂环境下仍吃力。调整：噪声管理程序强度提升一档，方向性麦克风灵敏度优化。",
        operator: "张验配师"
      },
      {
        date: "2026-05-24",
        stage: "二次复调",
        description:
          "环境自适应效果改善，微调4kHz增益+2dB，启用风噪抑制功能，言语识别率测试从68%提升至76%。",
        operator: "李验配师"
      }
    ],
    followUpAdvice:
      "建议继续每日佩戴8小时以上，逐步适应复杂环境。两周后进行第三次复调，重点评估言语识别率和嘈杂环境下的聆听效果。如出现耳道不适或啸叫，请及时联系门店。保持助听器干燥清洁，定期更换耵聍挡板。",
    summaryDate: "2026-06-17",
    audiologist: "张验配师"
  },
  "Chen-118": {
    customerId: "Chen-118",
    customerName: "陈女士",
    hearingLossDescription:
      "单侧传导性听力损失（右耳），右耳PTA 55dB，左耳听力正常。主要表现为接听电话和右侧交谈时听不清。经检查为中耳炎后遗症，鼓膜穿孔愈合后仍有传导性损失。",
    hearingAidModel: "Signia Pure Charge&Go 7X（耳内式定制机）",
    keyMetrics: [
      { label: "右耳PTA", value: "55", unit: "dB", trend: "stable" },
      { label: "左耳PTA", value: "18", unit: "dB", trend: "stable" },
      { label: "言语识别率（右耳）", value: "82", unit: "%", trend: "up" },
      { label: "佩戴舒适度", value: "良好", trend: "stable" }
    ],
    adjustments: [
      {
        date: "2026-04-20",
        stage: "初配",
        description:
          "右耳单耳验配，耳内式定制机，低频压缩比1.5:1，反馈啸叫抑制阈值设置为60dB，启用电话程序。",
        operator: "王验配师"
      },
      {
        date: "2026-05-05",
        stage: "首次复调",
        description:
          "患者反馈打电话有啸叫，调整反馈抑制阈值调高至65dB，优化电话程序参数，增加自适应方向性功能。",
        operator: "王验配师"
      }
    ],
    followUpAdvice:
      "目前啸叫问题已完全解决，佩戴效果良好。建议每月进行一次耳道清洁检查，每三个月复查听力。注意保持耳道干燥，游泳或洗澡时请取下助听器。下次复诊时间：2026-07-05。",
    summaryDate: "2026-06-17",
    audiologist: "王验配师"
  },
  "Zhao-077": {
    customerId: "Zhao-077",
    customerName: "赵奶奶",
    hearingLossDescription:
      "老年性听力下降，语频区（500Hz-2kHz）为主的感音神经性听损。左耳PTA 62dB，右耳PTA 58dB。主诉与家人交流困难，看电视声音开得很大。",
    hearingAidModel: "Oticon More 3 miniRITE R（受话器外置式）",
    keyMetrics: [
      { label: "左耳PTA", value: "62", unit: "dB", trend: "stable" },
      { label: "右耳PTA", value: "58", unit: "dB", trend: "stable" },
      { label: "言语识别率", value: "76", unit: "%", trend: "up" },
      { label: "家属满意度", value: "高", trend: "up" }
    ],
    adjustments: [
      {
        date: "2026-03-15",
        stage: "初配",
        description:
          "双耳验配，按老年患者处方增益设置，500Hz-2kHz区间整体增益+3dB，噪声管理程序设为中等强度，大音量警示开启。",
        operator: "李验配师"
      },
      {
        date: "2026-04-01",
        stage: "首次复调",
        description:
          "适应良好，家人反馈交流明显顺畅。微调：增加低频舒适感，启用神经网络降噪功能，言语识别率测试从64%提升到72%。",
        operator: "李验配师"
      },
      {
        date: "2026-05-20",
        stage: "二次复调",
        description:
          "患者佩戴积极性高，日均佩戴9小时。调整：噪声管理程序强度提升一档，音乐程序优化，言语识别率提升至76%。",
        operator: "张验配师"
      }
    ],
    followUpAdvice:
      "患者适应情况良好，建议继续坚持每日佩戴。家属应注意与患者交流时语速放缓、面对面交谈。每季度复查一次听力，关注听力变化。下次复诊时间：2026-06-21，将进行季度评估和言语识别率复测。",
    summaryDate: "2026-06-17",
    audiologist: "李验配师"
  }
};

export function getSummaryByCustomerId(customerId: string): FittingSummaryData | undefined {
  return summarySampleData[customerId];
}

export function getAllSummaryIds(): string[] {
  return Object.keys(summarySampleData);
}
