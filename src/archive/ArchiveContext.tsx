import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useMemo
} from "react";
import { getArchiveDB, type ArchiveStats, type SearchFilter } from "./archive.storage";
import type {
  ArchiveEntity,
  AudiogramRecord,
  ComparisonRecord,
  ConflictDiff,
  CustomerAggregate,
  CustomerProfile,
  EntityType,
  FollowUpRecord,
  FittingRecord,
  VersionSnapshot
} from "./archive.types";
import { generateVersionId } from "./archive.types";

type LoadingState = "idle" | "loading" | "loaded" | "error";

interface ArchiveContextValue {
  loading: LoadingState;
  error: string | null;
  customers: CustomerProfile[];
  stats: ArchiveStats | null;
  selectedCustomerId: string | null;
  aggregate: CustomerAggregate | null;
  versions: VersionSnapshot[];
  conflictDiffs: ConflictDiff[];
  listCustomers: (filter?: SearchFilter) => Promise<void>;
  selectCustomer: (id: string | null) => Promise<void>;
  createCustomer: (c: Partial<CustomerProfile>) => Promise<CustomerProfile>;
  updateCustomer: (c: CustomerProfile, changeNote?: string) => Promise<CustomerProfile>;
  deleteCustomer: (id: string) => Promise<void>;
  createAudiogram: (a: Partial<AudiogramRecord>) => Promise<AudiogramRecord>;
  updateAudiogram: (a: AudiogramRecord, changeNote?: string) => Promise<AudiogramRecord>;
  deleteAudiogram: (id: string) => Promise<void>;
  createFitting: (f: Partial<FittingRecord>) => Promise<FittingRecord>;
  updateFitting: (f: FittingRecord, changeNote?: string) => Promise<FittingRecord>;
  deleteFitting: (id: string) => Promise<void>;
  createFollowUp: (f: Partial<FollowUpRecord>) => Promise<FollowUpRecord>;
  updateFollowUp: (f: FollowUpRecord, changeNote?: string) => Promise<FollowUpRecord>;
  deleteFollowUp: (id: string) => Promise<void>;
  createComparison: (c: Partial<ComparisonRecord>) => Promise<ComparisonRecord>;
  updateComparison: (c: ComparisonRecord, changeNote?: string) => Promise<ComparisonRecord>;
  deleteComparison: (id: string) => Promise<void>;
  getLatestComparison: (customerId: string) => Promise<ComparisonRecord | null>;
  loadVersions: (entityId: string) => Promise<void>;
  revertToVersion: (
    entityType: EntityType,
    entityId: string,
    versionId: string,
    note?: string
  ) => Promise<void>;
  simulateConflict: (customerId: string) => Promise<void>;
  computeConflictDiff: (customerId: string) => Promise<ConflictDiff[]>;
  resolveConflict: (
    entityType: EntityType,
    entityId: string,
    resolution: "local" | "remote" | "merge",
    merged?: ArchiveEntity
  ) => Promise<void>;
  refreshStats: () => Promise<void>;
  seedData: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const ArchiveContext = createContext<ArchiveContextValue | null>(null);

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const db = useMemo(() => getArchiveDB(), []);
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [aggregate, setAggregate] = useState<CustomerAggregate | null>(null);
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [conflictDiffs, setConflictDiffs] = useState<ConflictDiff[]>([]);

  const refreshStats = useCallback(async () => {
    try {
      const s = await db.getStats();
      setStats(s);
    } catch (e) {
      console.warn("stats error", e);
    }
  }, [db]);

  const listCustomers = useCallback(
    async (filter?: SearchFilter) => {
      setLoading("loading");
      try {
        const list = await db.listCustomers(filter);
        setCustomers(list);
        setLoading("loaded");
      } catch (e) {
        setError((e as Error).message);
        setLoading("error");
      }
    },
    [db]
  );

