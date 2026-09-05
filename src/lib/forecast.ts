import { buildDesignMatrix, buildForecastRow, targetValues, withIntercept } from "./features";
import { runOLS } from "./regression";
import { weekdayIndex } from "./date";
import type { AnalysisSettings, Category, DailyEntry, Weather } from "../types";

export interface OrderInput {
  date: string;
  temperature: number | null;
  weather: Weather;
  event: boolean;
}

export interface CategoryForecast {
  category: Category;
  method: "regression" | "weekday_average" | "insufficient_data";
  predictedSales: number;
  sampleSize: number;
  r2: number | null;
  note: string;
}

const MIN_ROWS_FOR_REGRESSION = 10;

function weekdayAverage(entries: DailyEntry[], category: Category, dateStr: string): number {
  const idx = weekdayIndex(dateStr);
  const sameWeekday = entries.filter((e) => weekdayIndex(e.date) === idx);
  const pool = sameWeekday.length >= 3 ? sameWeekday : entries;
  if (pool.length === 0) return 0;
  const sum = pool.reduce((s, e) => s + e.items[category].sales, 0);
  return sum / pool.length;
}

export function forecastCategory(
  entries: DailyEntry[],
  category: Category,
  settings: AnalysisSettings,
  input: OrderInput
): CategoryForecast {
  if (entries.length === 0) {
    return {
      category,
      method: "insufficient_data",
      predictedSales: 0,
      sampleSize: 0,
      r2: null,
      note: "実績データがありません",
    };
  }

  const design = buildDesignMatrix(entries, settings);
  const k = design.featureNames.length + 1; // + intercept

  if (design.usedEntries.length >= Math.max(MIN_ROWS_FOR_REGRESSION, k + 3)) {
    try {
      const y = targetValues(design.usedEntries, category, "sales");
      const X = withIntercept(design.rows);
      const result = runOLS(X, y, ["切片", ...design.featureNames]);
      const minDate = design.usedEntries[0].date;
      const forecastRow = buildForecastRow(settings, input, minDate);
      const predicted = [1, ...forecastRow].reduce(
        (sum, val, i) => sum + val * result.coefficients[i],
        0
      );
      return {
        category,
        method: "regression",
        predictedSales: Math.max(0, predicted),
        sampleSize: result.n,
        r2: result.r2,
        note: `回帰モデル(n=${result.n}, R²=${result.r2.toFixed(2)})による予測`,
      };
    } catch {
      // fall through to weekday average
    }
  }

  const avg = weekdayAverage(entries, category, input.date);
  return {
    category,
    method: entries.length > 0 ? "weekday_average" : "insufficient_data",
    predictedSales: avg,
    sampleSize: entries.length,
    r2: null,
    note: "データ不足のため同一曜日の平均実績から算出",
  };
}

export interface OrderSuggestion extends CategoryForecast {
  targetWasteRate: number;
  suggestedOrder: number;
  expectedWaste: number;
}

export function suggestOrder(
  entries: DailyEntry[],
  category: Category,
  settings: AnalysisSettings,
  input: OrderInput
): OrderSuggestion {
  const forecast = forecastCategory(entries, category, settings, input);
  const targetRate = settings.targetWasteRate[category] ?? 0.05;
  const denom = Math.max(1e-6, 1 - targetRate);
  const suggestedOrder = Math.ceil(forecast.predictedSales / denom);
  const expectedWaste = Math.max(0, suggestedOrder - forecast.predictedSales);
  return { ...forecast, targetWasteRate: targetRate, suggestedOrder, expectedWaste };
}
