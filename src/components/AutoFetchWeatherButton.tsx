import { useState } from "react";
import type { DailyWeather, Location } from "../lib/weather";
import { fetchDailyWeather } from "../lib/weather";
import { isJapaneseHoliday } from "../lib/holidays";

export interface FetchedConditions extends DailyWeather {
  holiday: boolean | null; // 取得できなかった場合はnull(既存の値を変更しない)
}

interface Props {
  location: Location | null;
  date: string;
  onFetched: (conditions: FetchedConditions) => void;
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
      const [weatherResult, holidayResult] = await Promise.allSettled([
        fetchDailyWeather(location, date),
        isJapaneseHoliday(date),
      ]);

      if (weatherResult.status === "rejected") {
        setError("取得に失敗しました");
        return;
      }

      onFetched({
        ...weatherResult.value,
        holiday: holidayResult.status === "fulfilled" ? holidayResult.value : null,
      });
      if (holidayResult.status === "rejected") {
        setError("天気は取得できましたが、祝日データの取得に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auto-fetch-row">
      <button type="button" className="secondary" onClick={handleClick} disabled={loading || !date}>
        {loading ? "取得中..." : "気温・天気・祝日を自動取得"}
      </button>
      {error && <span className="warning small">{error}</span>}
    </div>
  );
}
