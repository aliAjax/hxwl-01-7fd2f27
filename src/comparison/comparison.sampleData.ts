import { ComparisonData } from "./comparison.types";

export const SAMPLE_COMPARISONS: ComparisonData[] = [
  {
    customerId: "Liu-024",
    customerName: "刘先生",
    hearingLossType: "双耳高频下降",
    hearingAidModel: "Phonak Audeo Paradise P90",
    initial: {
      speechRecognitionRate: 58,
      feedbackWhistle: "无明显啸叫，安静环境下基本正常",
      gainAdjustment: "初配增益按处方公式设定，高频补偿不足",
      recordDate: "2026-05-15",
      fittingStage: "初配"
    },
    followUp: {
      speechRecognitionRate: 72,
      feedbackWhistle: "无啸叫，佩戴舒适",
      gainAdjustment: "2kHz后增益提高4dB，高频压缩比调整为1.8:1",
      recordDate: "2026-06-12",
      fittingStage: "复调"
    }
  },
  {
    customerId: "Chen-118",
    customerName: "陈女士",
    hearingLossType: "单侧传导性损失",
    hearingAidModel: "Signia Pure Charge&Go 7X",
    initial: {
      speechRecognitionRate: 65,
      feedbackWhistle: "打电话时频繁啸叫，影响使用体验",
      gainAdjustment: "初配低频增益偏高，反馈抑制阈值较低",
      recordDate: "2026-05-20",
      fittingStage: "初配"
    },
    followUp: {
      speechRecognitionRate: 78,
      feedbackWhistle: "啸叫完全消除，通话清晰",
      gainAdjustment: "低频压缩略降5dB，反馈啸叫抑制阈值调高至65dB",
      recordDate: "2026-06-15",
      fittingStage: "复调"
    }
  },
  {
    customerId: "Zhao-077",
    customerName: "赵奶奶",
    hearingLossType: "老人语频区下降",
    hearingAidModel: "Oticon More 3 miniRITE R",
    initial: {
      speechRecognitionRate: 64,
      feedbackWhistle: "偶有轻微啸叫，咀嚼时较明显",
      gainAdjustment: "初配增益保守，语频区补偿不足",
      recordDate: "2026-05-10",
      fittingStage: "初配"
    },
    followUp: {
      speechRecognitionRate: 76,
      feedbackWhistle: "啸叫明显减少，日常使用基本无影响",
      gainAdjustment: "500Hz-2kHz区间整体增益+3dB，噪声管理程序强度提升一档",
      recordDate: "2026-06-08",
      fittingStage: "复诊"
    }
  }
];

export function getComparisonByCustomerId(customerId: string): ComparisonData | undefined {
  return SAMPLE_COMPARISONS.find(c => c.customerId === customerId);
}

export function createEmptyComparison(customerId: string): ComparisonData {
  return {
    customerId,
    initial: {
      speechRecognitionRate: null,
      feedbackWhistle: "",
      gainAdjustment: "",
      fittingStage: "初配"
    },
    followUp: {
      speechRecognitionRate: null,
      feedbackWhistle: "",
      gainAdjustment: "",
      fittingStage: "复调"
    }
  };
}
