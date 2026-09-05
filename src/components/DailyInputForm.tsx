import { useState } from "react";
import { CATEGORIES, WEATHER_PRESETS, emptyDayContext } from "../types";
import type { Category, DailyEntry } from "../types";
import { formatDateJP, todayStr } from "../lib/date";
import { formatYen } from "../lib/format";
import type { Location } from "../lib/weather";
import AutoFetchWeatherButton from "./AutoFetchWeatherButton";

// 入力中は「未入力」と「0」を区別できるよう、金額はnull許容の下書き状態として扱う。
// 保存時にnullを0へ変換してDailyEntryへ確定させる。
type DraftItem = { salesAmount: number | null; wasteAmount: number | null };
type DraftItemMap = Record<Category, DraftItem>;
type DraftEntry = Omit<DailyEntry, "items"> & { items: DraftItemMap };

function emptyDraftEntry(date: string): DraftEntry {
  return {
    date,
    ...emptyDayContext(),
    memo: "",
    items: CATEGORIES.reduce((acc, cat) => {
      acc[cat] = { salesAmount: null, wasteAmount: null };
      return acc;
    }, {} as DraftItemMap),
  };
}

interface Props {
  existingDates: string[];
  onSave: (entry: DailyEntry) => void;
  initialEntry?: DailyEntry;
  onCancelEdit?: () => void;
  location: Location | null;
}

export default function DailyInputForm({ existingDates, onSave, initialEntry, onCancelEdit, location }: Props) {
  const [entry, setEntry] = useState<DraftEntry>(initialEntry ?? emptyDraftEntry(todayStr()));

  const isEditing = !!initialEntry;
  const isDuplicate = !isEditing && existingDates.includes(entry.date);

  function updateItem(cat: Category, field: "salesAmount" | "wasteAmount", value: number | null) {
    setEntry((prev) => ({
      ...prev,
      items: { ...prev.items, [cat]: { ...prev.items[cat], [field]: value } },
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isDuplicate) return;
    const finalEntry: DailyEntry = {
      ...entry,
      items: CATEGORIES.reduce((acc, cat) => {
        const draft = entry.items[cat];
        acc[cat] = { salesAmount: draft.salesAmount ?? 0, wasteAmount: draft.wasteAmount ?? 0 };
        return acc;
      }, {} as DailyEntry["items"]),
    };
    onSave(finalEntry);
    if (!isEditing) setEntry(emptyDraftEntry(todayStr()));
  }

  const totalSales = CATEGORIES.reduce((s, c) => s + (entry.items[c]?.salesAmount ?? 0), 0);
  const totalWaste = CATEGORIES.reduce((s, c) => s + (entry.items[c]?.wasteAmount ?? 0), 0);
  const wasteRate = totalSales + totalWaste > 0 ? totalWaste / (totalSales + totalWaste) : 0;

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>{isEditing ? `実績を編集: ${formatDateJP(entry.date)}` : "日次実績入力"}</h2>

      <div className="field-row">
        <label>
          日付
          <input
            type="date"
            value={entry.date}
            disabled={isEditing}
            onChange={(e) => setEntry((prev) => ({ ...prev, date: e.target.value }))}
            required
          />
        </label>
        <label>
          曜日
          <input type="text" value={formatDateJP(entry.date).split("(")[1]?.replace(")", "") ?? ""} disabled />
        </label>
        <label>
          最低気温(℃)
          <input
            type="number"
            step="0.1"
            value={entry.temperatureLow ?? ""}
            onChange={(e) =>
              setEntry((prev) => ({
                ...prev,
                temperatureLow: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
          />
        </label>
        <label>
          最高気温(℃)
          <input
            type="number"
            step="0.1"
            value={entry.temperatureHigh ?? ""}
            onChange={(e) =>
              setEntry((prev) => ({
                ...prev,
                temperatureHigh: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
          />
        </label>
        <label>
          天気
          <input
            type="text"
            list="weather-presets"
            value={entry.weather}
            placeholder="例: 晴れ/くもり"
            onChange={(e) => setEntry((prev) => ({ ...prev, weather: e.target.value }))}
          />
        </label>
        <label>
          セール対象カテゴリ
          <select
            value={entry.saleCategory}
            onChange={(e) => setEntry((prev) => ({ ...prev, saleCategory: e.target.value as Category | "" }))}
          >
            <option value="">なし</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={entry.holiday}
            onChange={(e) => setEntry((prev) => ({ ...prev, holiday: e.target.checked }))}
          />
          祝日
        </label>
      </div>
      <datalist id="weather-presets">
        {WEATHER_PRESETS.map((w) => (
          <option key={w} value={w} />
        ))}
      </datalist>

      <AutoFetchWeatherButton
        location={location}
        date={entry.date}
        onFetched={(w) =>
          setEntry((prev) => ({
            ...prev,
            temperatureLow: w.temperatureLow,
            temperatureHigh: w.temperatureHigh,
            weather: w.weather || prev.weather,
          }))
        }
      />

      <table className="input-table">
        <thead>
          <tr>
            <th>カテゴリ</th>
            <th>売上金額(円)</th>
            <th>廃棄金額(円)</th>
            <th>廃棄率</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((cat) => {
            const item = entry.items[cat];
            const sales = item.salesAmount ?? 0;
            const waste = item.wasteAmount ?? 0;
            const rate = sales + waste > 0 ? waste / (sales + waste) : 0;
            return (
              <tr key={cat}>
                <td>{cat}</td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={item.salesAmount ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      updateItem(cat, "salesAmount", raw === "" ? null : Number(raw));
                    }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={item.wasteAmount ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      updateItem(cat, "wasteAmount", raw === "" ? null : Number(raw));
                    }}
                  />
                </td>
                <td className="muted">{(rate * 100).toFixed(1)}%</td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td>中食合計</td>
            <td>{formatYen(totalSales)}</td>
            <td>{formatYen(totalWaste)}</td>
            <td>{(wasteRate * 100).toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>

      <label>
        メモ
        <input
          type="text"
          value={entry.memo}
          onChange={(e) => setEntry((prev) => ({ ...prev, memo: e.target.value }))}
          placeholder="近隣イベント、欠品など気づいたことがあれば"
        />
      </label>

      {isDuplicate && <p className="warning">この日付は既に入力済みです。一覧から編集してください。</p>}

      <div className="form-actions">
        <button type="submit" disabled={isDuplicate}>
          {isEditing ? "更新する" : "保存する"}
        </button>
        {isEditing && onCancelEdit && (
          <button type="button" className="secondary" onClick={onCancelEdit}>
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
