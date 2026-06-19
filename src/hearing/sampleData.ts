import { HearingRecord, Frequency } from "./hearing.types";
import { createEmptyRecord, updateThreshold } from "./hearing.utils";

interface SampleCase {
  id: string;
  label: string;
  description: string;
  build: () => HearingRecord;
}

function buildFromMap(
  airLeft: Partial<Record<Frequency, number>>,
  boneLeft: Partial<Record<Frequency, number>>,
  airRight: Partial<Record<Frequency, number>>,
  boneRight: Partial<Record<Frequency, number>>
): HearingRecord {
  let r = createEmptyRecord();
  Object.keys(airLeft).forEach((k) => {
    const f = Number(k) as Frequency;
    r = updateThreshold(r, "left", "air", f, airLeft[f]!);
  });
  Object.keys(boneLeft).forEach((k) => {
    const f = Number(k) as Frequency;
    r = updateThreshold(r, "left", "bone", f, boneLeft[f]!);
  });
  Object.keys(airRight).forEach((k) => {
    const f = Number(k) as Frequency;
    r = updateThreshold(r, "right", "air", f, airRight[f]!);
  });
  Object.keys(boneRight).forEach((k) => {
    const f = Number(k) as Frequency;
    r = updateThreshold(r, "right", "bone", f, boneRight[f]!);
  });
  return r;
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "normal",
    label: "正常听力",
    description: "双耳气导骨导均在正常范围，用于展示基线曲线",
    build: () =>
      buildFromMap(
        { 250: 10, 500: 8, 1000: 5, 2000: 5, 4000: 10, 8000: 15 },
        { 250: 8, 500: 5, 1000: 3, 2000: 3, 4000: 8, 8000: 12 },
        { 250: 8, 500: 6, 1000: 4, 2000: 6, 4000: 8, 8000: 12 },
        { 250: 6, 500: 4, 1000: 2, 2000: 4, 4000: 6, 8000: 10 }
      )
  },
  {
    id: "high-frequency",
    label: "双耳高频下降",
    description: "典型老年性听损，低频正常、高频陡降（刘先生案例）",
    build: () =>
      buildFromMap(
        { 250: 15, 500: 18, 1000: 22, 2000: 35, 4000: 58, 8000: 72 },
        { 250: 12, 500: 15, 1000: 18, 2000: 30, 4000: 52, 8000: 65 },
        { 250: 12, 500: 16, 1000: 20, 2000: 32, 4000: 55, 8000: 68 },
        { 250: 10, 500: 13, 1000: 16, 2000: 28, 4000: 48, 8000: 60 }
      )
  },
  {
    id: "conductive-right",
    label: "单侧传导性损失",
    description: "右耳传导性聋，气骨导间距明显，左耳基本正常（陈女士案例）",
    build: () => {
      const r = buildFromMap(
        { 250: 10, 500: 8, 1000: 10, 2000: 12, 4000: 15, 8000: 20 },
        { 250: 8, 500: 6, 1000: 8, 2000: 10, 4000: 12, 8000: 16 },
        { 250: 55, 500: 52, 1000: 48, 2000: 40, 4000: 35, 8000: 30 },
        { 250: 12, 500: 10, 1000: 10, 2000: 12, 4000: 15, 8000: 18 }
      );
      r.meta = { patientName: "陈女士-单侧传导性" };
      return r;
    }
  },
  {
    id: "presbycusis",
    label: "老人语频区下降",
    description: "老年性聋，500Hz~2kHz为主的语频区中度下降（赵奶奶案例）",
    build: () =>
      buildFromMap(
        { 250: 28, 500: 42, 1000: 48, 2000: 52, 4000: 58, 8000: 62 },
        { 250: 25, 500: 38, 1000: 44, 2000: 48, 4000: 52, 8000: 56 },
        { 250: 26, 500: 40, 1000: 46, 2000: 50, 4000: 54, 8000: 58 },
        { 250: 22, 500: 36, 1000: 42, 2000: 46, 4000: 50, 8000: 52 }
      )
  },
  {
    id: "missing-points",
    label: "含缺失频点",
    description: "演示缺失频点与异常数据的提示效果，1kHz/4kHz缺失，250Hz超限",
    build: () => {
      let r = buildFromMap(
        { 250: 12, 500: 18, 1000: 22, 4000: 48, 8000: 55 },
        { 500: 15, 1000: 18, 2000: 22 },
        { 250: 145, 500: 20, 2000: 32, 4000: 50 },
        { 250: 10, 500: 16, 1000: 20, 4000: 45, 8000: 50 }
      );
      r = updateThreshold(r, "left", "air", 2000, "");
      r = updateThreshold(r, "left", "bone", 4000, "");
      r = updateThreshold(r, "left", "bone", 8000, "");
      r = updateThreshold(r, "right", "air", 1000, "");
      r = updateThreshold(r, "right", "air", 8000, "");
      r = updateThreshold(r, "right", "bone", 2000, "");
      return r;
    }
  }
];

export function loadSampleCase(id: string): HearingRecord | null {
  const found = SAMPLE_CASES.find((c) => c.id === id);
  return found ? found.build() : null;
}
