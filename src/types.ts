export const CATEGORIES = [
  "米飯",
  "調理麺",
  "調理パン",
  "サラダ",
  "総菜",
  "デザート",
  "パン",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const WEATHER_OPTIONS = ["晴れ", "曇り", "雨", "雪"] as const;
export type Weather = (typeof WEATHER_OPTIONS)[number] | "";

export interface ItemPerformance {
  salesAmount: number; // 売上金額(円)
  wasteAmount: number; // 廃棄金額(円)
}

export type ItemPerformanceMap = Record<Category, ItemPerformance>;

export interface DailyEntry {
  date: string; // YYYY-MM-DD, unique key
  weather: Weather;
  temperature: number | null; // 気温(℃)
  event: boolean; // 特売・催事フラグ
  memo: string;
  items: ItemPerformanceMap;
}

export const WEEKDAYS_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function emptyItemMap(): ItemPerformanceMap {
  return CATEGORIES.reduce((acc, cat) => {
    acc[cat] = { salesAmount: 0, wasteAmount: 0 };
    return acc;
  }, {} as ItemPerformanceMap);
}

export function createEmptyEntry(date: string): DailyEntry {
  return {
    date,
    weather: "",
    temperature: null,
    event: false,
    memo: "",
    items: emptyItemMap(),
  };
}

export interface AnalysisSettings {
  useTemperature: boolean;
  useWeather: boolean;
  useEvent: boolean;
  useTrend: boolean;
  targetWasteRate: Record<Category, number>; // 0-1
}

export function defaultAnalysisSettings(): AnalysisSettings {
  return {
    useTemperature: true,
    useWeather: true,
    useEvent: true,
    useTrend: false,
    targetWasteRate: CATEGORIES.reduce((acc, cat) => {
      acc[cat] = 0.05;
      return acc;
    }, {} as Record<Category, number>),
  };
}
