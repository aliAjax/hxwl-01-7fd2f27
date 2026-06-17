import type {
  ArchiveEntity,
  AudiogramRecord,
  ConflictDiff,
  CustomerAggregate,
  CustomerProfile,
  EntityType,
  FollowUpRecord,
  FittingRecord,
  VersionSnapshot
} from "./archive.types";
import { generateId, generateVersionId } from "./archive.types";

const DB_NAME = "hearing_archive_db";
const DB_VERSION = 2;

const STORE_CUSTOMERS = "customers";
const STORE_AUDIOGRAMS = "audiograms";
const STORE_FITTINGS = "fittings";
const STORE_FOLLOWUPS = "followups";
const STORE_VERSIONS = "versions";

const ENTITY_STORES: Record<EntityType, string> = {
  customer: STORE_CUSTOMERS,
  audiogram: STORE_AUDIOGRAMS,
  fitting: STORE_FITTINGS,
  followup: STORE_FOLLOWUPS
};

export interface ArchiveStats {
  customers: number;
  audiograms: number;
  fittings: number;
  followups: number;
  versions: number;
  conflicts: number;
}

export type SearchFilter = {
  keyword?: string;
  hearingLossType?: string;
  stage?: string;
  gender?: string;
  syncStatus?: string;
};

class ArchiveDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isSupported = typeof window !== "undefined" && "indexedDB" in window;

  private openDB(): Promise<IDBDatabase> {
    if (!this.isSupported) {
      return Promise.reject(new Error("当前浏览器不支持 IndexedDB"));
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion || 0;

        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORE_CUSTOMERS)) {
            const cs = db.createObjectStore(STORE_CUSTOMERS, { keyPath: "id" });
            cs.createIndex("customerNo", "customerNo", { unique: true });
            cs.createIndex("name", "name", { unique: false });
            cs.createIndex("phone", "phone", { unique: false });
            cs.createIndex("updatedAt", "updatedAt", { unique: false });
            cs.createIndex("syncStatus", "syncStatus", { unique: false });
          }

          if (!db.objectStoreNames.contains(STORE_AUDIOGRAMS)) {
            const as = db.createObjectStore(STORE_AUDIOGRAMS, { keyPath: "id" });
            as.createIndex("customerId", "customerId", { unique: false });
            as.createIndex("testDate", "testDate", { unique: false });
            as.createIndex("updatedAt", "updatedAt", { unique: false });
          }

          if (!db.objectStoreNames.contains(STORE_FITTINGS)) {
            const fs = db.createObjectStore(STORE_FITTINGS, { keyPath: "id" });
            fs.createIndex("customerId", "customerId", { unique: false });
            fs.createIndex("fittingDate", "fittingDate", { unique: false });
            fs.createIndex("stage", "stage", { unique: false });
            fs.createIndex("updatedAt", "updatedAt", { unique: false });
          }

          if (!db.objectStoreNames.contains(STORE_FOLLOWUPS)) {
            const fus = db.createObjectStore(STORE_FOLLOWUPS, { keyPath: "id" });
            fus.createIndex("customerId", "customerId", { unique: false });
            fus.createIndex("scheduledDate", "scheduledDate", { unique: false });
            fus.createIndex("status", "status", { unique: false });
            fus.createIndex("priority", "priority", { unique: false });
          }
        }

        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
            const vs = db.createObjectStore(STORE_VERSIONS, { keyPath: "id" });
            vs.createIndex("entityId", "entityId", { unique: false });
            vs.createIndex("entityType", "entityType", { unique: false });
            vs.createIndex("entityId_version", ["entityId", "version"], { unique: true });
            vs.createIndex("editedAt", "editedAt", { unique: false });
          }
        }
      };
    });

    return this.dbPromise;
  }

  private tx<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    fn: (stores: Record<string, IDBObjectStore>) => Promise<T> | T
  ): Promise<T> {
    return this.openDB().then((db) => {
      return new Promise<T>((resolve, reject) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        const tx = db.transaction(names, mode);
        const stores: Record<string, IDBObjectStore> = {};
        names.forEach((n) => {
          stores[n] = tx.objectStore(n);
        });

        let result: T;
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);

        try {
          const r = fn(stores);
          if (r && typeof (r as Promise<T>).then === "function") {
            (r as Promise<T>).then(
              (v) => {
                result = v;
              },
              (e) => {
                tx.abort();
                reject(e);
              }
            );
          } else {
            result = r as T;
          }
        } catch (e) {
          tx.abort();
          reject(e);
        }
      });
    });
  }

  private snapshotFromEntity<T extends ArchiveEntity>(
    entity: T,
    changeNote?: string,
    isCurrent = true
  ): VersionSnapshot<T> {
    return {
      id: generateId("ver"),
      entityId: entity.id,
      entityType: entity.entityType,
      version: entity.version,
      versionId: entity.versionId,
      parentVersionId: entity.parentVersionId,
      editedBy: entity.editedBy,
      editedAt: entity.editedAt,
      changeNote,
      data: JSON.parse(JSON.stringify(entity)),
      isCurrent
    };
  }

  async saveSnapshot<T extends ArchiveEntity>(
    entity: T,
    changeNote?: string,
    isCurrent = true
  ): Promise<void> {
    const snapshot = this.snapshotFromEntity(entity, changeNote, isCurrent);
    await this.tx(STORE_VERSIONS, "readwrite", (s) => {
      s[STORE_VERSIONS].put(snapshot);
    });
  }

  async getVersions(entityId: string): Promise<VersionSnapshot[]> {
    return this.tx(STORE_VERSIONS, "readonly", (s) => {
      return new Promise<VersionSnapshot[]>((resolve, reject) => {
        const idx = s[STORE_VERSIONS].index("entityId");
        const req = idx.getAll(IDBKeyRange.only(entityId));
        req.onsuccess = () => {
          const list = req.result.sort((a, b) => b.version - a.version);
          if (list.length > 0) {
            list[0].isCurrent = true;
          }
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getVersion(versionId: string): Promise<VersionSnapshot | null> {
    return this.tx(STORE_VERSIONS, "readonly", (s) => {
      return new Promise<VersionSnapshot | null>((resolve, reject) => {
        const req = s[STORE_VERSIONS].openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            if (cursor.value.versionId === versionId) {
              resolve(cursor.value);
            } else {
              cursor.continue();
            }
          } else {
            resolve(null);
          }
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async saveCustomer(
    customer: CustomerProfile,
    changeNote?: string
  ): Promise<CustomerProfile> {
    const now = Date.now();
    const toSave: CustomerProfile = {
      ...customer,
      updatedAt: now,
      editedAt: now
    };

    await this.tx([STORE_CUSTOMERS, STORE_VERSIONS], "readwrite", (s) => {
      s[STORE_CUSTOMERS].put(toSave);
      const snapshot = this.snapshotFromEntity(toSave, changeNote);
      s[STORE_VERSIONS].put(snapshot);
    });

    return toSave;
  }

  async saveAudiogram(
    audiogram: AudiogramRecord,
    changeNote?: string
  ): Promise<AudiogramRecord> {
    const now = Date.now();
    const toSave: AudiogramRecord = {
      ...audiogram,
      updatedAt: now,
      editedAt: now
    };

    await this.tx([STORE_AUDIOGRAMS, STORE_VERSIONS], "readwrite", (s) => {
      s[STORE_AUDIOGRAMS].put(toSave);
      const snapshot = this.snapshotFromEntity(toSave, changeNote);
      s[STORE_VERSIONS].put(snapshot);
    });

    return toSave;
  }

  async saveFitting(
    fitting: FittingRecord,
    changeNote?: string
  ): Promise<FittingRecord> {
    const now = Date.now();
    const toSave: FittingRecord = {
      ...fitting,
      updatedAt: now,
      editedAt: now
    };

    await this.tx([STORE_FITTINGS, STORE_VERSIONS], "readwrite", (s) => {
      s[STORE_FITTINGS].put(toSave);
      const snapshot = this.snapshotFromEntity(toSave, changeNote);
      s[STORE_VERSIONS].put(snapshot);
    });

    return toSave;
  }

  async saveFollowUp(
    followup: FollowUpRecord,
    changeNote?: string
  ): Promise<FollowUpRecord> {
    const now = Date.now();
    const toSave: FollowUpRecord = {
      ...followup,
      updatedAt: now,
      editedAt: now
    };

    await this.tx([STORE_FOLLOWUPS, STORE_VERSIONS], "readwrite", (s) => {
      s[STORE_FOLLOWUPS].put(toSave);
      const snapshot = this.snapshotFromEntity(toSave, changeNote);
      s[STORE_VERSIONS].put(snapshot);
    });

    return toSave;
  }

  async listCustomers(filter?: SearchFilter): Promise<CustomerProfile[]> {
    return this.tx(STORE_CUSTOMERS, "readonly", (s) => {
      return new Promise<CustomerProfile[]>((resolve, reject) => {
        const req = s[STORE_CUSTOMERS].index("updatedAt").openCursor(null, "prev");
        const list: CustomerProfile[] = [];
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const val = cursor.value as CustomerProfile;
            if (!val.deletedAt) {
              if (this.matchCustomerFilter(val, filter)) {
                list.push(val);
              }
            }
            cursor.continue();
          } else {
            resolve(list);
          }
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  private matchCustomerFilter(c: CustomerProfile, filter?: SearchFilter): boolean {
    if (!filter) return true;
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      const hit =
        c.name.toLowerCase().includes(kw) ||
        c.customerNo.toLowerCase().includes(kw) ||
        c.phone.includes(kw);
      if (!hit) return false;
    }
    if (filter.hearingLossType && filter.hearingLossType !== "all") {
      if (c.hearingLossType !== filter.hearingLossType) return false;
    }
    if (filter.gender && filter.gender !== "all") {
      if (c.gender !== filter.gender) return false;
    }
    if (filter.syncStatus && filter.syncStatus !== "all") {
      if (c.syncStatus !== filter.syncStatus) return false;
    }
    return true;
  }

  async getCustomer(id: string): Promise<CustomerProfile | null> {
    return this.tx(STORE_CUSTOMERS, "readonly", (s) => {
      return new Promise<CustomerProfile | null>((resolve, reject) => {
        const req = s[STORE_CUSTOMERS].get(id);
        req.onsuccess = () => {
          const r = req.result as CustomerProfile | undefined;
          resolve(r && !r.deletedAt ? r : null);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getAudiogramsByCustomer(customerId: string): Promise<AudiogramRecord[]> {
    return this.tx(STORE_AUDIOGRAMS, "readonly", (s) => {
      return new Promise<AudiogramRecord[]>((resolve, reject) => {
        const idx = s[STORE_AUDIOGRAMS].index("customerId");
        const req = idx.getAll(IDBKeyRange.only(customerId));
        req.onsuccess = () => {
          resolve(
            (req.result as AudiogramRecord[])
              .filter((x) => !x.deletedAt)
              .sort((a, b) => (b.testDate > a.testDate ? 1 : -1))
          );
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getFittingsByCustomer(customerId: string): Promise<FittingRecord[]> {
    return this.tx(STORE_FITTINGS, "readonly", (s) => {
      return new Promise<FittingRecord[]>((resolve, reject) => {
        const idx = s[STORE_FITTINGS].index("customerId");
        const req = idx.getAll(IDBKeyRange.only(customerId));
        req.onsuccess = () => {
          resolve(
            (req.result as FittingRecord[])
              .filter((x) => !x.deletedAt)
              .sort((a, b) => (b.fittingDate > a.fittingDate ? 1 : -1))
          );
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getFollowUpsByCustomer(customerId: string): Promise<FollowUpRecord[]> {
    return this.tx(STORE_FOLLOWUPS, "readonly", (s) => {
      return new Promise<FollowUpRecord[]>((resolve, reject) => {
        const idx = s[STORE_FOLLOWUPS].index("customerId");
        const req = idx.getAll(IDBKeyRange.only(customerId));
        req.onsuccess = () => {
          resolve(
            (req.result as FollowUpRecord[])
              .filter((x) => !x.deletedAt)
              .sort((a, b) => (b.scheduledDate > a.scheduledDate ? 1 : -1))
          );
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getCustomerAggregate(customerId: string): Promise<CustomerAggregate | null> {
    const profile = await this.getCustomer(customerId);
    if (!profile) return null;
    const [audiograms, fittings, followUps, versions] = await Promise.all([
      this.getAudiogramsByCustomer(customerId),
      this.getFittingsByCustomer(customerId),
      this.getFollowUpsByCustomer(customerId),
      this.getVersions(customerId)
    ]);
    return {
      profile,
      audiograms,
      fittings,
      followUps,
      versionCount: versions.length
    };
  }

  async getAudiogram(id: string): Promise<AudiogramRecord | null> {
    return this.tx(STORE_AUDIOGRAMS, "readonly", (s) => this._getOne<AudiogramRecord>(s[STORE_AUDIOGRAMS], id));
  }

  async getFitting(id: string): Promise<FittingRecord | null> {
    return this.tx(STORE_FITTINGS, "readonly", (s) => this._getOne<FittingRecord>(s[STORE_FITTINGS], id));
  }

  async getFollowUp(id: string): Promise<FollowUpRecord | null> {
    return this.tx(STORE_FOLLOWUPS, "readonly", (s) => this._getOne<FollowUpRecord>(s[STORE_FOLLOWUPS], id));
  }

  private _getOne<T extends ArchiveEntity>(store: IDBObjectStore, id: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const r = req.result as T | undefined;
        resolve(r && !r.deletedAt ? r : null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteCustomer(id: string): Promise<void> {
    await this.tx(STORE_CUSTOMERS, "readwrite", (s) => {
      return new Promise<void>((resolve, reject) => {
        const req = s[STORE_CUSTOMERS].get(id);
        req.onsuccess = () => {
          const r = req.result as CustomerProfile | undefined;
          if (r) {
            r.deletedAt = Date.now();
            s[STORE_CUSTOMERS].put(r);
          }
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async revertToVersion(
    entityType: EntityType,
    entityId: string,
    versionId: string,
    changeNote?: string
  ): Promise<ArchiveEntity> {
    const snapshot = await this.getVersion(versionId);
    if (!snapshot) throw new Error("版本不存在");

    const storeName = ENTITY_STORES[entityType];
    const now = Date.now();
    const current = snapshot.data as ArchiveEntity;
    const nextVersion = current.version + 1;
    const nextVersionId = generateVersionId();

    const reverted: ArchiveEntity = {
      ...JSON.parse(JSON.stringify(current)),
      updatedAt: now,
      version: nextVersion,
      versionId: nextVersionId,
      parentVersionId: versionId,
      editedBy: "当前用户",
      editedAt: now
    };

    await this.tx([storeName, STORE_VERSIONS], "readwrite", (s) => {
      s[storeName].put(reverted);
      const newSnapshot: VersionSnapshot = {
        id: generateId("ver"),
        entityId: reverted.id,
        entityType: reverted.entityType,
        version: reverted.version,
        versionId: reverted.versionId,
        parentVersionId: reverted.parentVersionId,
        editedBy: reverted.editedBy,
        editedAt: reverted.editedAt,
        changeNote: changeNote || `回滚到 v${current.version}`,
        data: JSON.parse(JSON.stringify(reverted)),
        isCurrent: true
      };
      s[STORE_VERSIONS].put(newSnapshot);
    });

    return reverted;
  }

  async detectConflicts(): Promise<ArchiveEntity[]> {
    const allCustomers = await this.listCustomers();
    return allCustomers.filter(
      (c) => c.syncStatus === "conflict" || c.conflict?.hasConflict
    );
  }

  computeDiff(local: unknown, remote: unknown, prefix = ""): ConflictDiff[] {
    const diffs: ConflictDiff[] = [];
    if (typeof local !== "object" || local === null || typeof remote !== "object" || remote === null) {
      if (JSON.stringify(local) !== JSON.stringify(remote)) {
        diffs.push({
          field: prefix || "(root)",
          localValue: local,
          remoteValue: remote
        });
      }
      return diffs;
    }
    const lObj = local as Record<string, unknown>;
    const rObj = remote as Record<string, unknown>;
    const keys = new Set([...Object.keys(lObj), ...Object.keys(rObj)]);
    for (const k of keys) {
      const path = prefix ? `${prefix}.${k}` : k;
      const skip = ["version", "versionId", "parentVersionId", "editedAt", "editedBy", "updatedAt", "syncStatus", "conflict"];
      if (skip.includes(k)) continue;
      if (JSON.stringify(lObj[k]) !== JSON.stringify(rObj[k])) {
        if (
          typeof lObj[k] === "object" &&
          lObj[k] !== null &&
          !Array.isArray(lObj[k]) &&
          typeof rObj[k] === "object" &&
          rObj[k] !== null &&
          !Array.isArray(rObj[k])
        ) {
          diffs.push(...this.computeDiff(lObj[k], rObj[k], path));
        } else {
          diffs.push({ field: path, localValue: lObj[k], remoteValue: rObj[k] });
        }
      }
    }
    return diffs;
  }

  async simulateConflict(customerId: string): Promise<void> {
    const customer = await this.getCustomer(customerId);
    if (!customer) return;

    const remoteVersionId = generateVersionId();
    const now = Date.now();
    const modified: CustomerProfile = {
      ...JSON.parse(JSON.stringify(customer)),
      version: customer.version + 99,
      versionId: remoteVersionId,
      parentVersionId: customer.versionId,
      editedAt: now + 1000,
      editedBy: "另一位听力师",
      syncStatus: "conflict",
      conflict: {
        hasConflict: true,
        remoteVersionId,
        remoteEditedAt: now + 1000,
        remoteEditedBy: "另一位听力师"
      },
      remark: (customer.remark || "") + "\n[远程修改] 客户复诊日期调整至下周",
      occupation: customer.occupation || "远程端补充职业信息"
    };

    await this.saveSnapshot(modified, "模拟远程端修改冲突");

    await this.tx(STORE_CUSTOMERS, "readwrite", (s) => {
      s[STORE_CUSTOMERS].put({
        ...customer,
        syncStatus: "conflict",
        conflict: {
          hasConflict: true,
          remoteVersionId,
          remoteEditedAt: now + 1000,
          remoteEditedBy: "另一位听力师"
        }
      });
    });
  }

  async resolveConflict(
    entityType: EntityType,
    entityId: string,
    resolution: "local" | "remote" | "merge",
    mergedData?: ArchiveEntity
  ): Promise<ArchiveEntity> {
    const storeName = ENTITY_STORES[entityType];
    const now = Date.now();

    return this.tx([storeName, STORE_VERSIONS], "readwrite", (s) => {
      return new Promise<ArchiveEntity>((resolve, reject) => {
        const req = s[storeName].get(entityId);
        req.onsuccess = () => {
          const current = req.result as ArchiveEntity;
          if (!current) {
            reject(new Error("记录不存在"));
            return;
          }

          let finalData: ArchiveEntity;
          let note = "";

          if (resolution === "local") {
            note = "冲突解决：保留本地版本";
            finalData = {
              ...current,
              version: current.version + 1,
              versionId: generateVersionId(),
              parentVersionId: current.versionId,
              editedAt: now,
              editedBy: "当前用户",
              syncStatus: "local",
              conflict: {
                ...(current.conflict || { hasConflict: false }),
                hasConflict: false,
                resolution: "local",
                resolvedAt: now
              }
            };
          } else if (resolution === "remote") {
            note = "冲突解决：采用远程版本";
            finalData = {
              ...current,
              version: current.version + 1,
              versionId: generateVersionId(),
              parentVersionId: current.conflict?.remoteVersionId,
              editedAt: now,
              editedBy: "当前用户",
              syncStatus: "synced",
              conflict: {
                ...(current.conflict || { hasConflict: false }),
                hasConflict: false,
                resolution: "remote",
                resolvedAt: now
              }
            };
          } else if (resolution === "merge" && mergedData) {
            note = "冲突解决：手动合并";
            finalData = {
              ...mergedData,
              version: current.version + 1,
              versionId: generateVersionId(),
              parentVersionId: current.versionId,
              editedAt: now,
              editedBy: "当前用户",
              syncStatus: "local",
              conflict: {
                ...(current.conflict || { hasConflict: false }),
                hasConflict: false,
                resolution: "manual",
                resolvedAt: now
              }
            };
          } else {
            reject(new Error("无效的解决方式"));
            return;
          }

          s[storeName].put(finalData);
          const snapshot: VersionSnapshot = {
            id: generateId("ver"),
            entityId: finalData.id,
            entityType: finalData.entityType,
            version: finalData.version,
            versionId: finalData.versionId,
            parentVersionId: finalData.parentVersionId,
            editedBy: finalData.editedBy,
            editedAt: finalData.editedAt,
            changeNote: note,
            data: JSON.parse(JSON.stringify(finalData)),
            isCurrent: true
          };
          s[STORE_VERSIONS].put(snapshot);
          resolve(finalData);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getStats(): Promise<ArchiveStats> {
    return this.tx(
      [STORE_CUSTOMERS, STORE_AUDIOGRAMS, STORE_FITTINGS, STORE_FOLLOWUPS, STORE_VERSIONS],
      "readonly",
      (s) => {
        const count = (store: IDBObjectStore) =>
          new Promise<number>((resolve, reject) => {
            const r = store.count();
            r.onsuccess = () => resolve(r.result as number);
            r.onerror = () => reject(r.error);
          });
        return Promise.all([
          count(s[STORE_CUSTOMERS]),
          count(s[STORE_AUDIOGRAMS]),
          count(s[STORE_FITTINGS]),
          count(s[STORE_FOLLOWUPS]),
          count(s[STORE_VERSIONS]),
          this.detectConflicts().then((l) => l.length)
        ]).then(([c, a, f, fu, v, cf]) => ({
          customers: c,
          audiograms: a,
          fittings: f,
          followups: fu,
          versions: v,
          conflicts: cf
        }));
      }
    );
  }

  async clearAll(): Promise<void> {
    await this.tx(
      [STORE_CUSTOMERS, STORE_AUDIOGRAMS, STORE_FITTINGS, STORE_FOLLOWUPS, STORE_VERSIONS],
      "readwrite",
      (s) => {
        Object.values(s).forEach((st) => st.clear());
      }
    );
  }

  async seedSampleData(): Promise<void> {
    const now = Date.now();
    const customers: CustomerProfile[] = [
      {
        id: "cust-sample-001",
        entityType: "customer",
        customerNo: "C1001",
        name: "刘建华",
        gender: "male",
        birthDate: "1968-03-15",
        age: 58,
        phone: "13800138001",
        email: "liujh@example.com",
        address: "北京市朝阳区建国路88号",
        occupation: "退休教师",
        hearingLossType: "感音神经性",
        hearingLossOnsetDate: "2020-01-10",
        medicalHistory: "高血压、高血脂",
        tinnitus: true,
        vertigo: false,
        otorrhea: false,
        allergies: "青霉素过敏",
        tags: ["高频下降", "老人"],
        remark: "初配客户，对助听器外观有要求",
        createdAt: now - 86400000 * 30,
        updatedAt: now - 86400000 * 2,
        deletedAt: undefined,
        version: 3,
        versionId: "v-sample-c1-v3",
        parentVersionId: "v-sample-c1-v2",
        editedBy: "李听力师",
        editedAt: now - 86400000 * 2,
        changeNote: "更新联系电话",
        syncStatus: "local"
      },
      {
        id: "cust-sample-002",
        entityType: "customer",
        customerNo: "C1002",
        name: "陈美玲",
        gender: "female",
        birthDate: "1975-08-22",
        age: 50,
        phone: "13900139002",
        address: "上海市浦东新区陆家嘴环路1000号",
        occupation: "企业财务",
        hearingLossType: "传导性",
        tinnitus: false,
        vertigo: false,
        otorrhea: true,
        tags: ["单侧", "复调"],
        remark: "左耳传导性损失，曾有中耳炎病史",
        createdAt: now - 86400000 * 60,
        updatedAt: now - 86400000 * 5,
        version: 2,
        versionId: "v-sample-c2-v2",
        parentVersionId: "v-sample-c2-v1",
        editedBy: "王听力师",
        editedAt: now - 86400000 * 5,
        syncStatus: "synced",
        lastSyncedAt: now - 86400000 * 5
      },
      {
        id: "cust-sample-003",
        entityType: "customer",
        customerNo: "C1003",
        name: "赵子涵",
        gender: "female",
        birthDate: "2018-05-10",
        age: 8,
        phone: "13700137003",
        address: "广州市天河区珠江新城",
        occupation: "学生",
        hearingLossType: "感音神经性",
        tinnitus: false,
        vertigo: false,
        otorrhea: false,
        tags: ["儿童", "语频区"],
        remark: "儿童患者，需家长陪同，言语识别率训练中",
        createdAt: now - 86400000 * 90,
        updatedAt: now - 86400000 * 1,
        version: 5,
        versionId: "v-sample-c3-v5",
        parentVersionId: "v-sample-c3-v4",
        editedBy: "张听力师",
        editedAt: now - 86400000 * 1,
        changeNote: "更新学校环境使用反馈",
        syncStatus: "conflict",
        conflict: {
          hasConflict: true,
          remoteVersionId: "v-sample-c3-v5-remote",
          remoteEditedAt: now - 3600000,
          remoteEditedBy: "家长端"
        }
      },
      {
        id: "cust-sample-004",
        entityType: "customer",
        customerNo: "C1004",
        name: "王建国",
        gender: "male",
        birthDate: "1952-11-08",
        age: 73,
        phone: "13600136004",
        hearingLossType: "混合性",
        tinnitus: true,
        vertigo: true,
        otorrhea: false,
        tags: ["老人", "重度"],
        remark: "老年重度混合性听损，需要大功率机型",
        createdAt: now - 86400000 * 120,
        updatedAt: now - 86400000 * 7,
        version: 4,
        versionId: "v-sample-c4-v4",
        parentVersionId: "v-sample-c4-v3",
        editedBy: "李听力师",
        editedAt: now - 86400000 * 7,
        syncStatus: "local"
      }
    ];

    for (const c of customers) {
      await this.saveCustomer(c, "示例数据导入");
    }
  }
}

let archiveInstance: ArchiveDatabase | null = null;

export function getArchiveDB(): ArchiveDatabase {
  if (!archiveInstance) {
    archiveInstance = new ArchiveDatabase();
  }
  return archiveInstance;
}
