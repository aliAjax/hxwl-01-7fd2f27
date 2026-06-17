export interface DraftData {
  hearingRecord?: unknown;
  formValues?: Record<string, string>;
  savedAt: number;
  version: number;
}

export interface DraftStorage {
  isSupported: boolean;
  save: (key: string, data: DraftData) => Promise<void>;
  load: (key: string) => Promise<DraftData | null>;
  remove: (key: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const DB_NAME = "hearing_draft_db";
const STORE_NAME = "drafts";
const DB_VERSION = 1;
const STORAGE_VERSION = 1;

function isIndexedDBSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

class IndexedDBStorage implements DraftStorage {
  isSupported = true;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
    });

    return this.dbPromise;
  }

  async save(key: string, data: DraftData): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ key, ...data });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async load(key: string): Promise<DraftData | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
        } else {
          const { key: _k, ...data } = result;
          resolve(data as DraftData);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

class LocalStorageFallback implements DraftStorage {
  isSupported = true;
  private prefix = "hearing_draft_";

  async save(key: string, data: DraftData): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(data));
    } catch (e) {
      throw new Error("本地存储失败，可能空间不足");
    }
  }

  async load(key: string): Promise<DraftData | null> {
    const raw = localStorage.getItem(this.prefix + key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DraftData;
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async clearAll(): Promise<void> {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(this.prefix)
    );
    keys.forEach((k) => localStorage.removeItem(k));
  }
}

class NoopStorage implements DraftStorage {
  isSupported = false;

  async save(): Promise<void> {
    throw new Error("当前浏览器不支持本地存储");
  }

  async load(): Promise<DraftData | null> {
    return null;
  }

  async remove(): Promise<void> {}

  async clearAll(): Promise<void> {}
}

let storageInstance: DraftStorage | null = null;

export function getDraftStorage(): DraftStorage {
  if (storageInstance) return storageInstance;

  if (isIndexedDBSupported()) {
    try {
      storageInstance = new IndexedDBStorage();
    } catch {
      storageInstance = new LocalStorageFallback();
    }
  } else if (typeof window !== "undefined" && "localStorage" in window) {
    storageInstance = new LocalStorageFallback();
  } else {
    storageInstance = new NoopStorage();
  }

  return storageInstance;
}

export function createDraftData(
  data: Omit<DraftData, "savedAt" | "version">
): DraftData {
  return {
    ...data,
    savedAt: Date.now(),
    version: STORAGE_VERSION
  };
}

export { STORAGE_VERSION };
