import { useMemo, useState } from "react";
import { CATEGORIES, WEATHER_OPTIONS } from "../types";
import type { AnalysisSettings, DailyEntry, Weather } from "../types";
import { formatDateJP, tomorrowStr } from "../lib/date";
import { formatYen } from "../lib/format";
import { suggestOrder } from "../lib/forecast";

interface Props {
  entries: DailyEntry[];
  settings: AnalysisSettings;
  onSettingsChange: (settings: AnalysisSettings) => void;
}

export default function OrderSuggestionPanel({ entries, settings, onSettingsChange }: Props) {
  const [date, setDate] = useState(tomorrowStr());
  const [temperature, setTemperature] = useState<number | null>(null);
  const [weather, setWeather] = useState<Weather>("");
  const [event, setEvent] = useState(false);

  const suggestions = useMemo(() => {
    if (entries.length === 0) return [];
    const input = { date, temperature, weather, event };
    return CATEGORIES.map((cat) => suggestOrder(entries, cat, settings, input));
  }, [entries, settings, date, temperature, weather, event]);

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
          <label>
            予想気温(℃)
            <input
              type="number"
              step="0.1"
              value={temperature ?? ""}
              onChange={(e) => setTemperature(e.target.value === "" ? null : Number(e.target.value))}
            />
          </label>
        )}
        {settings.useWeather && (
          <label>
            予想天気
            <select value={weather} onChange={(e) => setWeather(e.target.value as Weather)}>
              <option value="">未選択</option>
              {WEATHER_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        )}
        {settings.useEvent && (
          <label className="checkbox-label">
            <input type="checkbox" checked={event} onChange={(e) => setEvent(e.target.checked)} />
            特売・催事あり
          </label>
        )}
      </div>

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
