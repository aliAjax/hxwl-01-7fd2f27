import type {
  CustomerProfile,
  AudiogramRecord,
  FittingRecord,
  FollowUpRecord,
  EntityType
} from "./archive.types";

export type DiffChangeType = "added" | "removed" | "modified" | "unchanged";

export interface FieldDiffItem {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: DiffChangeType;
  group?: string;
}

export interface DiffResult {
  fields: FieldDiffItem[];
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
}

export interface FieldConfig {
  key: string;
  label: string;
  group?: string;
  nested?: boolean;
  nestedFields?: FieldConfig[];
}

const customerFields: FieldConfig[] = [
  { key: "name", label: "姓名", group: "基本信息" },
  { key: "customerNo", label: "客户编号", group: "基本信息" },
  { key: "gender", label: "性别", group: "基本信息" },
  { key: "birthDate", label: "出生日期", group: "基本信息" },
  { key: "age", label: "年龄", group: "基本信息" },
  { key: "phone", label: "联系电话", group: "联系方式" },
  { key: "email", label: "电子邮箱", group: "联系方式" },
  { key: "address", label: "住址", group: "联系方式" },
  { key: "occupation", label: "职业", group: "个人信息" },
  { key: "hearingLossType", label: "听损类型", group: "听力信息" },
  { key: "hearingLossOnsetDate", label: "听损发病日期", group: "听力信息" },
  { key: "medicalHistory", label: "既往病史", group: "健康信息" },
  { key: "earSurgeryHistory", label: "耳部手术史", group: "健康信息" },
  { key: "tinnitus", label: "耳鸣", group: "健康信息" },
  { key: "vertigo", label: "眩晕", group: "健康信息" },
  { key: "otorrhea", label: "耳漏", group: "健康信息" },
  { key: "allergies", label: "过敏史", group: "健康信息" },
  { key: "tags", label: "标签", group: "其他" },
  { key: "remark", label: "备注", group: "其他" }
];

const audiogramFields: FieldConfig[] = [
  { key: "testDate", label: "测试日期", group: "基本信息" },
  { key: "tester", label: "测试人员", group: "基本信息" },
  { key: "testEnvironment", label: "测试环境", group: "基本信息" },
  { key: "left", label: "左耳", group: "听力数据", nested: true, nestedFields: [
    { key: "air", label: "气导", nested: true, nestedFields: [
      { key: "250", label: "250Hz" },
      { key: "500", label: "500Hz" },
      { key: "1000", label: "1000Hz" },
      { key: "2000", label: "2000Hz" },
      { key: "4000", label: "4000Hz" },
      { key: "8000", label: "8000Hz" }
    ]},
    { key: "bone", label: "骨导", nested: true, nestedFields: [
      { key: "250", label: "250Hz" },
      { key: "500", label: "500Hz" },
      { key: "1000", label: "1000Hz" },
      { key: "2000", label: "2000Hz" },
      { key: "4000", label: "4000Hz" },
      { key: "8000", label: "8000Hz" }
    ]}
  ]},
  { key: "right", label: "右耳", group: "听力数据", nested: true, nestedFields: [
    { key: "air", label: "气导", nested: true, nestedFields: [
      { key: "250", label: "250Hz" },
      { key: "500", label: "500Hz" },
      { key: "1000", label: "1000Hz" },
      { key: "2000", label: "2000Hz" },
      { key: "4000", label: "4000Hz" },
      { key: "8000", label: "8000Hz" }
    ]},
    { key: "bone", label: "骨导", nested: true, nestedFields: [
      { key: "250", label: "250Hz" },
      { key: "500", label: "500Hz" },
      { key: "1000", label: "1000Hz" },
      { key: "2000", label: "2000Hz" },
      { key: "4000", label: "4000Hz" },
      { key: "8000", label: "8000Hz" }
    ]}
  ]},
  { key: "speechRecognitionScore", label: "言语识别率", group: "言语测听", nested: true, nestedFields: [
    { key: "left", label: "左耳" },
    { key: "right", label: "右耳" },
    { key: "binaural", label: "双耳" }
  ]},
  { key: "impedance", label: "阻抗测试", group: "其他检查", nested: true, nestedFields: [
    { key: "left", label: "左耳" },
    { key: "right", label: "右耳" }
  ]},
  { key: "pta", label: "纯音听阈均值", group: "统计数据", nested: true, nestedFields: [
    { key: "left", label: "左耳PTA" },
    { key: "right", label: "右耳PTA" }
  ]},
  { key: "remark", label: "备注", group: "其他" }
];

