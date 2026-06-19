import { describe, it, expect } from "vitest";
import {
  audiogramToHearingRecord,
  hearingRecordToAudiogram,
  createEmptyRecord,
  updateThreshold,
  validateThreshold,
  computePTA,
  classifySeverity,
  findAnomalies
} from "./hearing.utils";
import type { HearingRecord, Frequency } from "./hearing.types";
import type { AudiogramRecord } from "../archive/archive.types";
import { createEmptyAudiogram, FREQUENCIES } from "../archive/archive.types";

function buildSampleHearingRecord(): HearingRecord {
  let r = createEmptyRecord();
  r = updateThreshold(r, "left", "air", 250, 15);
  r = updateThreshold(r, "left", "air", 500, 20);
  r = updateThreshold(r, "left", "air", 1000, 25);
  r = updateThreshold(r, "left", "air", 2000, 35);
  r = updateThreshold(r, "left", "air", 4000, 55);
  r = updateThreshold(r, "left", "air", 8000, 70);
  r = updateThreshold(r, "left", "bone", 250, 10);
  r = updateThreshold(r, "left", "bone", 500, 15);
  r = updateThreshold(r, "left", "bone", 1000, 20);
  r = updateThreshold(r, "left", "bone", 2000, 30);
  r = updateThreshold(r, "left", "bone", 4000, 50);
  r = updateThreshold(r, "left", "bone", 8000, 65);
  r = updateThreshold(r, "right", "air", 250, 12);
  r = updateThreshold(r, "right", "air", 500, 18);
  r = updateThreshold(r, "right", "air", 1000, 22);
  r = updateThreshold(r, "right", "air", 2000, 32);
  r = updateThreshold(r, "right", "air", 4000, 52);
  r = updateThreshold(r, "right", "air", 8000, 68);
  r = updateThreshold(r, "right", "bone", 250, 8);
  r = updateThreshold(r, "right", "bone", 500, 14);
  r = updateThreshold(r, "right", "bone", 1000, 18);
  r = updateThreshold(r, "right", "bone", 2000, 28);
  r = updateThreshold(r, "right", "bone", 4000, 48);
  r = updateThreshold(r, "right", "bone", 8000, 62);
  r.meta = {
    testDate: "2025-06-15",
    tester: "张医师",
    testEnvironment: "隔音室",
    notes: "患者主诉听不清高频声音"
  };
  r.speechRecognitionScore = {
    left: 85,
    right: 88,
    binaural: 92
  };
  return r;
}

function buildSampleAudiogram(customerId: string): AudiogramRecord {
  const base = createEmptyAudiogram(customerId);
  return {
    ...base,
    id: "aud-test-001",
    testDate: "2025-06-15",
    tester: "张医师",
    testEnvironment: "隔音室",
    left: {
      air: FREQUENCIES.map((f, i) => ({
        frequency: f,
        value: [15, 20, 25, 35, 55, 70][i],
        valid: true
      })),
      bone: FREQUENCIES.map((f, i) => ({
        frequency: f,
        value: [10, 15, 20, 30, 50, 65][i],
        valid: true
      }))
    },
    right: {
      air: FREQUENCIES.map((f, i) => ({
        frequency: f,
        value: [12, 18, 22, 32, 52, 68][i],
        valid: true
      })),
      bone: FREQUENCIES.map((f, i) => ({
        frequency: f,
        value: [8, 14, 18, 28, 48, 62][i],
        valid: true
      }))
    },
    speechRecognitionScore: {
      left: 85,
      right: 88,
      binaural: 92
    },
    remark: "患者主诉听不清高频声音"
  };
}

describe("hearing.utils - validateThreshold", () => {
  it("should handle null/empty input as valid null", () => {
    expect(validateThreshold(null)).toEqual({ value: null, valid: true });
    expect(validateThreshold("")).toEqual({ value: null, valid: true });
    expect(validateThreshold(undefined)).toEqual({ value: null, valid: true });
  });

  it("should reject non-numeric input", () => {
    const r = validateThreshold("abc");
    expect(r.valid).toBe(false);
    expect(r.value).toBeNull();
    expect(r.warning).toContain("有效数字");
  });

  it("should reject non-integer values", () => {
    const r = validateThreshold("25.5");
    expect(r.valid).toBe(false);
    expect(r.warning).toContain("整数");
  });

  it("should reject out-of-range values", () => {
    const low = validateThreshold(-20);
    expect(low.valid).toBe(false);
    expect(low.warning).toContain("-10 ~ 130");

    const high = validateThreshold(200);
    expect(high.valid).toBe(false);
    expect(high.warning).toContain("-10 ~ 130");
  });

  it("should accept valid integer values within range", () => {
    const r = validateThreshold(45);
    expect(r).toEqual({ value: 45, valid: true });
  });
});

