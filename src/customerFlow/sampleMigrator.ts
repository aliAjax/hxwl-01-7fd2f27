import { getArchiveDB } from "../archive/archive.storage";
import type {
  CustomerProfile,
  AudiogramRecord,
  FittingRecord,
  FollowUpRecord,
  ComparisonRecord
} from "../archive/archive.types";
import {
  generateId,
  generateVersionId,
  FREQUENCIES,
  DEFAULT_EAR_AUDIOGRAM
} from "../archive/archive.types";

const MIGRATION_KEY = "flow_sample_migrated_v2";

interface LegacyRecord {
  id: string;
  customerId: string;
  hearingLossType: string;
  fittingStage: string;
  hearingAidModel: string;
  gainAdjustment: string;
  userFeedback: string;
}

interface LegacyFollowUp {
  id: string;
  customerId: string;
  customerName: string;
  daysToNext: number;
  priority: "high" | "medium" | "low";
  contactStatus: "pending" | "contacted" | "unreachable";
  lastFollowUpDate: string;
  nextFollowUpDate: string;
  hearingAidModel: string;
  notes: string;
}

const HEARING_LOSS_MAP: Record<string, CustomerProfile["hearingLossType"]> = {
  双耳高频下降: "感音神经性",
  单侧传导性损失: "传导性",
  老人语频区下降: "感音神经性"
};

const CUSTOMER_NAME_MAP: Record<string, string> = {
  "Liu-024": "刘建国",
  "Chen-118": "陈美玲",
  "Zhao-077": "赵子涵",
  "Wang-056": "王淑芬",
  "Zhang-091": "张大爷",
  "Li-132": "李先生",
  "Sun-045": "孙志强",
  "Zhou-088": "周丽娟",
  "Wu-023": "吴明亮"
};

const CUSTOMER_PHONE_MAP: Record<string, string> = {
  "Liu-024": "13800138001",
  "Chen-118": "13900139002",
  "Zhao-077": "13700137003",
  "Wang-056": "13600136004",
  "Zhang-091": "13500135005",
  "Li-132": "13400134006",
  "Sun-045": "13300133007",
  "Zhou-088": "13200132008",
  "Wu-023": "13100131009"
};

const SAMPLE_AUDIOGRAMS: Record<string, { left: number[]; right: number[] }> = {
  "Liu-024": {
    left: [15, 18, 22, 35, 58, 72],
    right: [12, 16, 20, 32, 55, 68]
  },
  "Chen-118": {
    left: [10, 8, 10, 12, 15, 20],
    right: [55, 52, 48, 40, 35, 30]
  },
  "Zhao-077": {
    left: [28, 42, 48, 52, 58, 62],
    right: [26, 40, 46, 50, 54, 58]
  }
};

function now() {
  return Date.now();
}

function buildCustomerProfile(legacy: LegacyRecord, customerNo: string): CustomerProfile {
  const t = now();
  return {
    id: `cust-flow-${legacy.customerId}`,
    entityType: "customer",
    customerNo,
    name: CUSTOMER_NAME_MAP[legacy.customerId] || legacy.customerId,
    gender: legacy.customerId === "Chen-118" ? "female" : "male",
    phone: CUSTOMER_PHONE_MAP[legacy.customerId] || "13800000000",
    hearingLossType: HEARING_LOSS_MAP[legacy.hearingLossType] || "未知",
    tinnitus: false,
    vertigo: false,
    otorrhea: false,
    tags: [legacy.fittingStage],
    remark: legacy.userFeedback,
    createdAt: t - 86400000 * 30,
    updatedAt: t,
    version: 1,
    versionId: generateVersionId(),
    editedBy: "数据迁移",
    editedAt: t,
    syncStatus: "local"
  };
}

function buildAudiogram(customerId: string, legacyCustomerId: string): AudiogramRecord | null {
  const sampleData = SAMPLE_AUDIOGRAMS[legacyCustomerId];
  if (!sampleData) return null;

  const t = now();
  const leftAir = FREQUENCIES.map((f, i) => ({
    frequency: f,
    value: sampleData.left[i],
    valid: true
  }));
  const rightAir = FREQUENCIES.map((f, i) => ({
    frequency: f,
    value: sampleData.right[i],
    valid: true
  }));

  return {
    id: `aud-flow-${legacyCustomerId}`,
    entityType: "audiogram",
    customerId,
    testDate: new Date(t - 86400000 * 5).toISOString().slice(0, 10),
    tester: "张听力师",
    testEnvironment: "标准测听室",
    left: { air: leftAir, bone: JSON.parse(JSON.stringify(DEFAULT_EAR_AUDIOGRAM.bone)) },
    right: { air: rightAir, bone: JSON.parse(JSON.stringify(DEFAULT_EAR_AUDIOGRAM.bone)) },
    pta: {
      left: Math.round(sampleData.left.slice(1, 4).reduce((a, b) => a + b, 0) / 3),
      right: Math.round(sampleData.right.slice(1, 4).reduce((a, b) => a + b, 0) / 3)
    },
    createdAt: t - 86400000 * 5,
    updatedAt: t,
    version: 1,
    versionId: generateVersionId(),
    editedBy: "数据迁移",
    editedAt: t,
    syncStatus: "local"
  };
}

function buildFitting(customerId: string, legacy: LegacyRecord): FittingRecord {
  const t = now();
  return {
    id: `fit-flow-${legacy.customerId}`,
    entityType: "fitting",
    customerId,
    fittingDate: new Date(t - 86400000 * 3).toISOString().slice(0, 10),
    fitter: "张听力师",
    stage: legacy.fittingStage as FittingRecord["stage"],
    hearingAid: {
      left: { model: legacy.hearingAidModel },
      right: { model: legacy.hearingAidModel }
    },
    gainAdjustment: { binaural: legacy.gainAdjustment },
    userFeedback: legacy.userFeedback,
    nextFollowUpDate: new Date(t + 86400000 * 7).toISOString().slice(0, 10),
    createdAt: t - 86400000 * 3,
    updatedAt: t,
    version: 1,
    versionId: generateVersionId(),
    editedBy: "数据迁移",
    editedAt: t,
    syncStatus: "local"
  };
}

