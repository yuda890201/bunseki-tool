import { defaultAnalysisSettings } from "../types";
import type { AnalysisSettings, DailyEntry } from "../types";

const ENTRIES_KEY = "bunseki-tool:entries";
const SETTINGS_KEY = "bunseki-tool:settings";

export function loadEntries(): DailyEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyEntry[];
    return parsed.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export function saveEntries(entries: DailyEntry[]): void {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function upsertEntry(entries: DailyEntry[], entry: DailyEntry): DailyEntry[] {
  const idx = entries.findIndex((e) => e.date === entry.date);
  let next: DailyEntry[];
  if (idx >= 0) {
    next = [...entries];
    next[idx] = entry;
  } else {
    next = [...entries, entry];
  }
  next.sort((a, b) => a.date.localeCompare(b.date));
  saveEntries(next);
  return next;
}

export function deleteEntry(entries: DailyEntry[], date: string): DailyEntry[] {
  const next = entries.filter((e) => e.date !== date);
  saveEntries(next);
  return next;
}

export interface ImportResult {
  entries: DailyEntry[];
  imported: number;
  skipped: number;
}

export function importEntries(
  existing: DailyEntry[],
  imported: DailyEntry[],
  overwrite: boolean
): ImportResult {
  const map = new Map(existing.map((e) => [e.date, e]));
  let importedCount = 0;
  let skipped = 0;
  for (const entry of imported) {
    if (map.has(entry.date) && !overwrite) {
      skipped++;
      continue;
    }
    map.set(entry.date, entry);
    importedCount++;
  }
  const next = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  saveEntries(next);
  return { entries: next, imported: importedCount, skipped };
}

export function loadSettings(): AnalysisSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultAnalysisSettings();
    const parsed = JSON.parse(raw) as AnalysisSettings;
    return { ...defaultAnalysisSettings(), ...parsed };
  } catch {
    return defaultAnalysisSettings();
  }
}

export function saveSettings(settings: AnalysisSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
