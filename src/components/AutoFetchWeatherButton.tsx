import { useState } from "react";
import type { DailyWeather, Location } from "../lib/weather";
import { fetchDailyWeather } from "../lib/weather";

interface Props {
  location: Location | null;
  date: string;
  onFetched: (weather: DailyWeather) => void;
}

export default function AutoFetchWeatherButton({ location, date, onFetched }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (!location) {
      setError("先に地点を設定してください");
      return;
    }
    setLoading(true);
    setError("");
    try {
      onFetched(await fetchDailyWeather(location, date));
    } catch {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auto-fetch-row">
      <button type="button" className="secondary" onClick={handleClick} disabled={loading || !date}>
        {loading ? "取得中..." : "気温・天気を自動取得"}
      </button>
      {error && <span className="warning small">{error}</span>}
    </div>
  );
}