const fittingFields: FieldConfig[] = [
  { key: "fittingDate", label: "验配日期", group: "基本信息" },
  { key: "fitter", label: "验配师", group: "基本信息" },
  { key: "stage", label: "验配阶段", group: "基本信息" },
  { key: "audiogramId", label: "关联听力图", group: "基本信息" },
  { key: "hearingAid", label: "助听器", group: "助听器信息", nested: true, nestedFields: [
    { key: "left", label: "左耳", nested: true, nestedFields: [
      { key: "brand", label: "品牌" },
      { key: "model", label: "型号" },
      { key: "type", label: "类型" },
      { key: "serialNo", label: "序列号" }
    ]},
    { key: "right", label: "右耳", nested: true, nestedFields: [
      { key: "brand", label: "品牌" },
      { key: "model", label: "型号" },
      { key: "type", label: "类型" },
      { key: "serialNo", label: "序列号" }
    ]}
  ]},
  { key: "earMold", label: "耳模", group: "助听器信息", nested: true, nestedFields: [
    { key: "left", label: "左耳" },
    { key: "right", label: "右耳" }
  ]},
  { key: "gainAdjustment", label: "增益调整", group: "调试参数", nested: true, nestedFields: [
    { key: "left", label: "左耳" },
    { key: "right", label: "右耳" },
    { key: "binaural", label: "双耳" }
  ]},
  { key: "programSettings", label: "程序设置", group: "调试参数" },
  { key: "noiseManagement", label: "噪音管理", group: "调试参数" },
  { key: "feedbackSuppression", label: "反馈抑制", group: "调试参数" },
  { key: "wirelessConnectivity", label: "无线连接", group: "功能设置" },
  { key: "userFeedback", label: "用户反馈", group: "效果评估" },
  { key: "selfAssessment", label: "自我评估", group: "效果评估", nested: true, nestedFields: [
    { key: "satisfaction", label: "满意度" },
    { key: "soundQuality", label: "音质" },
    { key: "comfort", label: "舒适度" },
    { key: "appearance", label: "外观" }
  ]},
  { key: "nextFollowUpDate", label: "下次复诊日期", group: "随访计划" },
  { key: "remark", label: "备注", group: "其他" }
];

const followUpFields: FieldConfig[] = [
  { key: "scheduledDate", label: "预约日期", group: "基本信息" },
  { key: "actualDate", label: "实际日期", group: "基本信息" },
  { key: "priority", label: "优先级", group: "基本信息" },
  { key: "status", label: "状态", group: "基本信息" },
  { key: "relatedFittingId", label: "关联验配记录", group: "基本信息" },
  { key: "purpose", label: "复诊目的", group: "复诊内容" },
  { key: "contactMethod", label: "联系方式", group: "复诊内容" },
  { key: "result", label: "复诊结果", group: "复诊内容" },
  { key: "actionsTaken", label: "处理措施", group: "复诊内容" },
  { key: "nextScheduledDate", label: "下次预约日期", group: "后续计划" },
  { key: "operator", label: "操作人员", group: "其他" },
  { key: "remark", label: "备注", group: "其他" }
];

export const ENTITY_FIELD_CONFIGS: Record<EntityType, FieldConfig[]> = {
  customer: customerFields,
  audiogram: audiogramFields,
  fitting: fittingFields,
  followup: followUpFields,
  comparison: customerFields
};

function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const found = (current as Array<{ frequency?: number; value?: unknown }>).find(
        (item) => String(item.frequency) === key || String(item.value) === key
      );
      if (found && "value" in found) {
        current = found.value;
      } else {
        current = undefined;
      }
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return true;
  return false;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function expandFields(
  fields: FieldConfig[],
  prefix = "",
  parentGroup?: string,
  parentLabel = ""
): { key: string; label: string; group?: string }[] {
  const result: { key: string; label: string; group?: string }[] = [];
  for (const field of fields) {
    const fullKey = prefix ? `${prefix}.${field.key}` : field.key;
    const currentGroup = field.group || parentGroup;
    const currentLabel = parentLabel ? `${parentLabel} · ${field.label}` : field.label;
    if (field.nested && field.nestedFields) {
      result.push(...expandFields(field.nestedFields, fullKey, currentGroup, currentLabel));
    } else {
      result.push({ key: fullKey, label: currentLabel, group: currentGroup });
    }
  }
  return result;
}

export function computeVersionDiff(
  oldData: unknown,
  newData: unknown,
  entityType: EntityType
): DiffResult {
  const configs = ENTITY_FIELD_CONFIGS[entityType] || [];
  const flatFields = expandFields(configs);
  const fields: FieldDiffItem[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;

  for (const field of flatFields) {
    const oldVal = getNestedValue(oldData, field.key);
    const newVal = getNestedValue(newData, field.key);
    const oldEmpty = isEmptyValue(oldVal);
    const newEmpty = isEmptyValue(newVal);

    let changeType: DiffChangeType;
    if (oldEmpty && !newEmpty) {
      changeType = "added";
      addedCount++;
    } else if (!oldEmpty && newEmpty) {
      changeType = "removed";
      removedCount++;
    } else if (!valuesEqual(oldVal, newVal)) {
      changeType = "modified";
      modifiedCount++;
    } else {
      changeType = "unchanged";
      unchangedCount++;
    }

    fields.push({
      field: field.key,
      label: field.label,
      oldValue: oldVal,
      newValue: newVal,
      changeType,
      group: field.group
    });
  }

  return { fields, addedCount, removedCount, modifiedCount, unchangedCount };
}

export function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((v) => {
      if (typeof v === "object" && v !== null && "frequency" in v && "value" in v) {
        return `${v.frequency}Hz: ${v.value ?? "—"}`;
      }
      return String(v);
    }).join("; ");
  }
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function groupByGroup(fields: FieldDiffItem[]): Record<string, FieldDiffItem[]> {
  const groups: Record<string, FieldDiffItem[]> = {};
  for (const field of fields) {
    const group = field.group || "其他";
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(field);
  }
  return groups;
}
