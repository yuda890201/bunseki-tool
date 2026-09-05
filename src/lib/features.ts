import { weekdayIndex, daysBetween } from "./date";
import { WEEKDAYS_JP } from "../types";
import type { AnalysisSettings, Category, DailyEntry, Weather } from "../types";

// Baselines: 曜日=日, 天気=晴れ. Dummies are generated relative to these.
const WEEKDAY_DUMMY_NAMES = WEEKDAYS_JP.slice(1).map((w) => `曜日_${w}`); // 月..土
const WEATHER_DUMMY_NAMES = ["曇り", "雨", "雪"].map((w) => `天気_${w}`);

export interface BuiltDesign {
  featureNames: string[]; // without intercept
  rows: number[][]; // one row per used entry, aligned with usedEntries
  usedEntries: DailyEntry[];
}

export function featureNames(settings: AnalysisSettings, minDate: string): string[] {
  const names = [...WEEKDAY_DUMMY_NAMES];
  if (settings.useTemperature) names.push("気温");
  if (settings.useWeather) names.push(...WEATHER_DUMMY_NAMES);
  if (settings.useEvent) names.push("イベント");
  if (settings.useTrend) names.push("経過日数");
  void minDate;
  return names;
}

function weekdayDummies(dateStr: string): number[] {
  const idx = weekdayIndex(dateStr); // 0=日..6=土
  const out = new Array(6).fill(0);
  if (idx > 0) out[idx - 1] = 1;
  return out;
}

function weatherDummies(weather: Weather): number[] {
  const out = [0, 0, 0];
  const map: Record<string, number> = { 曇り: 0, 雨: 1, 雪: 2 };
  if (weather && weather in map) out[map[weather]] = 1;
  return out;
}

export function buildDesignMatrix(
  entries: DailyEntry[],
  settings: AnalysisSettings
): BuiltDesign {
  const names = featureNames(settings, entries[0]?.date ?? "");
  const minDate = entries.reduce(
    (min, e) => (min === "" || e.date < min ? e.date : min),
    ""
  );

  const usedEntries: DailyEntry[] = [];
  const rows: number[][] = [];

  for (const entry of entries) {
    if (settings.useTemperature && entry.temperature === null) continue;
    if (settings.useWeather && !entry.weather) continue;

    const row: number[] = [...weekdayDummies(entry.date)];
    if (settings.useTemperature) row.push(entry.temperature as number);
    if (settings.useWeather) row.push(...weatherDummies(entry.weather));
    if (settings.useEvent) row.push(entry.event ? 1 : 0);
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
  input: { date: string; temperature: number | null; weather: Weather; event: boolean },
  minDate: string
): number[] {
  const row: number[] = [...weekdayDummies(input.date)];
  if (settings.useTemperature) row.push(input.temperature ?? 0);
  if (settings.useWeather) row.push(...weatherDummies(input.weather));
  if (settings.useEvent) row.push(input.event ? 1 : 0);
  if (settings.useTrend) row.push(daysBetween(minDate, input.date));
  return row;
}
