import { buildDesignMatrix, buildForecastRow, targetValues, withIntercept } from "./features";
import { runOLS } from "./regression";
import { weekdayIndex } from "./date";
import type { AnalysisSettings, Category, DailyEntry, DayContext } from "../types";

export type OrderInput = DayContext & { date: string };

export interface CategoryForecast {
  category: Category;
  method: "regression" | "weekday_average" | "insufficient_data";
  predictedAmount: number; // 予測売上金額(円)
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
  const sum = pool.reduce((s, e) => s + e.items[category].salesAmount, 0);
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
      predictedAmount: 0,
      sampleSize: 0,
      r2: null,
      note: "実績データがありません",
    };
  }

  const design = buildDesignMatrix(entries, settings, category);
  const k = design.featureNames.length + 1; // + intercept

  if (design.usedEntries.length >= Math.max(MIN_ROWS_FOR_REGRESSION, k + 3)) {
    try {
      const y = targetValues(design.usedEntries, category, "salesAmount");
      const X = withIntercept(design.rows);
      const result = runOLS(X, y, ["切片", ...design.featureNames]);
      const minDate = design.usedEntries[0].date;
      const forecastRow = buildForecastRow(settings, input, minDate, category);
      const predicted = [1, ...forecastRow].reduce(
        (sum, val, i) => sum + val * result.coefficients[i],
        0
      );
      return {
        category,
        method: "regression",
        predictedAmount: Math.max(0, predicted),
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
    predictedAmount: avg,
    sampleSize: entries.length,
    r2: null,
    note: "データ不足のため同一曜日の平均実績から算出",
  };
}

export interface OrderSuggestion extends CategoryForecast {
  targetWasteRate: number;
  suggestedOrderAmount: number; // 推奨発注金額(円)
  expectedWasteAmount: number; // 予測廃棄金額(円)
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
  const suggestedOrderAmount = Math.ceil(forecast.predictedAmount / denom);
  const expectedWasteAmount = Math.max(0, suggestedOrderAmount - forecast.predictedAmount);
  return { ...forecast, targetWasteRate: targetRate, suggestedOrderAmount, expectedWasteAmount };
}
