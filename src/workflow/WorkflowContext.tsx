import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode
} from "react";
import type {
  WorkflowState,
  WorkflowFittingRecord,
  OperationLog,
  RoleType,
  RecordStatus,
  ReviewField,
  RejectedField,
  FieldChange
} from "./workflow.types";
import {
  generateId,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  canTransition,
  KEY_REVIEW_FIELDS
} from "./workflow.types";
import { loadWorkflowState, saveWorkflowState, getCurrentUserByRole } from "./workflow.storage";

type WorkflowAction =
  | { type: "SET_ROLE"; payload: { role: RoleType } }
  | { type: "SELECT_RECORD"; payload: { recordId: string | null } }
  | { type: "CREATE_RECORD"; payload: Partial<WorkflowFittingRecord> }
  | {
      type: "UPDATE_RECORD";
      payload: {
        recordId: string;
        updates: Partial<WorkflowFittingRecord>;
        fieldChanges?: FieldChange[];
      };
    }
  | { type: "DELETE_RECORD"; payload: { recordId: string } }
  | { type: "SUBMIT_FOR_REVIEW"; payload: { recordId: string } }
  | { type: "APPROVE_REVIEW"; payload: { recordId: string; comment?: string } }
  | { type: "REJECT_REVIEW"; payload: { recordId: string; comment: string } }
  | {
      type: "REJECT_REVIEW_WITH_FIELDS";
      payload: { recordId: string; comment: string; rejectedFields: RejectedField[] };
    }
  | {
      type: "RESUBMIT_FOR_REVIEW";
      payload: {
        recordId: string;
        fieldChanges: FieldChange[];
        rejectionId: string;
        updates: Partial<WorkflowFittingRecord>;
      };
    }
  | { type: "ASSIGN_FOLLOWUP"; payload: { recordId: string; days?: number } }
  | { type: "START_FOLLOWUP"; payload: { recordId: string } }
  | { type: "COMPLETE_FOLLOWUP"; payload: { recordId: string; note: string } }
  | { type: "UPDATE_STATUS"; payload: { recordId: string; newStatus: RecordStatus } }
  | { type: "ADD_LOG"; payload: Omit<OperationLog, "id" | "timestamp"> }
  | {
      type: "UPDATE_REVIEW_FIELD";
      payload: { recordId: string; fieldName: string; hasAbnormality: boolean; note?: string };
    }
  | { type: "LOAD_STATE"; payload: WorkflowState };

const WorkflowContext = createContext<{
  state: WorkflowState;
  dispatch: React.Dispatch<WorkflowAction>;
  createRecord: (data: Partial<WorkflowFittingRecord>) => WorkflowFittingRecord;
  updateRecord: (
    recordId: string,
    updates: Partial<WorkflowFittingRecord>,
    fieldChanges?: FieldChange[]
  ) => void;
  deleteRecord: (recordId: string) => void;
  submitForReview: (recordId: string) => void;
  approveReview: (recordId: string, comment?: string) => void;
  rejectReview: (recordId: string, comment: string) => void;
  rejectReviewWithFields: (
    recordId: string,
    comment: string,
    rejectedFields: RejectedField[]
  ) => void;
  resubmitForReview: (
    recordId: string,
    fieldChanges: FieldChange[],
    rejectionId: string,
    updates: Partial<WorkflowFittingRecord>
  ) => void;
  assignFollowUp: (recordId: string, days?: number) => void;
  startFollowUp: (recordId: string) => void;
  completeFollowUp: (recordId: string, note: string) => void;
  switchRole: (role: RoleType) => void;
  selectRecord: (recordId: string | null) => void;
  updateReviewField: (
    recordId: string,
    fieldName: string,
    hasAbnormality: boolean,
    note?: string
  ) => void;
  getFilteredRecords: () => WorkflowFittingRecord[];
  getRecordLogs: (recordId: string) => OperationLog[];
  canPerformAction: (action: keyof (typeof ROLE_PERMISSIONS)[RoleType]) => boolean;
} | null>(null);

