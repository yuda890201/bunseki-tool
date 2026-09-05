export interface Location {
  name: string;
  lat: number;
  lon: number;
}

export interface DailyWeather {
  temperatureLow: number | null;
  temperatureHigh: number | null;
  weather: string;
}

// Open-Meteo の WMO weather code を、このアプリで使う天気表記に単純化する。
const WMO_LABEL: Record<number, string> = {
  0: "晴れ",
  1: "晴れ",
  2: "くもり",
  3: "くもり",
  45: "くもり",
  48: "くもり",
  51: "雨",
  53: "雨",
  55: "雨",
  56: "雨",
  57: "雨",
  61: "雨",
  63: "雨",
  65: "雨",
  66: "雨",
  67: "雨",
  71: "雪",
  73: "雪",
  75: "雪",
  77: "雪",
  80: "雨",
  81: "雨",
  82: "雨",
  85: "雪",
  86: "雪",
  95: "雨",
  96: "雨",
  97: "雨",
  99: "雨",
};

function weatherLabel(code: unknown): string {
  return typeof code === "number" && code in WMO_LABEL ? WMO_LABEL[code] : "";
}

// 直近92日より前は正式な過去実績(アーカイブAPI)、それ以外(直近92日〜16日先の予報)は
// 予報APIを使う。Open-Meteoはどちらもキー不要・CORS対応で、ブラウザから直接叩ける。
function pickEndpoint(dateISO: string): string {
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const targetUTC = new Date(`${dateISO}T00:00:00Z`).getTime();
  const diffDays = Math.round((targetUTC - todayUTC) / 86400000);
  return diffDays < -92
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";
}

export async function fetchDailyWeather(location: Location, dateISO: string): Promise<DailyWeather> {
  const url = new URL(pickEndpoint(dateISO));
  url.searchParams.set("latitude", String(location.lat));
  url.searchParams.set("longitude", String(location.lon));
  url.searchParams.set("start_date", dateISO);
  url.searchParams.set("end_date", dateISO);
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weathercode");
  url.searchParams.set("timezone", "Asia/Tokyo");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("気象データの取得に失敗しました");
  const data = await res.json();

  const high = data?.daily?.temperature_2m_max?.[0];
  const low = data?.daily?.temperature_2m_min?.[0];
  const code = data?.daily?.weathercode?.[0];

  return {
    temperatureHigh: typeof high === "number" ? high : null,
    temperatureLow: typeof low === "number" ? low : null,
    weather: weatherLabel(code),
  };
}

export async function searchLocations(query: string): Promise<Location[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "ja");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("地点の検索に失敗しました");
  const data = await res.json();
  const results: unknown[] = Array.isArray(data?.results) ? data.results : [];

  return results
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      name: [r.name, r.admin1, r.country].filter((v) => typeof v === "string" && v).join(" "),
      lat: r.latitude as number,
      lon: r.longitude as number,
    }));
}
