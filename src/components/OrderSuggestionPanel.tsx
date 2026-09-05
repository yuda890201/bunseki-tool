import { useMemo, useState } from "react";
import { CATEGORIES, WEATHER_PRESETS } from "../types";
import type { AnalysisSettings, Category, DailyEntry } from "../types";
import { formatDateJP, tomorrowStr } from "../lib/date";
import { formatYen } from "../lib/format";
import { suggestOrder } from "../lib/forecast";
import type { Location } from "../lib/weather";
import AutoFetchWeatherButton from "./AutoFetchWeatherButton";

interface Props {
  entries: DailyEntry[];
  settings: AnalysisSettings;
  onSettingsChange: (settings: AnalysisSettings) => void;
  location: Location | null;
}

export default function OrderSuggestionPanel({ entries, settings, onSettingsChange, location }: Props) {
  const [date, setDate] = useState(tomorrowStr());
  const [temperatureLow, setTemperatureLow] = useState<number | null>(null);
  const [temperatureHigh, setTemperatureHigh] = useState<number | null>(null);
  const [weather, setWeather] = useState("");
  const [saleCategory, setSaleCategory] = useState<Category | "">("");
  const [holiday, setHoliday] = useState(false);

  const suggestions = useMemo(() => {
    if (entries.length === 0) return [];
    const input = { date, temperatureLow, temperatureHigh, weather, saleCategory, holiday };
    return CATEGORIES.map((cat) => suggestOrder(entries, cat, settings, input));
  }, [entries, settings, date, temperatureLow, temperatureHigh, weather, saleCategory, holiday]);

  function updateTargetRate(cat: (typeof CATEGORIES)[number], value: number) {
    onSettingsChange({
      ...settings,
      targetWasteRate: { ...settings.targetWasteRate, [cat]: value },
    });
  }

  return (
    <div className="card">
      <h2>発注提案</h2>
      <p className="muted">
        分析結果(データが十分な場合は重回帰モデル、不足時は同一曜日の平均実績)から、
        指定した目標廃棄率になるように発注金額を提案します。
      </p>

      <div className="field-row">
        <label>
          発注対象日
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          曜日
          <input type="text" value={formatDateJP(date).split("(")[1]?.replace(")", "") ?? ""} disabled />
        </label>
        {settings.useTemperature && (
          <>
            <label>
              予想最低気温(℃)
              <input
                type="number"
                step="0.1"
                value={temperatureLow ?? ""}
                onChange={(e) => setTemperatureLow(e.target.value === "" ? null : Number(e.target.value))}
              />
            </label>
            <label>
              予想最高気温(℃)
              <input
                type="number"
                step="0.1"
                value={temperatureHigh ?? ""}
                onChange={(e) => setTemperatureHigh(e.target.value === "" ? null : Number(e.target.value))}
              />
            </label>
          </>
        )}
        {settings.useWeather && (
          <label>
            予想天気
            <input
              type="text"
              list="weather-presets-order"
              value={weather}
              placeholder="例: 晴れ/くもり"
              onChange={(e) => setWeather(e.target.value)}
            />
            <datalist id="weather-presets-order">
              {WEATHER_PRESETS.map((w) => (
                <option key={w} value={w} />
              ))}
            </datalist>
          </label>
        )}
        {settings.useSale && (
          <label>
            セール対象カテゴリ
            <select value={saleCategory} onChange={(e) => setSaleCategory(e.target.value as Category | "")}>
              <option value="">なし</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        {settings.useHoliday && (
          <label className="checkbox-label">
            <input type="checkbox" checked={holiday} onChange={(e) => setHoliday(e.target.checked)} />
            祝日
          </label>
        )}
      </div>

      {(settings.useTemperature || settings.useWeather) && (
        <AutoFetchWeatherButton
          location={location}
          date={date}
          onFetched={(w) => {
            if (w.temperatureLow !== null) setTemperatureLow(w.temperatureLow);
            if (w.temperatureHigh !== null) setTemperatureHigh(w.temperatureHigh);
            if (w.weather) setWeather(w.weather);
          }}
        />
      )}

      {entries.length === 0 ? (
        <p className="warning">実績データがありません。まず「入力」タブから登録してください。</p>
      ) : (
        <table className="coef-table">
          <thead>
            <tr>
              <th>カテゴリ</th>
              <th>予測売上金額</th>
              <th>目標廃棄率</th>
              <th>推奨発注金額</th>
              <th>予測廃棄金額</th>
              <th>算出方法</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.category}>
                <td>{s.category}</td>
                <td>{formatYen(s.predictedAmount)}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    step={1}
                    value={Math.round(s.targetWasteRate * 100)}
                    onChange={(e) => updateTargetRate(s.category, Number(e.target.value) / 100)}
                    style={{ width: "4.5rem" }}
                  />
                  %
                </td>
                <td className="strong">{formatYen(s.suggestedOrderAmount)}</td>
                <td>{formatYen(s.expectedWasteAmount)}</td>
                <td className="muted small">{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
