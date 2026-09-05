import readXlsxFile from "read-excel-file/browser";
import { CATEGORIES, emptyItemMap } from "../types";
import type { Category, DailyEntry } from "../types";

export interface ImportedSheet {
  sheetName: string;
  entries: DailyEntry[];
}

function excelSerialToISODate(serial: number): string {
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  return toUTCISODate(new Date(utcMs));
}

function toUTCISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cellToISODate(value: unknown): string | null {
  if (value instanceof Date) return toUTCISODate(value);
  if (typeof value === "number" && Number.isFinite(value)) return excelSerialToISODate(value);
  return null;
}

function findCategoryCol(header: unknown[], name: string, from: number, to: number): number | undefined {
  for (let i = from; i < to; i++) {
    if (header[i] === name) return i;
  }
  return undefined;
}

// Expects a layout like the reference template: a header row containing "日付"
// once (sales block) or twice (sales block + waste block), each followed by
// per-category columns whose header text matches a category name exactly.
function parseRows(rows: unknown[][]): DailyEntry[] {
  const header = rows[1] ?? []; // spreadsheet row 2: 日付/曜日/カテゴリ名の見出し行

  const dateCols: number[] = [];
  header.forEach((v, i) => {
    if (v === "日付") dateCols.push(i);
  });
  if (dateCols.length === 0) return [];

  const salesDateCol = dateCols[0];
  const wasteDateCol = dateCols[1];
  const salesColEnd = wasteDateCol ?? header.length;

  const salesCols: Partial<Record<Category, number>> = {};
  const wasteCols: Partial<Record<Category, number>> = {};
  for (const cat of CATEGORIES) {
    const sc = findCategoryCol(header, cat, salesDateCol, salesColEnd);
    if (sc !== undefined) salesCols[cat] = sc;
    if (wasteDateCol !== undefined) {
      const wc = findCategoryCol(header, cat, wasteDateCol, header.length);
      if (wc !== undefined) wasteCols[cat] = wc;
    }
  }

  const byDate = new Map<string, DailyEntry>();
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const dateStr = cellToISODate(row[salesDateCol]);
    if (!dateStr) continue;

    const items = emptyItemMap();
    let hasData = false;
    for (const cat of CATEGORIES) {
      const sc = salesCols[cat];
      if (sc !== undefined && typeof row[sc] === "number") {
        items[cat].salesAmount = row[sc] as number;
        hasData = true;
      }
      const wc = wasteCols[cat];
      if (wc !== undefined && typeof row[wc] === "number") {
        items[cat].wasteAmount = row[wc] as number;
        hasData = true;
      }
    }
    if (!hasData) continue;

    byDate.set(dateStr, {
      date: dateStr,
      weather: "",
      temperature: null,
      event: false,
      memo: "",
      items,
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function parseWorkbookFile(file: File): Promise<ImportedSheet[]> {
  const sheets = await readXlsxFile(file);
  return sheets.map((s: { sheet: string; data: unknown[][] }) => ({
    sheetName: s.sheet,
    entries: parseRows(s.data),
  }));
}
