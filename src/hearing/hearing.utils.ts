import {
  Frequency,
  FREQUENCIES,
  HearingRecord,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  ThresholdPoint,
  EarSide,
  ConductionType
} from "./hearing.types";

export function createEmptyThresholds(): ThresholdPoint[] {
  return FREQUENCIES.map((freq): ThresholdPoint => ({
    frequency: freq,
    value: null,
    valid: true
  }));
}

export function createEmptyRecord(): HearingRecord {
  return {
    left: {
      air: createEmptyThresholds(),
      bone: createEmptyThresholds()
    },
    right: {
      air: createEmptyThresholds(),
      bone: createEmptyThresholds()
    },
    meta: {}
  };
}

export function validateThreshold(raw: string | number | null): {
  value: number | null;
  valid: boolean;
  warning?: string;
} {
  if (raw === null || raw === undefined || raw === "") {
    return { value: null, valid: true };
  }
  const num = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(num)) {
    return { value: null, valid: false, warning: "请输入有效数字" };
  }
  if (!Number.isInteger(num)) {
    return { value: null, valid: false, warning: "阈值需为整数(dB HL)" };
  }
  if (num < THRESHOLD_MIN || num > THRESHOLD_MAX) {
    return {
      value: num,
      valid: false,
      warning: `阈值应在 ${THRESHOLD_MIN} ~ ${THRESHOLD_MAX} dB HL 之间`
    };
  }
  return { value: num, valid: true };
}

export function updateThreshold(
  record: HearingRecord,
  side: EarSide,
  conduction: ConductionType,
  frequency: Frequency,
  rawValue: string | number | null
): HearingRecord {
  const result = validateThreshold(rawValue);
  const next = JSON.parse(JSON.stringify(record)) as HearingRecord;
  const arr = next[side][conduction];
  const idx = arr.findIndex(p => p.frequency === frequency);
  if (idx >= 0) {
    arr[idx] = {
      frequency,
      value: result.value,
      valid: result.valid,
      warning: result.warning
    };
  }
  return next;
}

export function computePTA(
  ear: { air: ThresholdPoint[] },
  freqs: Frequency[] = [500, 1000, 2000]
): number | null {
  const vals = ear.air
    .filter(p => freqs.includes(p.frequency) && p.value !== null && p.valid)
    .map(p => p.value as number);
  if (vals.length < freqs.length) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / vals.length) * 10) / 10;
}

export function classifySeverity(pta: number | null): string {
  if (pta === null) return "数据不足";
  if (pta <= 25) return "正常听力";
  if (pta <= 40) return "轻度";
  if (pta <= 55) return "中度";
  if (pta <= 70) return "中重度";
  if (pta <= 90) return "重度";
  return "极重度";
}

export function findAnomalies(record: HearingRecord): string[] {
  const msgs: string[] = [];
  (["left", "right"] as EarSide[]).forEach(side => {
    (["air", "bone"] as ConductionType[]).forEach(cond => {
      record[side][cond].forEach(p => {
        if (!p.valid && p.warning) {
          msgs.push(
            `${side === "left" ? "左耳" : "右耳"}·${cond === "air" ? "气导" : "骨导"}·${p.frequency}Hz：${p.warning}`
          );
        }
      });
    });
  });
  (["left", "right"] as EarSide[]).forEach(side => {
    const air = record[side].air.filter(p => p.value !== null);
    const bone = record[side].bone.filter(p => p.value !== null);
    const freqMap = new Map<Frequency, number>();
    bone.forEach(p => freqMap.set(p.frequency, p.value as number));
    air.forEach(p => {
      const b = freqMap.get(p.frequency);
      if (b !== undefined && (p.value as number) < b - 5) {
        msgs.push(
          `${side === "left" ? "左耳" : "右耳"}·${p.frequency}Hz：气导阈值低于骨导，请确认数据`
        );
      }
    });
  });
  return msgs;
}