describe("hearing.utils - computePTA & classifySeverity", () => {
  it("should compute PTA correctly from 500/1000/2000 Hz", () => {
    const record = buildSampleHearingRecord();
    expect(computePTA(record.left)).toBeCloseTo(26.7, 1);
    expect(computePTA(record.right)).toBeCloseTo(24, 0);
  });

  it("should return null when key frequencies are missing", () => {
    const record = createEmptyRecord();
    expect(computePTA(record.left)).toBeNull();
  });

  it("should classify severity correctly", () => {
    expect(classifySeverity(null)).toBe("数据不足");
    expect(classifySeverity(15)).toBe("正常听力");
    expect(classifySeverity(35)).toBe("轻度");
    expect(classifySeverity(50)).toBe("中度");
    expect(classifySeverity(65)).toBe("中重度");
    expect(classifySeverity(80)).toBe("重度");
    expect(classifySeverity(100)).toBe("极重度");
  });
});

describe("hearing.utils - findAnomalies", () => {
  it("should report air-bone gap anomalies (air < bone)", () => {
    let r = createEmptyRecord();
    r = updateThreshold(r, "left", "air", 1000, 10);
    r = updateThreshold(r, "left", "bone", 1000, 20);
    const anomalies = findAnomalies(r);
    expect(anomalies.some((m) => m.includes("气导阈值低于骨导"))).toBe(true);
  });

  it("should report invalid threshold values", () => {
    let r = createEmptyRecord();
    r = updateThreshold(r, "right", "air", 500, 200);
    const anomalies = findAnomalies(r);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0]).toContain("右耳");
    expect(anomalies[0]).toContain("气导");
    expect(anomalies[0]).toContain("500Hz");
  });
});

describe("hearing.utils - audiogramToHearingRecord", () => {
  it("should convert AudiogramRecord to HearingRecord with all thresholds preserved", () => {
    const audiogram = buildSampleAudiogram("cust-001");
    const result = audiogramToHearingRecord(audiogram);

    expect(result.left.air.map((p) => p.value)).toEqual([15, 20, 25, 35, 55, 70]);
    expect(result.left.bone.map((p) => p.value)).toEqual([10, 15, 20, 30, 50, 65]);
    expect(result.right.air.map((p) => p.value)).toEqual([12, 18, 22, 32, 52, 68]);
    expect(result.right.bone.map((p) => p.value)).toEqual([8, 14, 18, 28, 48, 62]);

    result.left.air.forEach((p) => expect(p.valid).toBe(true));
    result.right.bone.forEach((p) => expect(p.valid).toBe(true));
  });

  it("should map meta fields correctly", () => {
    const audiogram = buildSampleAudiogram("cust-001");
    const result = audiogramToHearingRecord(audiogram);

    expect(result.meta?.testDate).toBe("2025-06-15");
    expect(result.meta?.tester).toBe("张医师");
    expect(result.meta?.testEnvironment).toBe("隔音室");
    expect(result.meta?.notes).toBe("患者主诉听不清高频声音");
  });

  it("should map speech recognition scores correctly", () => {
    const audiogram = buildSampleAudiogram("cust-001");
    const result = audiogramToHearingRecord(audiogram);

    expect(result.speechRecognitionScore?.left).toBe(85);
    expect(result.speechRecognitionScore?.right).toBe(88);
    expect(result.speechRecognitionScore?.binaural).toBe(92);
  });

  it("should fill missing frequencies with null defaults", () => {
    const audiogram = buildSampleAudiogram("cust-001");
    audiogram.left.air = [
      { frequency: 500, value: 20, valid: true },
      { frequency: 2000, value: 35, valid: true }
    ];
    const result = audiogramToHearingRecord(audiogram);

    const leftAirFreqs = result.left.air.map((p) => p.frequency);
    expect(leftAirFreqs).toEqual([250, 500, 1000, 2000, 4000, 8000]);
    expect(result.left.air[0].value).toBeNull();
    expect(result.left.air[1].value).toBe(20);
    expect(result.left.air[2].value).toBeNull();
    expect(result.left.air[3].value).toBe(35);
  });

  it("should handle missing speech recognition and remark gracefully", () => {
    const audiogram = createEmptyAudiogram("cust-001");
    const result = audiogramToHearingRecord(audiogram);
    expect(result.speechRecognitionScore).toBeUndefined();
    expect(result.meta?.notes).toBeUndefined();
  });
});

