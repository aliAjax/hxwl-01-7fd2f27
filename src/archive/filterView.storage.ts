export type FilterState = {
  keyword: string;
  hearingLossType: string;
  gender: string;
  syncStatus: string;
};

export interface FilterView {
  id: string;
  name: string;
  filter: FilterState;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "archive_filter_views";

function loadAll(): FilterView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FilterView[];
  } catch {
    return [];
  }
}

function saveAll(views: FilterView[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

export function getFilterViews(): FilterView[] {
  return loadAll();
}

export function saveFilterView(name: string, filter: FilterState): FilterView {
  const views = loadAll();
  const now = Date.now();
  const view: FilterView = {
    id: `fv-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    filter: { ...filter },
    createdAt: now,
    updatedAt: now
  };
  views.push(view);
  saveAll(views);
  return view;
}

export function renameFilterView(id: string, newName: string): FilterView | null {
  const views = loadAll();
  const idx = views.findIndex((v) => v.id === id);
  if (idx === -1) return null;
  views[idx].name = newName;
  views[idx].updatedAt = Date.now();
  saveAll(views);
  return views[idx];
}

export function deleteFilterView(id: string): boolean {
  const views = loadAll();
  const before = views.length;
  const filtered = views.filter((v) => v.id !== id);
  if (filtered.length === before) return false;
  saveAll(filtered);
  return true;
}