function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.payload;

    case "SET_ROLE": {
      const userName = getCurrentUserByRole(action.payload.role);
      return {
        ...state,
        currentRole: action.payload.role,
        currentUserName: userName
      };
    }

    case "SELECT_RECORD":
      return {
        ...state,
        selectedRecordId: action.payload.recordId
      };

    case "CREATE_RECORD": {
      const newRecord = action.payload as WorkflowFittingRecord;
      const now = newRecord.createdAt;

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: newRecord.id,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "创建验配记录",
        actionType: "create",
        newStatus: "draft",
        detail: `为 ${newRecord.customerName || newRecord.customerId} 创建${newRecord.fittingStage}记录`,
        timestamp: now
      };

      return {
        ...state,
        records: [newRecord, ...state.records],
        operationLogs: [newLog, ...state.operationLogs],
        selectedRecordId: newRecord.id
      };
    }

    case "UPDATE_RECORD": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record) return state;

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? { ...r, ...action.payload.updates, updatedAt: now, version: r.version + 1 }
          : r
      );

      const fieldChanges = action.payload.fieldChanges;
      const changes =
        fieldChanges && fieldChanges.length > 0
          ? fieldChanges.map((fc) => `${fc.fieldLabel}: ${fc.oldValue} → ${fc.newValue}`).join("; ")
          : Object.entries(action.payload.updates)
              .filter(([key]) => key !== "updatedAt" && key !== "version")
              .map(([key, value]) => `${key}: ${value}`)
              .join(", ");

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: fieldChanges && fieldChanges.length > 0 ? "整改修改" : "更新记录",
        actionType: fieldChanges && fieldChanges.length > 0 ? "correct" : "update",
        detail:
          fieldChanges && fieldChanges.length > 0 ? `整改修改: ${changes}` : `更新字段: ${changes}`,
        timestamp: now,
        fieldChanges: fieldChanges
      };

      return {
        ...state,
        records: updatedRecords,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    case "DELETE_RECORD": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record) return state;

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "删除记录",
        actionType: "update",
        detail: `删除 ${record.customerName || record.customerId} 的验配记录`,
        timestamp: now
      };

      return {
        ...state,
        records: state.records.filter((r) => r.id !== action.payload.recordId),
        operationLogs: [newLog, ...state.operationLogs],
        selectedRecordId:
          state.selectedRecordId === action.payload.recordId ? null : state.selectedRecordId
      };
    }

    case "SUBMIT_FOR_REVIEW": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record || !canTransition(record.status, "pending_review", state.currentRole))
        return state;

      const hasUnresolvedRejection = (record.rejectionHistory || []).some(
        (rh) => !rh.resubmittedAt
      );
      if (hasUnresolvedRejection) return state;

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? {
              ...r,
              status: "pending_review" as RecordStatus,
              submittedAt: now,
              updatedAt: now,
              version: r.version + 1
            }
          : r
      );

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "提交审核",
        actionType: "submit",
        oldStatus: record.status,
        newStatus: "pending_review",
        detail: "记录填写完成，提交主管审核",
        timestamp: now
      };

      return {
        ...state,
        records: updatedRecords,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    case "APPROVE_REVIEW": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record || !canTransition(record.status, "review_approved", state.currentRole))
        return state;

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? {
              ...r,
              status: "review_approved" as RecordStatus,
              reviewedAt: now,
              reviewedBy: state.currentUserName,
              reviewComment: action.payload.comment,
              updatedAt: now,
              version: r.version + 1
            }
          : r
      );

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "审核通过",
        actionType: "approve",
        oldStatus: record.status,
        newStatus: "review_approved",
        detail: action.payload.comment || "审核通过",
        timestamp: now
      };

      return {
        ...state,
        records: updatedRecords,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    case "REJECT_REVIEW": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record || !canTransition(record.status, "review_rejected", state.currentRole))
        return state;

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? {
              ...r,
              status: "review_rejected" as RecordStatus,
              reviewedAt: now,
              reviewedBy: state.currentUserName,
              reviewComment: action.payload.comment,
              updatedAt: now,
              version: r.version + 1
            }
          : r
      );

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "审核驳回",
        actionType: "reject",
        oldStatus: record.status,
        newStatus: "review_rejected",
        detail: action.payload.comment,
        timestamp: now
      };

      return {
        ...state,
        records: updatedRecords,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    case "REJECT_REVIEW_WITH_FIELDS": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record || !canTransition(record.status, "review_rejected", state.currentRole))
        return state;

      const rejectionId = generateId("rej");
      const rejectionRecord = {
        id: rejectionId,
        rejectionId,
        rejectedBy: state.currentUserName,
        rejectedAt: now,
        overallComment: action.payload.comment,
        rejectedFields: action.payload.rejectedFields
      };

      const updatedReviewFields = record.reviewFields.map((field) => {
        const rejected = action.payload.rejectedFields.find(
          (rf) => rf.fieldName === field.fieldName
        );
        if (rejected) {
          return {
            ...field,
            hasAbnormality: true,
            abnormalityNote: rejected.rejectReason
          };
        }
        return field;
      });

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? {
              ...r,
              status: "review_rejected" as RecordStatus,
              reviewedAt: now,
              reviewedBy: state.currentUserName,
              reviewComment: action.payload.comment,
              reviewFields: updatedReviewFields,
              rejectionHistory: [...(r.rejectionHistory || []), rejectionRecord],
              updatedAt: now,
              version: r.version + 1
            }
          : r
      );

      const fieldSummary = action.payload.rejectedFields
        .map((f) => `${f.fieldLabel}: ${f.rejectReason}`)
        .join("; ");

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "审核驳回",
        actionType: "reject",
        oldStatus: record.status,
        newStatus: "review_rejected",
        detail: `${action.payload.comment} | 异常字段: ${fieldSummary}`,
        timestamp: now,
        rejectionId
      };

      return {
        ...state,
        records: updatedRecords,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    case "RESUBMIT_FOR_REVIEW": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record) return state;
      if (record.status !== "review_rejected" && record.status !== "draft") return state;

      const { fieldChanges, rejectionId, updates } = action.payload;

      const updatedRejectionHistory = (record.rejectionHistory || []).map((rh) => {
        if (rh.rejectionId === rejectionId) {
          return {
            ...rh,
            correctionStartedAt: rh.correctionStartedAt || now,
            correctedBy: state.currentUserName,
            correctedAt: now,
            correctionFields: fieldChanges.map((fc) => ({
              fieldName: fc.fieldName,
              fieldLabel: fc.fieldLabel,
              oldValue: fc.oldValue,
              newValue: fc.newValue
            })),
            resubmittedAt: now
          };
        }
        return rh;
      });

      const clearedReviewFields = record.reviewFields.map((field) => ({
        ...field,
        hasAbnormality: false,
        abnormalityNote: undefined
      }));

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? {
              ...r,
              ...updates,
              status: "pending_review" as RecordStatus,
              submittedAt: now,
              reviewFields: clearedReviewFields,
              rejectionHistory: updatedRejectionHistory,
              updatedAt: now,
              version: r.version + 1
            }
          : r
      );

      const changesSummary = fieldChanges
        .map((fc) => `${fc.fieldLabel}: ${fc.oldValue} → ${fc.newValue}`)
        .join("; ");

      const rejection = (record.rejectionHistory || []).find(
        (rh) => rh.rejectionId === rejectionId
      );
      const linkDetail = rejection
        ? `原驳回原因: ${rejection.overallComment} | 修改内容: ${changesSummary}`
        : `整改后重新提交 | 修改内容: ${changesSummary}`;

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "整改后重新提交",
        actionType: "resubmit",
        oldStatus: record.status,
        newStatus: "pending_review",
        detail: linkDetail,
        timestamp: now,
        rejectionId,
        fieldChanges
      };

      return {
        ...state,
        records: updatedRecords,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    case "ASSIGN_FOLLOWUP": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record || !canTransition(record.status, "pending_followup", state.currentRole))
        return state;

      const days = action.payload.days ?? record.followUpDays ?? 7;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + days);
      const nextFollowUpDate = nextDate.toISOString().slice(0, 10);

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? {
              ...r,
              status: "pending_followup" as RecordStatus,
              followUpDays: days,
              nextFollowUpDate,
              followUpAssignedTo: getCurrentUserByRole("assistant"),
              updatedAt: now,
              version: r.version + 1
            }
          : r
      );

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "分配跟进",
        actionType: "assign",
        oldStatus: record.status,
        newStatus: "pending_followup",
        detail: `分配给${getCurrentUserByRole("assistant")}跟进，复诊天数: ${days}天`,
        timestamp: now
      };

      return {
        ...state,
        records: updatedRecords,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    case "START_FOLLOWUP": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record || !canTransition(record.status, "followup_in_progress", state.currentRole))
        return state;

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? {
              ...r,
              status: "followup_in_progress" as RecordStatus,
              followUpStartedAt: now,
              updatedAt: now,
              version: r.version + 1
            }
          : r
      );

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "开始跟进",
        actionType: "followup",
        oldStatus: record.status,
        newStatus: "followup_in_progress",
        detail: "已开始客户跟进",
        timestamp: now
      };

      return {
        ...state,
        records: updatedRecords,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    case "COMPLETE_FOLLOWUP": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record || !canTransition(record.status, "completed", state.currentRole)) return state;

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? {
              ...r,
              status: "completed" as RecordStatus,
              followUpCompletedAt: now,
              followUpNote: action.payload.note,
              updatedAt: now,
              version: r.version + 1
            }
          : r
      );

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "完成跟进",
        actionType: "complete",
        oldStatus: record.status,
        newStatus: "completed",
        detail: action.payload.note,
        timestamp: now
      };

      return {
        ...state,
        records: updatedRecords,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    case "UPDATE_STATUS": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record) return state;

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? { ...r, status: action.payload.newStatus, updatedAt: now, version: r.version + 1 }
          : r
      );

      const newLog: OperationLog = {
        id: generateId("log"),
        recordId: action.payload.recordId,
        operatorRole: state.currentRole,
        operatorName: state.currentUserName,
        action: "状态变更",
        actionType: "status_change",
        oldStatus: record.status,
        newStatus: action.payload.newStatus,
        timestamp: now
      };

      return {
        ...state,
        records: updatedRecords,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    case "UPDATE_REVIEW_FIELD": {
      const now = Date.now();
      const record = state.records.find((r) => r.id === action.payload.recordId);
      if (!record) return state;

      const updatedReviewFields = record.reviewFields.map((field) =>
        field.fieldName === action.payload.fieldName
          ? {
              ...field,
              hasAbnormality: action.payload.hasAbnormality,
              abnormalityNote: action.payload.note
            }
          : field
      );

      const updatedRecords = state.records.map((r) =>
        r.id === action.payload.recordId
          ? { ...r, reviewFields: updatedReviewFields, updatedAt: now, version: r.version + 1 }
          : r
      );

      return {
        ...state,
        records: updatedRecords
      };
    }

    case "ADD_LOG": {
      const newLog: OperationLog = {
        id: generateId("log"),
        timestamp: Date.now(),
        ...action.payload
      };
      return {
        ...state,
        operationLogs: [newLog, ...state.operationLogs]
      };
    }

    default:
      return state;
  }
}

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workflowReducer, null, () => {
    if (typeof window !== "undefined") {
      return loadWorkflowState();
    }
    return {
      currentRole: "audiologist" as RoleType,
      currentUserName: "张听力师",
      records: [],
      operationLogs: [],
      selectedRecordId: null
    };
  });

  useEffect(() => {
    saveWorkflowState(state);
  }, [state]);

  const createRecord = useCallback(
    (data: Partial<WorkflowFittingRecord>): WorkflowFittingRecord => {
      const now = Date.now();
      const today = new Date().toISOString().slice(0, 10);
      const addDays = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
      };

      const defaultReviewFields: ReviewField[] = KEY_REVIEW_FIELDS.map((fieldName) => {
        const labels: Record<string, string> = {
          hearingLossType: "听损类型",
          hearingAidModel: "助听器型号",
          gainAdjustment: "增益调整",
          speechRecognitionRate: "言语识别率",
          leftPta: "左耳PTA",
          rightPta: "右耳PTA"
        };
        return {
          fieldName,
          fieldLabel: labels[fieldName] || fieldName,
          isKey: true,
          hasAbnormality: false
        };
      });

      const newRecord: WorkflowFittingRecord = {
        id: generateId("rec"),
        customerId: data.customerId || `CUST-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        customerName: data.customerName || "",
        phone: data.phone || "",
        hearingLossType: data.hearingLossType || "",
        fittingStage: data.fittingStage || "初配",
        hearingAidModel: data.hearingAidModel || "",
        gainAdjustment: data.gainAdjustment || "",
        userFeedback: data.userFeedback || "",
        speechRecognitionRate: data.speechRecognitionRate || 0,
        leftPta: data.leftPta || 0,
        rightPta: data.rightPta || 0,
        status: "draft",
        priority: data.priority || "medium",
        followUpDays: data.followUpDays || 7,
        nextFollowUpDate: data.nextFollowUpDate || addDays(7),
        createdBy: state.currentUserName,
        createdAt: now,
        updatedAt: now,
        version: 1,
        reviewFields: defaultReviewFields,
        rejectionHistory: []
      };

      dispatch({ type: "CREATE_RECORD", payload: newRecord });
      return newRecord;
    },
    [state.currentUserName]
  );

  const updateRecord = useCallback(
    (recordId: string, updates: Partial<WorkflowFittingRecord>, fieldChanges?: FieldChange[]) => {
      dispatch({ type: "UPDATE_RECORD", payload: { recordId, updates, fieldChanges } });
    },
    []
  );

  const deleteRecord = useCallback((recordId: string) => {
    dispatch({ type: "DELETE_RECORD", payload: { recordId } });
  }, []);

  const submitForReview = useCallback((recordId: string) => {
    dispatch({ type: "SUBMIT_FOR_REVIEW", payload: { recordId } });
  }, []);

  const approveReview = useCallback((recordId: string, comment?: string) => {
    dispatch({ type: "APPROVE_REVIEW", payload: { recordId, comment } });
  }, []);

  const rejectReview = useCallback((recordId: string, comment: string) => {
    dispatch({ type: "REJECT_REVIEW", payload: { recordId, comment } });
  }, []);

  const rejectReviewWithFields = useCallback(
    (recordId: string, comment: string, rejectedFields: RejectedField[]) => {
      dispatch({
        type: "REJECT_REVIEW_WITH_FIELDS",
        payload: { recordId, comment, rejectedFields }
      });
    },
    []
  );

  const resubmitForReview = useCallback(
    (
      recordId: string,
      fieldChanges: FieldChange[],
      rejectionId: string,
      updates: Partial<WorkflowFittingRecord>
    ) => {
      dispatch({
        type: "RESUBMIT_FOR_REVIEW",
        payload: { recordId, fieldChanges, rejectionId, updates }
      });
    },
    []
  );

  const assignFollowUp = useCallback((recordId: string, days?: number) => {
    dispatch({ type: "ASSIGN_FOLLOWUP", payload: { recordId, days } });
  }, []);

  const startFollowUp = useCallback((recordId: string) => {
    dispatch({ type: "START_FOLLOWUP", payload: { recordId } });
  }, []);

  const completeFollowUp = useCallback((recordId: string, note: string) => {
    dispatch({ type: "COMPLETE_FOLLOWUP", payload: { recordId, note } });
  }, []);

  const switchRole = useCallback((role: RoleType) => {
    dispatch({ type: "SET_ROLE", payload: { role } });
  }, []);

  const selectRecord = useCallback((recordId: string | null) => {
    dispatch({ type: "SELECT_RECORD", payload: { recordId } });
  }, []);

  const updateReviewField = useCallback(
    (recordId: string, fieldName: string, hasAbnormality: boolean, note?: string) => {
      dispatch({
        type: "UPDATE_REVIEW_FIELD",
        payload: { recordId, fieldName, hasAbnormality, note }
      });
    },
    []
  );

  const getFilteredRecords = useCallback(() => {
    const permissions = ROLE_PERMISSIONS[state.currentRole];
    if (permissions.canViewAllRecords) {
      return state.records.filter((r) => permissions.visibleStatuses.includes(r.status));
    }
    return state.records.filter(
      (r) =>
        permissions.visibleStatuses.includes(r.status) &&
        (r.followUpAssignedTo === state.currentUserName || r.status === "pending_followup")
    );
  }, [state.records, state.currentRole, state.currentUserName]);

  const getRecordLogs = useCallback(
    (recordId: string) => {
      return state.operationLogs
        .filter((log) => log.recordId === recordId)
        .sort((a, b) => b.timestamp - a.timestamp);
    },
    [state.operationLogs]
  );

  const canPerformAction = useCallback(
    (action: keyof (typeof ROLE_PERMISSIONS)[RoleType]) => {
      const permissions = ROLE_PERMISSIONS[state.currentRole];
      return permissions[action] as boolean;
    },
    [state.currentRole]
  );

  return (
    <WorkflowContext.Provider
      value={{
        state,
        dispatch,
        createRecord,
        updateRecord,
        deleteRecord,
        submitForReview,
        approveReview,
        rejectReview,
        rejectReviewWithFields,
        resubmitForReview,
        assignFollowUp,
        startFollowUp,
        completeFollowUp,
        switchRole,
        selectRecord,
        updateReviewField,
        getFilteredRecords,
        getRecordLogs,
        canPerformAction
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  }
  return context;
}
