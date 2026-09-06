// 日本の祝日データ。holidays-jp/api (https://github.com/holidays-jp/api) が公開している
// 静的JSON(キー無し・CORS対応)を使い、一度取得したら localStorage に保存して使い回す。
const CACHE_KEY = "bunseki-tool:holidays-jp";

type HolidayMap = Record<string, string>; // "YYYY-MM-DD" -> 祝日名

let memoryCache: HolidayMap | null = null;

async function loadHolidayMap(): Promise<HolidayMap> {
  if (memoryCache) return memoryCache;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      memoryCache = JSON.parse(cached) as HolidayMap;
      return memoryCache;
    }
  } catch {
    // 壊れたキャッシュは無視してAPIから取り直す
  }

  const res = await fetch("https://holidays-jp.github.io/api/v1/date.json");
  if (!res.ok) throw new Error("祝日データの取得に失敗しました");
  const data = (await res.json()) as HolidayMap;
  memoryCache = data;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // 保存できなくても致命的ではないので無視する
  }
  return data;
}

export async function isJapaneseHoliday(dateISO: string): Promise<boolean> {
  const map = await loadHolidayMap();
  return dateISO in map;
}
