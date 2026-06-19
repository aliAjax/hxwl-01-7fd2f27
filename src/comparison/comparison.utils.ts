import {
  ComparisonData,
  ComparisonStatus,
  ComparisonResultItem,
  FittingRecord
} from "./comparison.types";
import type { KeyMetric } from "../summary/summary.types";

export function computeSpeechStatus(
  initial: number | null,
  followUp: number | null
): { status: ComparisonStatus; change: string } {
  if (initial === null || followUp === null) {
    return { status: "stable", change: "—" };
  }
  const diff = followUp - initial;
  const changeText = diff > 0 ? `+${diff}%` : `${diff}%`;
  if (diff > 3) return { status: "improved", change: changeText };
  if (diff < -3) return { status: "worsened", change: changeText };
  return { status: "stable", change: changeText };
}

export function computeFeedbackStatus(
  initial: string,
  followUp: string
): { status: ComparisonStatus; label: string } {
  if (!initial || !followUp) return { status: "stable", label: "待评估" };
  const initLower = initial.toLowerCase();
  const followLower = followUp.toLowerCase();
  const badKeywords = ["频繁", "严重", "明显", "经常", "影响"];
  const goodKeywords = ["无", "消失", "消除", "改善", "减少", "减轻"];

  const initBad = badKeywords.some((k) => initLower.includes(k));
  const followBad = badKeywords.some((k) => followLower.includes(k));
  const followGood = goodKeywords.some((k) => followLower.includes(k));

  if (initBad && (followGood || !followBad)) {
    return { status: "improved", label: "改善" };
  }
  if (!initBad && followBad) {
    return { status: "worsened", label: "变差" };
  }
  return { status: "stable", label: "持平" };
}

export function computeGainStatus(
  initial: string,
  followUp: string
): { status: ComparisonStatus; label: string } {
  if (!initial || !followUp) return { status: "stable", label: "待评估" };
  const initLower = initial.toLowerCase();
  const followLower = followUp.toLowerCase();
  const improveKeywords = ["提高", "提升", "增加", "优化", "调整", "改善", "+"];
  const worsenKeywords = ["降低", "减少", "下降", "-"];

  const followImprove = improveKeywords.some((k) => followLower.includes(k));
  const followWorsen = worsenKeywords.some((k) => followLower.includes(k));
  const initImprove = improveKeywords.some((k) => initLower.includes(k));

  if (followImprove && !initImprove) {
    return { status: "improved", label: "优化" };
  }
  if (followWorsen) {
    return { status: "worsened", label: "下调" };
  }
  return { status: "stable", label: "维持" };
}

export function generateComparisonResults(data: ComparisonData): ComparisonResultItem[] {
  const speechResult = computeSpeechStatus(
    data.initial.speechRecognitionRate,
    data.followUp.speechRecognitionRate
  );
  const feedbackResult = computeFeedbackStatus(
    data.initial.feedbackWhistle,
    data.followUp.feedbackWhistle
  );
  const gainResult = computeGainStatus(data.initial.gainAdjustment, data.followUp.gainAdjustment);

  return [
    {
      label: "言语识别率",
      initialValue:
        data.initial.speechRecognitionRate !== null
          ? `${data.initial.speechRecognitionRate}%`
          : "未填写",
      followUpValue:
        data.followUp.speechRecognitionRate !== null
          ? `${data.followUp.speechRecognitionRate}%`
          : "未填写",
      status: speechResult.status,
      changeValue: speechResult.change
    },
    {
      label: "反馈啸叫",
      initialValue: data.initial.feedbackWhistle || "未填写",
      followUpValue: data.followUp.feedbackWhistle || "未填写",
      status: feedbackResult.status,
      changeValue: feedbackResult.label
    },
    {
      label: "增益调整",
      initialValue: data.initial.gainAdjustment || "未填写",
      followUpValue: data.followUp.gainAdjustment || "未填写",
      status: gainResult.status,
      changeValue: gainResult.label
    }
  ];
}

export function updateFittingRecord(
  data: ComparisonData,
  side: "initial" | "followUp",
  field: keyof FittingRecord,
  value: string | number | null
): ComparisonData {
  return {
    ...data,
    [side]: {
      ...data[side],
      [field]: value
    }
  };
}

export const statusLabelMap: Record<ComparisonStatus, string> = {
  improved: "改善",
  stable: "持平",
  worsened: "变差"
};

export function comparisonToKeyMetrics(data: ComparisonData): KeyMetric[] {
  const results = generateComparisonResults(data);
  const metrics: KeyMetric[] = [];

  const speechResult = results.find((r) => r.label === "言语识别率");
  if (speechResult && data.followUp.speechRecognitionRate !== null) {
    metrics.push({
      label: "言语识别率",
      value: String(data.followUp.speechRecognitionRate),
      unit: "%",
      trend:
        speechResult.status === "improved"
          ? "up"
          : speechResult.status === "worsened"
            ? "down"
            : "stable"
    });
  }

  const feedbackResult = results.find((r) => r.label === "反馈啸叫");
  if (feedbackResult && data.followUp.feedbackWhistle) {
    metrics.push({
      label: "反馈啸叫",
      value: feedbackResult.changeValue || "评估中",
      trend:
        feedbackResult.status === "improved"
          ? "up"
          : feedbackResult.status === "worsened"
            ? "down"
            : "stable"
    });
  }

  const gainResult = results.find((r) => r.label === "增益调整");
  if (gainResult && data.followUp.gainAdjustment) {
    metrics.push({
      label: "增益调整效果",
      value: gainResult.changeValue || "评估中",
      trend:
        gainResult.status === "improved"
          ? "up"
          : gainResult.status === "worsened"
            ? "down"
            : "stable"
    });
  }

  return metrics;
}

export function getComparisonSummaryText(data: ComparisonData): string {
  const results = generateComparisonResults(data);
  const improved = results.filter((r) => r.status === "improved").length;
  const stable = results.filter((r) => r.status === "stable").length;
  const worsened = results.filter((r) => r.status === "worsened").length;

  const parts: string[] = [];
  if (improved > 0) parts.push(`${improved}项指标改善`);
  if (stable > 0) parts.push(`${stable}项指标持平`);
  if (worsened > 0) parts.push(`${worsened}项指标变差`);

  return parts.length > 0 ? `验配效果评估：${parts.join("，")}。` : "暂无足够对比数据";
}
