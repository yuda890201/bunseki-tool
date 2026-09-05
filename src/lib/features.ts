import { weekdayIndex, daysBetween } from "./date";
import { WEEKDAYS_JP } from "../types";
import type { AnalysisSettings, Category, DailyEntry, DayContext } from "../types";

// Baselines: 曜日=日, 天気=晴れ(雨・くもり・雪のいずれも含まない). Dummies are relative to these.
const WEEKDAY_DUMMY_NAMES = WEEKDAYS_JP.slice(1).map((w) => `曜日_${w}`); // 月..土
const WEATHER_DUMMY_NAMES = ["雨", "くもり", "雪"];

export interface BuiltDesign {
  featureNames: string[]; // without intercept
  rows: number[][]; // one row per used entry, aligned with usedEntries
  usedEntries: DailyEntry[];
}

export function avgTemp(low: number | null, high: number | null): number | null {
  if (low === null || high === null) return null;
  return (low + high) / 2;
}

export function featureNames(settings: AnalysisSettings): string[] {
  const names = [...WEEKDAY_DUMMY_NAMES];
  if (settings.useTemperature) names.push("気温(平均)");
  if (settings.useWeather) names.push(...WEATHER_DUMMY_NAMES.map((w) => `天気_${w}`));
  if (settings.useSale) names.push("セール");
  if (settings.useHoliday) names.push("祝日");
  if (settings.useTrend) names.push("経過日数");
  return names;
}

function weekdayDummies(dateStr: string): number[] {
  const idx = weekdayIndex(dateStr); // 0=日..6=土
  const out = new Array(6).fill(0);
  if (idx > 0) out[idx - 1] = 1;
  return out;
}

// くもり/雨のような複合表記も部分一致で拾う(晴れ以外はいずれかのフラグが立つ)。
function weatherDummies(weather: string): number[] {
  return [weather.includes("雨") ? 1 : 0, weather.includes("くもり") || weather.includes("曇") ? 1 : 0, weather.includes("雪") ? 1 : 0];
}

// 「合計」を目的変数にする場合はどれか1カテゴリでもセール中なら1、
// 個別カテゴリの場合はそのカテゴリ自身がセール中の日だけ1にする。
function saleDummy(saleCategory: Category | "", target: Category | "合計"): number {
  if (target === "合計") return saleCategory !== "" ? 1 : 0;
  return saleCategory === target ? 1 : 0;
}

function contextRow(settings: AnalysisSettings, ctx: DayContext, target: Category | "合計"): number[] {
  const row: number[] = [];
  if (settings.useTemperature) row.push(avgTemp(ctx.temperatureLow, ctx.temperatureHigh) as number);
  if (settings.useWeather) row.push(...weatherDummies(ctx.weather));
  if (settings.useSale) row.push(saleDummy(ctx.saleCategory, target));
  if (settings.useHoliday) row.push(ctx.holiday ? 1 : 0);
  return row;
}

export function buildDesignMatrix(
  entries: DailyEntry[],
  settings: AnalysisSettings,
  target: Category | "合計"
): BuiltDesign {
  const names = featureNames(settings);
  const minDate = entries.reduce(
    (min, e) => (min === "" || e.date < min ? e.date : min),
    ""
  );

  const usedEntries: DailyEntry[] = [];
  const rows: number[][] = [];

  for (const entry of entries) {
    if (settings.useTemperature && avgTemp(entry.temperatureLow, entry.temperatureHigh) === null) continue;
    if (settings.useWeather && !entry.weather) continue;

    const row: number[] = [...weekdayDummies(entry.date), ...contextRow(settings, entry, target)];
    if (settings.useTrend) row.push(daysBetween(minDate, entry.date));

    rows.push(row);
    usedEntries.push(entry);
  }

  return { featureNames: names, rows, usedEntries };
}

export function withIntercept(rows: number[][]): number[][] {
  return rows.map((row) => [1, ...row]);
}

export function targetValues(
  entries: DailyEntry[],
  category: Category | "合計",
  kind: "salesAmount" | "wasteAmount"
): number[] {
  return entries.map((e) => {
    if (category === "合計") {
      return Object.values(e.items).reduce((sum, item) => sum + item[kind], 0);
    }
    return e.items[category][kind];
  });
}

export function buildForecastRow(
  settings: AnalysisSettings,
  input: DayContext & { date: string },
  minDate: string,
  target: Category | "合計"
): number[] {
  const row: number[] = [...weekdayDummies(input.date), ...contextRow(settings, input, target)];
  if (settings.useTrend) row.push(daysBetween(minDate, input.date));
  return row;
}