function buildFollowUp(customerId: string, fu: LegacyFollowUp): FollowUpRecord {
  const t = now();
  return {
    id: `fu-flow-${fu.customerId}`,
    entityType: "followup",
    customerId,
    relatedFittingId: `fit-flow-${fu.customerId}`,
    scheduledDate: fu.nextFollowUpDate,
    priority: fu.priority,
    status: fu.contactStatus === "contacted" ? "completed" : "pending",
    purpose: fu.notes,
    nextScheduledDate: fu.nextFollowUpDate,
    operator: "王助理",
    remark: fu.notes,
    createdAt: t - 86400000 * 10,
    updatedAt: t,
    version: 1,
    versionId: generateVersionId(),
    editedBy: "数据迁移",
    editedAt: t,
    syncStatus: "local"
  };
}

function buildComparison(customerId: string, legacy: LegacyRecord): ComparisonRecord {
  const t = now();
  return {
    id: `cmp-flow-${legacy.customerId}`,
    entityType: "comparison",
    customerId,
    customerName: CUSTOMER_NAME_MAP[legacy.customerId] || legacy.customerId,
    hearingLossType: legacy.hearingLossType,
    hearingAidModel: legacy.hearingAidModel,
    initial: {
      speechRecognitionRate: 60,
      feedbackWhistle: "初配后偶有啸叫",
      gainAdjustment: legacy.gainAdjustment,
      fittingStage: "初配",
      recordDate: new Date(t - 86400000 * 30).toISOString().slice(0, 10)
    },
    followUp: {
      speechRecognitionRate: 76,
      feedbackWhistle: "复调后啸叫消失",
      gainAdjustment: "优化后增益调整",
      fittingStage: legacy.fittingStage,
      recordDate: new Date(t - 86400000 * 3).toISOString().slice(0, 10)
    },
    createdAt: t,
    updatedAt: t,
    version: 1,
    versionId: generateVersionId(),
    editedBy: "数据迁移",
    editedAt: t,
    syncStatus: "local"
  };
}

export async function migrateSampleDataToArchive(
  records: LegacyRecord[],
  followUps: LegacyFollowUp[]
): Promise<number> {
  if (typeof window === "undefined") return 0;

  const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);
  if (alreadyMigrated) return 0;

  const db = getArchiveDB();
  let count = 0;

  for (const rec of records) {
    const customerNo = rec.customerId;
    const profile = buildCustomerProfile(rec, customerNo);

    try {
      await db.saveCustomer(profile, "样例数据迁移");
      count++;
    } catch (e) {
      console.warn(`迁移客户 ${customerNo} 失败:`, e);
      continue;
    }

    const customerId = profile.id;

    const audiogram = buildAudiogram(customerId, rec.customerId);
    if (audiogram) {
      try {
        await db.saveAudiogram(audiogram, "样例听力数据迁移");
      } catch (e) {
        console.warn(`迁移听力图 ${customerNo} 失败:`, e);
      }
    }

    const fitting = buildFitting(customerId, rec);
    try {
      await db.saveFitting(fitting, "样例验配数据迁移");
    } catch (e) {
      console.warn(`迁移验配记录 ${customerNo} 失败:`, e);
    }

    const comparison = buildComparison(customerId, rec);
    try {
      await db.saveComparison(comparison, "样例对比数据迁移");
    } catch (e) {
      console.warn(`迁移对比记录 ${customerNo} 失败:`, e);
    }

    const fu = followUps.find((f) => f.customerId === rec.customerId);
    if (fu) {
      const followUp = buildFollowUp(customerId, fu);
      try {
        await db.saveFollowUp(followUp, "样例复诊数据迁移");
      } catch (e) {
        console.warn(`迁移复诊记录 ${customerNo} 失败:`, e);
      }
    }
  }

  for (const fu of followUps) {
    const existingCustomerNo = fu.customerId;
    const profileId = `cust-flow-${existingCustomerNo}`;
    const alreadyHasFollowUp = records.some((r) => r.customerId === existingCustomerNo);
    if (alreadyHasFollowUp) continue;

    const profile: CustomerProfile = {
      id: profileId,
      entityType: "customer",
      customerNo: existingCustomerNo,
      name: fu.customerName,
      gender: "male",
      phone: CUSTOMER_PHONE_MAP[existingCustomerNo] || "13800000000",
      hearingLossType: "未知",
      tinnitus: false,
      vertigo: false,
      otorrhea: false,
      tags: [],
      remark: fu.notes,
      createdAt: now() - 86400000 * 60,
      updatedAt: now(),
      version: 1,
      versionId: generateVersionId(),
      editedBy: "数据迁移",
      editedAt: now(),
      syncStatus: "local"
    };

    try {
      await db.saveCustomer(profile, "样例复诊客户迁移");
      count++;
    } catch (e) {
      console.warn(`迁移复诊客户 ${existingCustomerNo} 失败:`, e);
      continue;
    }

    const followUp = buildFollowUp(profileId, fu);
    try {
      await db.saveFollowUp(followUp, "样例复诊数据迁移");
    } catch (e) {
      console.warn(`迁移复诊记录 ${existingCustomerNo} 失败:`, e);
    }
  }

  localStorage.setItem(MIGRATION_KEY, "true");
  return count;
}

export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_KEY);
}