  const selectCustomer = useCallback(
    async (id: string | null) => {
      setSelectedCustomerId(id);
      if (!id) {
        setAggregate(null);
        setVersions([]);
        setConflictDiffs([]);
        return;
      }
      setLoading("loading");
      try {
        const agg = await db.getCustomerAggregate(id);
        setAggregate(agg);
        const v = await db.getVersions(id);
        setVersions(v);
        setLoading("loaded");
      } catch (e) {
        setError((e as Error).message);
        setLoading("error");
      }
    },
    [db]
  );

  const createCustomer = useCallback(
    async (c: Partial<CustomerProfile>): Promise<CustomerProfile> => {
      const now = Date.now();
      const versionId = generateVersionId();
      const base = {
        entityType: "customer" as const,
        createdAt: now,
        updatedAt: now,
        version: 1,
        versionId,
        editedBy: "当前用户",
        editedAt: now,
        syncStatus: "local" as const,
        hearingLossType: "未知" as const,
        gender: "male" as const,
        tinnitus: false,
        vertigo: false,
        otorrhea: false,
        customerNo: `C${String(Math.floor(Math.random() * 9000) + 1000)}`
      };
      const merged: CustomerProfile = {
        ...base,
        ...c,
        id: c.id || `cust-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      } as CustomerProfile;
      const saved = await db.saveCustomer(merged, "创建档案");
      await listCustomers();
      await refreshStats();
      return saved;
    },
    [db, listCustomers, refreshStats]
  );

  const updateCustomer = useCallback(
    async (c: CustomerProfile, changeNote?: string): Promise<CustomerProfile> => {
      const bumped: CustomerProfile = {
        ...c,
        version: c.version + 1,
        parentVersionId: c.versionId,
        versionId: generateVersionId(),
        editedBy: "当前用户",
        editedAt: Date.now()
      };
      const saved = await db.saveCustomer(bumped, changeNote);
      await listCustomers();
      if (selectedCustomerId === saved.id) {
        await selectCustomer(saved.id);
      }
      await refreshStats();
      return saved;
    },
    [db, listCustomers, selectedCustomerId, selectCustomer, refreshStats]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      await db.deleteCustomer(id);
      if (selectedCustomerId === id) {
        await selectCustomer(null);
      }
      await listCustomers();
      await refreshStats();
    },
    [db, selectedCustomerId, selectCustomer, listCustomers, refreshStats]
  );

  const createAudiogram = useCallback(
    async (a: Partial<AudiogramRecord>): Promise<AudiogramRecord> => {
      const now = Date.now();
      const merged: AudiogramRecord = {
        entityType: "audiogram",
        customerId: a.customerId || "",
        testDate: a.testDate || new Date().toISOString().slice(0, 10),
        left: a.left || { air: [], bone: [] },
        right: a.right || { air: [], bone: [] },
        id: a.id || `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
        version: 1,
        versionId: generateVersionId(),
        editedBy: "当前用户",
        editedAt: now,
        syncStatus: "local",
        ...a
      } as AudiogramRecord;
      const saved = await db.saveAudiogram(merged, "创建听力记录");
      if (selectedCustomerId === merged.customerId) {
        await selectCustomer(merged.customerId);
      }
      await refreshStats();
      return saved;
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const createFitting = useCallback(
    async (f: Partial<FittingRecord>): Promise<FittingRecord> => {
      const now = Date.now();
      const merged: FittingRecord = {
        entityType: "fitting",
        customerId: f.customerId || "",
        fittingDate: f.fittingDate || new Date().toISOString().slice(0, 10),
        stage: f.stage || "初配",
        hearingAid: f.hearingAid || {},
        id: f.id || `fit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
        version: 1,
        versionId: generateVersionId(),
        editedBy: "当前用户",
        editedAt: now,
        syncStatus: "local",
        ...f
      } as FittingRecord;
      const saved = await db.saveFitting(merged, "创建验配记录");
      if (selectedCustomerId === merged.customerId) {
        await selectCustomer(merged.customerId);
      }
      await refreshStats();
      return saved;
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const createFollowUp = useCallback(
    async (f: Partial<FollowUpRecord>): Promise<FollowUpRecord> => {
      const now = Date.now();
      const merged: FollowUpRecord = {
        entityType: "followup",
        customerId: f.customerId || "",
        scheduledDate: f.scheduledDate || new Date().toISOString().slice(0, 10),
        priority: f.priority || "medium",
        status: f.status || "pending",
        id: f.id || `fu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
        version: 1,
        versionId: generateVersionId(),
        editedBy: "当前用户",
        editedAt: now,
        syncStatus: "local",
        ...f
      } as FollowUpRecord;
      const saved = await db.saveFollowUp(merged, "创建复诊记录");
      if (selectedCustomerId === merged.customerId) {
        await selectCustomer(merged.customerId);
      }
      await refreshStats();
      return saved;
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const updateAudiogram = useCallback(
    async (a: AudiogramRecord, changeNote?: string): Promise<AudiogramRecord> => {
      const saved = await db.updateAudiogram(a, changeNote);
      if (selectedCustomerId === saved.customerId) {
        await selectCustomer(saved.customerId);
      }
      await refreshStats();
      return saved;
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const updateFitting = useCallback(
    async (f: FittingRecord, changeNote?: string): Promise<FittingRecord> => {
      const saved = await db.updateFitting(f, changeNote);
      if (selectedCustomerId === saved.customerId) {
        await selectCustomer(saved.customerId);
      }
      await refreshStats();
      return saved;
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const updateFollowUp = useCallback(
    async (f: FollowUpRecord, changeNote?: string): Promise<FollowUpRecord> => {
      const saved = await db.updateFollowUp(f, changeNote);
      if (selectedCustomerId === saved.customerId) {
        await selectCustomer(saved.customerId);
      }
      await refreshStats();
      return saved;
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const deleteAudiogram = useCallback(
    async (id: string) => {
      const a = await db.getAudiogram(id);
      await db.deleteAudiogram(id);
      if (a && selectedCustomerId === a.customerId) {
        await selectCustomer(a.customerId);
      }
      await refreshStats();
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const deleteFitting = useCallback(
    async (id: string) => {
      const f = await db.getFitting(id);
      await db.deleteFitting(id);
      if (f && selectedCustomerId === f.customerId) {
        await selectCustomer(f.customerId);
      }
      await refreshStats();
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const deleteFollowUp = useCallback(
    async (id: string) => {
      const f = await db.getFollowUp(id);
      await db.deleteFollowUp(id);
      if (f && selectedCustomerId === f.customerId) {
        await selectCustomer(f.customerId);
      }
      await refreshStats();
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const createComparison = useCallback(
    async (c: Partial<ComparisonRecord>): Promise<ComparisonRecord> => {
      const now = Date.now();
      const merged: ComparisonRecord = {
        entityType: "comparison",
        customerId: c.customerId || "",
        initial: c.initial || { speechRecognitionRate: null, feedbackWhistle: "", gainAdjustment: "", fittingStage: "初配" },
        followUp: c.followUp || { speechRecognitionRate: null, feedbackWhistle: "", gainAdjustment: "", fittingStage: "复调" },
        id: c.id || `cmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
        version: 1,
        versionId: generateVersionId(),
        editedBy: "当前用户",
        editedAt: now,
        syncStatus: "local",
        ...c
      } as ComparisonRecord;
      const saved = await db.saveComparison(merged, "创建对比记录");
      if (selectedCustomerId === merged.customerId) {
        await selectCustomer(merged.customerId);
      }
      await refreshStats();
      return saved;
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const updateComparison = useCallback(
    async (c: ComparisonRecord, changeNote?: string): Promise<ComparisonRecord> => {
      const saved = await db.updateComparison(c, changeNote);
      if (selectedCustomerId === saved.customerId) {
        await selectCustomer(saved.customerId);
      }
      await refreshStats();
      return saved;
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const deleteComparison = useCallback(
    async (id: string) => {
      const c = await db.getComparison(id);
      await db.deleteComparison(id);
      if (c && selectedCustomerId === c.customerId) {
        await selectCustomer(c.customerId);
      }
      await refreshStats();
    },
    [db, selectedCustomerId, selectCustomer, refreshStats]
  );

  const getLatestComparison = useCallback(
    async (customerId: string): Promise<ComparisonRecord | null> => {
      return await db.getLatestComparisonByCustomer(customerId);
    },
    [db]
  );

  const loadVersions = useCallback(
    async (entityId: string) => {
      const v = await db.getVersions(entityId);
      setVersions(v);
    },
    [db]
  );

  const revertToVersion = useCallback(
    async (entityType: EntityType, entityId: string, versionId: string, note?: string) => {
      await db.revertToVersion(entityType, entityId, versionId, note);
      if (selectedCustomerId) {
        if (entityType === "customer") {
          if (selectedCustomerId === entityId) {
            await selectCustomer(entityId);
          }
        } else {
          await selectCustomer(selectedCustomerId);
        }
      }
      await listCustomers();
      await refreshStats();
    },
    [db, selectedCustomerId, selectCustomer, listCustomers, refreshStats]
  );

  const simulateConflict = useCallback(
    async (customerId: string) => {
      await db.simulateConflict(customerId);
      if (selectedCustomerId === customerId) {
        await selectCustomer(customerId);
      }
      await listCustomers();
      await refreshStats();
    },
    [db, selectedCustomerId, selectCustomer, listCustomers, refreshStats]
  );

  const computeConflictDiff = useCallback(
    async (customerId: string): Promise<ConflictDiff[]> => {
      const local = await db.getCustomer(customerId);
      if (!local) return [];
      const allVersions = await db.getVersions(customerId);
      const remoteSnapshot = allVersions.find((v) => v.editedBy !== "当前用户" && v.versionId !== local.versionId);
      if (!remoteSnapshot) {
        const simulated: CustomerProfile = {
          ...JSON.parse(JSON.stringify(local)),
          remark: (local.remark || "") + "\n[远程模拟] 请于下周三复诊",
          occupation: local.occupation || "远程端补充的职业"
        };
        const diff = db.computeDiff(local, simulated);
        setConflictDiffs(diff);
        return diff;
      }
      const diff = db.computeDiff(local, remoteSnapshot.data);
      setConflictDiffs(diff);
      return diff;
    },
    [db]
  );

  const resolveConflict = useCallback(
    async (
      entityType: EntityType,
      entityId: string,
      resolution: "local" | "remote" | "merge",
      merged?: ArchiveEntity
    ) => {
      await db.resolveConflict(entityType, entityId, resolution, merged);
      if (entityType === "customer" && selectedCustomerId === entityId) {
        await selectCustomer(entityId);
      }
      await listCustomers();
      await refreshStats();
      setConflictDiffs([]);
    },
    [db, selectedCustomerId, selectCustomer, listCustomers, refreshStats]
  );

  const seedData = useCallback(async () => {
    await db.seedSampleData();
    await listCustomers();
    await refreshStats();
  }, [db, listCustomers, refreshStats]);

  const clearAll = useCallback(async () => {
    await db.clearAll();
    setCustomers([]);
    setAggregate(null);
    setSelectedCustomerId(null);
    setVersions([]);
    setConflictDiffs([]);
    await refreshStats();
  }, [db, refreshStats]);

  useEffect(() => {
    listCustomers();
    refreshStats();
  }, [listCustomers, refreshStats]);

  const value: ArchiveContextValue = {
    loading,
    error,
    customers,
    stats,
    selectedCustomerId,
    aggregate,
    versions,
    conflictDiffs,
    listCustomers,
    selectCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    createAudiogram,
    updateAudiogram,
    deleteAudiogram,
    createFitting,
    updateFitting,
    deleteFitting,
    createFollowUp,
    updateFollowUp,
    deleteFollowUp,
    createComparison,
    updateComparison,
    deleteComparison,
    getLatestComparison,
    loadVersions,
    revertToVersion,
    simulateConflict,
    computeConflictDiff,
    resolveConflict,
    refreshStats,
    seedData,
    clearAll
  };

  return <ArchiveContext.Provider value={value}>{children}</ArchiveContext.Provider>;
}

export function useArchive(): ArchiveContextValue {
  const ctx = useContext(ArchiveContext);
  if (!ctx) {
    throw new Error("useArchive must be used within ArchiveProvider");
  }
  return ctx;
}