describe("hearing.utils - hearingRecordToAudiogram (new record)", () => {
  it("should convert HearingRecord to new AudiogramRecord", () => {
    const record = buildSampleHearingRecord();
    const customerId = "cust-new-001";
    const result = hearingRecordToAudiogram(record, customerId);

    expect(result.entityType).toBe("audiogram");
    expect(result.customerId).toBe(customerId);
    expect(result.testDate).toBe("2025-06-15");
    expect(result.tester).toBe("张医师");
    expect(result.testEnvironment).toBe("隔音室");
    expect(result.remark).toBe("患者主诉听不清高频声音");
  });

  it("should preserve all threshold values in new audiogram", () => {
    const record = buildSampleHearingRecord();
    const result = hearingRecordToAudiogram(record, "cust-001");

    expect(result.left.air.map((p) => p.value)).toEqual([15, 20, 25, 35, 55, 70]);
    expect(result.right.bone.map((p) => p.value)).toEqual([8, 14, 18, 28, 48, 62]);
  });

  it("should compute PTA for new audiogram", () => {
    const record = buildSampleHearingRecord();
    const result = hearingRecordToAudiogram(record, "cust-001");
    expect(result.pta?.left).toBeGreaterThan(0);
    expect(result.pta?.right).toBeGreaterThan(0);
  });

  it("should include speech recognition scores", () => {
    const record = buildSampleHearingRecord();
    const result = hearingRecordToAudiogram(record, "cust-001");
    expect(result.speechRecognitionScore?.left).toBe(85);
    expect(result.speechRecognitionScore?.binaural).toBe(92);
  });

  it("should use today's date when meta.testDate is missing", () => {
    const record = createEmptyRecord();
    record.meta = {};
    const result = hearingRecordToAudiogram(record, "cust-001");
    const today = new Date().toISOString().slice(0, 10);
    expect(result.testDate).toBe(today);
  });
});

describe("hearing.utils - hearingRecordToAudiogram (edit existing record)", () => {
  it("should preserve existing audiogram identity fields when updating", () => {
    const existing = buildSampleAudiogram("cust-001");
    const originalId = existing.id;
    const originalVersion = existing.version;
    const originalCreatedAt = existing.createdAt;

    let updatedRecord = buildSampleHearingRecord();
    updatedRecord.meta = {
      ...updatedRecord.meta,
      testDate: "2025-06-18",
      tester: "李医师",
      notes: "复测，阈值略有变化"
    };
    updatedRecord = updateThreshold(updatedRecord, "left", "air", 4000, 60);

    const result = hearingRecordToAudiogram(updatedRecord, "cust-001", existing);

    expect(result.id).toBe(originalId);
    expect(result.version).toBe(originalVersion);
    expect(result.createdAt).toBe(originalCreatedAt);
    expect(result.customerId).toBe("cust-001");
  });

  it("should update threshold data from HearingRecord when editing", () => {
    const existing = buildSampleAudiogram("cust-001");
    let updatedRecord = audiogramToHearingRecord(existing);
    updatedRecord = updateThreshold(updatedRecord, "left", "air", 4000, 60);
    updatedRecord = updateThreshold(updatedRecord, "right", "bone", 2000, 35);

    const result = hearingRecordToAudiogram(updatedRecord, "cust-001", existing);

    const leftAir4k = result.left.air.find((p) => p.frequency === 4000);
    expect(leftAir4k?.value).toBe(60);

    const rightBone2k = result.right.bone.find((p) => p.frequency === 2000);
    expect(rightBone2k?.value).toBe(35);
  });

  it("should merge meta fields when editing - new values override existing", () => {
    const existing = buildSampleAudiogram("cust-001");
    existing.tester = "张医师";
    existing.testEnvironment = "隔音室";

    const updatedRecord = audiogramToHearingRecord(existing);
    updatedRecord.meta = {
      ...updatedRecord.meta,
      tester: "李医师",
      notes: "更新备注"
    };

    const result = hearingRecordToAudiogram(updatedRecord, "cust-001", existing);
    expect(result.tester).toBe("李医师");
    expect(result.testEnvironment).toBe("隔音室");
    expect(result.remark).toBe("更新备注");
  });

  it("should preserve existing speech scores when record doesn't have them", () => {
    const existing = buildSampleAudiogram("cust-001");
    const record = createEmptyRecord();
    const result = hearingRecordToAudiogram(record, "cust-001", existing);
    expect(result.speechRecognitionScore?.left).toBe(85);
    expect(result.speechRecognitionScore?.binaural).toBe(92);
  });

  it("should recompute PTA after editing", () => {
    const existing = buildSampleAudiogram("cust-001");
    let record = audiogramToHearingRecord(existing);
    record = updateThreshold(record, "left", "air", 500, 50);
    record = updateThreshold(record, "left", "air", 1000, 50);
    record = updateThreshold(record, "left", "air", 2000, 50);

    const result = hearingRecordToAudiogram(record, "cust-001", existing);
    expect(result.pta?.left).toBe(50);
  });
});

describe("hearing.utils - round-trip consistency", () => {
  it("audiogram -> hearingRecord -> audiogram should preserve data", () => {
    const original = buildSampleAudiogram("cust-001");
    const asHearing = audiogramToHearingRecord(original);
    const asAudiogram = hearingRecordToAudiogram(asHearing, "cust-001");

    expect(asAudiogram.left.air.map((p) => p.value)).toEqual(original.left.air.map((p) => p.value));
    expect(asAudiogram.right.bone.map((p) => p.value)).toEqual(
      original.right.bone.map((p) => p.value)
    );
    expect(asAudiogram.testDate).toBe(original.testDate);
    expect(asAudiogram.tester).toBe(original.tester);
  });
});
