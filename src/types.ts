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

// よく使われる組み合わせを候補として提示するためのプリセット。自由入力も可能。
export const WEATHER_PRESETS = [
  "晴れ",
  "くもり",
  "雨",
  "雪",
  "晴れ/くもり",
  "晴れ/雨",
  "くもり/雨",
] as const;

export interface ItemPerformance {
  salesAmount: number; // 売上金額(円)
  wasteAmount: number; // 廃棄金額(円)
}

export type ItemPerformanceMap = Record<Category, ItemPerformance>;

// 実績データと発注提案フォームの両方で使う、日付に紐づく共通の条件項目。
export interface DayContext {
  weather: string; // 自由入力(例: "晴れ", "晴れ/雨")
  temperatureLow: number | null; // 最低気温(℃)
  temperatureHigh: number | null; // 最高気温(℃)
  saleCategory: Category | ""; // その日セール対象だったカテゴリ(なければ空文字)
  holiday: boolean; // 祝日フラグ
}

export interface DailyEntry extends DayContext {
  date: string; // YYYY-MM-DD, unique key
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

export function emptyDayContext(): DayContext {
  return {
    weather: "",
    temperatureLow: null,
    temperatureHigh: null,
    saleCategory: "",
    holiday: false,
  };
}

export function createEmptyEntry(date: string): DailyEntry {
  return {
    date,
    ...emptyDayContext(),
    memo: "",
    items: emptyItemMap(),
  };
}

export interface AnalysisSettings {
  useTemperature: boolean;
  useWeather: boolean;
  useSale: boolean;
  useHoliday: boolean;
  useTrend: boolean;
  targetWasteRate: Record<Category, number>; // 0-1
}

export function defaultAnalysisSettings(): AnalysisSettings {
  return {
    useTemperature: true,
    useWeather: true,
    useSale: true,
    useHoliday: false,
    useTrend: false,
    targetWasteRate: CATEGORIES.reduce((acc, cat) => {
      acc[cat] = 0.05;
      return acc;
    }, {} as Record<Category, number>),
  };
}
