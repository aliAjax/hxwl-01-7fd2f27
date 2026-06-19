import { useState, useEffect, useCallback, useRef } from "react";
import {
  getDraftStorage,
  createDraftData,
  DraftData,
  DraftStorage,
  StorageType
} from "./draftStorage";

export type DraftStatus = "idle" | "saving" | "saved" | "loading" | "error" | "unsupported";

export interface UseDraftOptions<T> {
  key: string;
  initialData: T;
  debounceMs?: number;
  onLoaded?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseDraftResult<T> {
  data: T;
  status: DraftStatus;
  lastSavedAt: number | null;
  isSupported: boolean;
  storageType: StorageType;
  hasDraft: boolean;
  saveNow: () => Promise<void>;
  updateData: (updater: T | ((prev: T) => T)) => void;
  clearDraft: (resetData?: T) => Promise<void>;
  loadDraft: () => Promise<void>;
}

export function useDraft<T>(options: UseDraftOptions<T>): UseDraftResult<T> {
  const { key, initialData, debounceMs = 1000, onLoaded, onError } = options;

  const [data, setData] = useState<T>(initialData);
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [storageType, setStorageType] = useState<StorageType>("indexeddb");
  const [storage, setStorage] = useState<DraftStorage | null>(null);

  const dataRef = useRef(data);
  const debounceTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef(false);
  const keyRef = useRef(key);
  const prevKeyRef = useRef<string | null>(null);

  dataRef.current = data;
  keyRef.current = key;

  const saveDraft = useCallback(
    async (targetKey?: string) => {
      if (!storage || !storage.isSupported) return;

      const k = targetKey ?? keyRef.current;
      setStatus("saving");
      try {
        const draftData = createDraftData({
          formValues: dataRef.current as unknown as Record<string, string>
        });
        await storage.save(k, draftData);
        if (k === keyRef.current) {
          setLastSavedAt(Date.now());
          setHasDraft(true);
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 2000);
        }
      } catch (e) {
        if (k === keyRef.current) {
          setStatus("error");
          if (onError) onError(e as Error);
        }
      }
    },
    [storage, onError]
  );

  const scheduleSave = useCallback(() => {
    if (!storage || !storage.isSupported) return;

    pendingSaveRef.current = true;

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      pendingSaveRef.current = false;
      saveDraft();
    }, debounceMs);
  }, [storage, debounceMs, saveDraft]);

  const updateData = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setData((prev) => {
        const next = typeof updater === "function" ? (updater as (prev: T) => T)(prev) : updater;
        return next;
      });
      scheduleSave();
    },
    [scheduleSave]
  );

  const saveNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingSaveRef.current = false;
    await saveDraft();
  }, [saveDraft]);

  const loadDraft = useCallback(
    async (targetKey?: string) => {
      if (!storage || !storage.isSupported) return;

      const k = targetKey ?? keyRef.current;
      if (k === keyRef.current) {
        setStatus("loading");
      }
      try {
        const saved = await storage.load(k);
        if (saved && saved.formValues) {
          const loadedData = saved.formValues as unknown as T;
          if (k === keyRef.current) {
            setData(loadedData);
            dataRef.current = loadedData;
            setLastSavedAt(saved.savedAt);
            setHasDraft(true);
            if (onLoaded) onLoaded(loadedData);
            setStatus("idle");
          }
        } else if (k === keyRef.current) {
          setStatus("idle");
        }
      } catch (e) {
        if (k === keyRef.current) {
          setStatus("error");
          if (onError) onError(e as Error);
        }
      }
    },
    [storage, onLoaded, onError]
  );

  const clearDraft = useCallback(
    async (resetData?: T) => {
      if (!storage || !storage.isSupported) return;

      try {
        await storage.remove(keyRef.current);
        setHasDraft(false);
        setLastSavedAt(null);
        const newData = resetData !== undefined ? resetData : initialData;
        setData(newData);
        dataRef.current = newData;
      } catch (e) {
        setStatus("error");
        if (onError) onError(e as Error);
      }
    },
    [storage, initialData, onError]
  );

  useEffect(() => {
    const s = getDraftStorage();
    setStorage(s);
    setIsSupported(s.isSupported);
    setStorageType(s.storageType);
    if (!s.isSupported) {
      setStatus("unsupported");
    }
  }, []);

  useEffect(() => {
    if (storage && storage.isSupported) {
      loadDraft();
    }
  }, [storage]);

  useEffect(() => {
    if (prevKeyRef.current !== null && prevKeyRef.current !== key) {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        saveDraft(prevKeyRef.current);
      }
      const resetData = initialData;
      setData(resetData);
      dataRef.current = resetData;
      setHasDraft(false);
      setLastSavedAt(null);
      if (storage && storage.isSupported) {
        loadDraft(key);
      }
    }
    prevKeyRef.current = key;
  }, [key, storage, initialData, saveDraft, loadDraft]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      if (pendingSaveRef.current) {
        saveDraft(keyRef.current);
      }
    };
  }, [saveDraft]);

  return {
    data,
    status,
    lastSavedAt,
    isSupported,
    storageType,
    hasDraft,
    saveNow,
    updateData,
    clearDraft,
    loadDraft
  };
}

