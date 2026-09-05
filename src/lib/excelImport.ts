import readXlsxFile from "read-excel-file/browser";
import { CATEGORIES, createEmptyEntry } from "../types";
import type { Category, DailyEntry } from "../types";

export type SheetKind = "sales" | "waste" | "combined" | "unrecognized";

// 1カテゴリ分の、片側だけ分かっている実績値。
interface PartialItem {
  salesAmount?: number;
  wasteAmount?: number;
}

// 1日分の、複数シートを合成する前の断片データ。
interface PartialEntry {
  date: string;
  weather?: string;
  temperatureLow?: number | null;
  temperatureHigh?: number | null;
  saleCategory?: Category | "";
  holiday?: boolean;
  items: Partial<Record<Category, PartialItem>>;
}

export interface ParsedSheet {
  sheetName: string;
  kind: SheetKind;
  entries: PartialEntry[];
  skippedNoDate: number; // 金額はあるが日付が空欄だったため取り込めなかった行数
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

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if ((rows[i] ?? []).some((v) => v === "日付")) return i;
  }
  return -1;
}

function findCategoryCol(header: unknown[], name: string, from: number, to: number): number | undefined {
  for (let i = from; i < to; i++) {
    if (header[i] === name) return i;
  }
  return undefined;
}

// 旧テンプレート形式: 1シート内に「日付」列が2組(販売ブロック/廃棄ブロック)並んでいるレイアウト。
function parseCombinedSheet(rows: unknown[][], headerIdx: number, header: unknown[], dateCols: number[]): ParsedSheet {
  const salesDateCol = dateCols[0];
  const wasteDateCol = dateCols[1];
  const salesColEnd = wasteDateCol;

  const salesCols: Partial<Record<Category, number>> = {};
  const wasteCols: Partial<Record<Category, number>> = {};
  for (const cat of CATEGORIES) {
    const sc = findCategoryCol(header, cat, salesDateCol, salesColEnd);
    if (sc !== undefined) salesCols[cat] = sc;
    const wc = findCategoryCol(header, cat, wasteDateCol, header.length);
    if (wc !== undefined) wasteCols[cat] = wc;
  }

  const entries: PartialEntry[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const dateStr = cellToISODate(row[salesDateCol]);
    if (!dateStr) continue;

    const items: Partial<Record<Category, PartialItem>> = {};
    let hasAmount = false;
    for (const cat of CATEGORIES) {
      const item: PartialItem = {};
      const sc = salesCols[cat];
      if (sc !== undefined && typeof row[sc] === "number") {
        item.salesAmount = row[sc] as number;
        hasAmount = true;
      }
      const wc = wasteCols[cat];
      if (wc !== undefined && typeof row[wc] === "number") {
        item.wasteAmount = row[wc] as number;
        hasAmount = true;
      }
      if (item.salesAmount !== undefined || item.wasteAmount !== undefined) items[cat] = item;
    }
    if (!hasAmount) continue;

    entries.push({ date: dateStr, items });
  }

  return { sheetName: "", kind: "combined", entries, skippedNoDate: 0 };
}