export function formatLastSaved(timestamp: number | null): string {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "刚刚保存";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前保存`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前保存`;

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")} 保存`;
}

export interface UseHearingDraftOptions {
  key: string;
  initialRecord: unknown;
  debounceMs?: number;
}

export interface UseHearingDraftResult<T> {
  record: T;
  status: DraftStatus;
  lastSavedAt: number | null;
  isSupported: boolean;
  storageType: StorageType;
  hasDraft: boolean;
  saveNow: () => Promise<void>;
  updateRecord: (updater: T | ((prev: T) => T)) => void;
  clearDraft: (resetData?: T) => Promise<void>;
  loadDraft: () => Promise<void>;
}

export function useHearingDraft<T>(options: UseHearingDraftOptions): UseHearingDraftResult<T> {
  const { key, initialRecord, debounceMs = 1000 } = options;

  const [record, setRecord] = useState<T>(initialRecord as T);
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [storageType, setStorageType] = useState<StorageType>("indexeddb");
  const [storage, setStorage] = useState<DraftStorage | null>(null);

  const recordRef = useRef(record);
  const debounceTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef(false);
  const keyRef = useRef(key);
  const prevKeyRef = useRef<string | null>(null);

  recordRef.current = record;
  keyRef.current = key;

  useEffect(() => {
    const s = getDraftStorage();
    setStorage(s);
    setIsSupported(s.isSupported);
    setStorageType(s.storageType);
    if (!s.isSupported) {
      setStatus("unsupported");
    }
  }, []);

  const saveDraft = useCallback(
    async (targetKey?: string) => {
      if (!storage || !storage.isSupported) return;

      const k = targetKey ?? keyRef.current;
      setStatus("saving");
      try {
        const draftData = createDraftData({
          hearingRecord: recordRef.current
        });
        await storage.save(k, draftData);
        if (k === keyRef.current) {
          setLastSavedAt(Date.now());
          setHasDraft(true);
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 2000);
        }
      } catch (e) {
        if (k === keyRef.current) {
          setStatus("error");
        }
      }
    },
    [storage]
  );

  const scheduleSave = useCallback(() => {
    if (!storage || !storage.isSupported) return;

    pendingSaveRef.current = true;

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      pendingSaveRef.current = false;
      saveDraft();
    }, debounceMs);
  }, [storage, debounceMs, saveDraft]);

  const updateRecord = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setRecord((prev) => {
        const next = typeof updater === "function" ? (updater as (prev: T) => T)(prev) : updater;
        return next;
      });
      scheduleSave();
    },
    [scheduleSave]
  );

  const saveNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingSaveRef.current = false;
    await saveDraft();
  }, [saveDraft]);

  const loadDraft = useCallback(
    async (targetKey?: string) => {
      if (!storage || !storage.isSupported) return;

      const k = targetKey ?? keyRef.current;
      if (k === keyRef.current) {
        setStatus("loading");
      }
      try {
        const saved = await storage.load(k);
        if (saved && saved.hearingRecord) {
          const loadedRecord = saved.hearingRecord as T;
          if (k === keyRef.current) {
            setRecord(loadedRecord);
            recordRef.current = loadedRecord;
            setLastSavedAt(saved.savedAt);
            setHasDraft(true);
            setStatus("idle");
          }
        } else if (k === keyRef.current) {
          setStatus("idle");
        }
      } catch (e) {
        if (k === keyRef.current) {
          setStatus("error");
        }
      }
    },
    [storage]
  );

  const clearDraft = useCallback(
    async (resetData?: T) => {
      if (!storage || !storage.isSupported) return;

      try {
        await storage.remove(keyRef.current);
        setHasDraft(false);
        setLastSavedAt(null);
        const newData = resetData !== undefined ? resetData : (initialRecord as T);
        setRecord(newData);
        recordRef.current = newData;
      } catch (e) {
        setStatus("error");
      }
    },
    [storage, initialRecord]
  );

  useEffect(() => {
    if (storage && storage.isSupported) {
      loadDraft();
    }
  }, [storage]);

  useEffect(() => {
    if (prevKeyRef.current !== null && prevKeyRef.current !== key) {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        saveDraft(prevKeyRef.current);
      }
      const resetData = initialRecord as T;
      setRecord(resetData);
      recordRef.current = resetData;
      setHasDraft(false);
      setLastSavedAt(null);
      if (storage && storage.isSupported) {
        loadDraft(key);
      }
    }
    prevKeyRef.current = key;
  }, [key, storage, initialRecord, saveDraft, loadDraft]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      if (pendingSaveRef.current) {
        saveDraft(keyRef.current);
      }
    };
  }, [saveDraft]);

  return {
    record,
    status,
    lastSavedAt,
    isSupported,
    storageType,
    hasDraft,
    saveNow,
    updateRecord,
    clearDraft,
    loadDraft
  };
}