// 実際の運用シート形式: 1シート1ブロック(日付・曜日・天気・気温・セール + カテゴリ別の売上 or 廃棄額)。
function parseSingleBlockSheet(rows: unknown[][], headerIdx: number, header: unknown[], dateCol: number): ParsedSheet {
  const categoryCols: Partial<Record<Category, number>> = {};
  for (const cat of CATEGORIES) {
    const idx = header.indexOf(cat);
    if (idx >= 0) categoryCols[cat] = idx;
  }
  const catIndices = Object.values(categoryCols) as number[];

  // 廃棄入力シートには販売シートからXLOOKUPした「中食販売合計」列もあり(その逆も然り)、
  // ヘッダーのどこかにその文字列があるかだけでは判定できない。カテゴリ列の直前の見出し
  // (自シートの合計列)で判定する。
  let kind: SheetKind = "unrecognized";
  if (catIndices.length > 0) {
    const totalColHeader = header[Math.min(...catIndices) - 1];
    if (totalColHeader === "中食販売合計") kind = "sales";
    else if (totalColHeader === "中食廃棄合計") kind = "waste";
  }

  if (kind === "unrecognized" || catIndices.length === 0) {
    return { sheetName: "", kind: "unrecognized", entries: [], skippedNoDate: 0 };
  }

  // 廃棄入力シートの天気・気温・セール列は販売シートからのXLOOKUPで、
  // 参照エラー時に0でフォールバックされていて信頼できないため、販売シート側のみ条件情報を採用する。
  const weatherCol = kind === "sales" ? header.indexOf("天気") : -1;
  const tempLowCol = kind === "sales" ? header.indexOf("最低気温") : -1;
  const tempHighCol = kind === "sales" ? header.indexOf("最高気温") : -1;
  const saleCol = kind === "sales" ? header.indexOf("セール") : -1;
  const holidayCol = header.indexOf("祝日");

  const entries: PartialEntry[] = [];
  let skippedNoDate = 0;
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];

    const items: Partial<Record<Category, PartialItem>> = {};
    let hasAmount = false;
    for (const cat of CATEGORIES) {
      const idx = categoryCols[cat];
      if (idx === undefined) continue;
      const v = row[idx];
      if (typeof v === "number") {
        items[cat] = kind === "waste" ? { wasteAmount: v } : { salesAmount: v };
        hasAmount = true;
      }
    }

    const weather = weatherCol >= 0 && typeof row[weatherCol] === "string" ? (row[weatherCol] as string) : undefined;
    const tempLow = tempLowCol >= 0 && typeof row[tempLowCol] === "number" ? (row[tempLowCol] as number) : undefined;
    const tempHigh = tempHighCol >= 0 && typeof row[tempHighCol] === "number" ? (row[tempHighCol] as number) : undefined;
    const saleRaw = saleCol >= 0 ? row[saleCol] : undefined;
    const saleCategory =
      typeof saleRaw === "string" && (CATEGORIES as readonly string[]).includes(saleRaw)
        ? (saleRaw as Category)
        : undefined;
    const holiday = holidayCol >= 0 ? Boolean(row[holidayCol]) : undefined;

    const hasContext =
      weather !== undefined || tempLow !== undefined || tempHigh !== undefined || saleCategory !== undefined || holiday !== undefined;
    if (!hasAmount && !hasContext) continue;

    const dateStr = cellToISODate(row[dateCol]);
    if (!dateStr) {
      if (hasAmount) skippedNoDate++;
      continue;
    }

    entries.push({
      date: dateStr,
      weather,
      temperatureLow: tempLow ?? null,
      temperatureHigh: tempHigh ?? null,
      saleCategory,
      holiday,
      items,
    });
  }

  return { sheetName: "", kind, entries, skippedNoDate };
}

function parseSheet(sheetName: string, rows: unknown[][]): ParsedSheet {
  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx < 0) return { sheetName, kind: "unrecognized", entries: [], skippedNoDate: 0 };
  const header = rows[headerIdx] ?? [];

  const dateCols: number[] = [];
  header.forEach((v, i) => {
    if (v === "日付") dateCols.push(i);
  });
  if (dateCols.length === 0) return { sheetName, kind: "unrecognized", entries: [], skippedNoDate: 0 };

  // 構成比(比率)シートは日付列を2組持つことがあるが、金額の生データではないため対象外にする。
  const headerText = header.filter((v) => typeof v === "string").join(" ");
  if (headerText.includes("構成比")) return { sheetName, kind: "unrecognized", entries: [], skippedNoDate: 0 };

  const result =
    dateCols.length >= 2
      ? parseCombinedSheet(rows, headerIdx, header, dateCols)
      : parseSingleBlockSheet(rows, headerIdx, header, dateCols[0]);

  return { ...result, sheetName };
}

export async function parseWorkbookFile(file: File): Promise<ParsedSheet[]> {
  const sheets = await readXlsxFile(file);
  return sheets.map((s: { sheet: string; data: unknown[][] }) => parseSheet(s.sheet, s.data));
}

// 複数シート(販売シート・廃棄シートなど)の断片を日付単位でマージし、完全なDailyEntryにする。
export function mergeParsedSheets(sheets: ParsedSheet[]): DailyEntry[] {
  const map = new Map<string, DailyEntry>();

  for (const sheet of sheets) {
    for (const pe of sheet.entries) {
      const base = map.get(pe.date) ?? createEmptyEntry(pe.date);
      const merged: DailyEntry = {
        ...base,
        weather: base.weather || pe.weather || base.weather,
        temperatureLow: base.temperatureLow ?? pe.temperatureLow ?? null,
        temperatureHigh: base.temperatureHigh ?? pe.temperatureHigh ?? null,
        saleCategory: base.saleCategory || pe.saleCategory || base.saleCategory,
        holiday: base.holiday || pe.holiday || false,
        items: { ...base.items },
      };
      for (const cat of CATEGORIES) {
        const partial = pe.items[cat];
        if (!partial) continue;
        merged.items[cat] = {
          salesAmount: partial.salesAmount ?? merged.items[cat].salesAmount,
          wasteAmount: partial.wasteAmount ?? merged.items[cat].wasteAmount,
        };
      }
      map.set(pe.date, merged);
    }
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
