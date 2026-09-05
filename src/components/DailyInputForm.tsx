import { useState } from "react";
import { CATEGORIES, WEATHER_OPTIONS, createEmptyEntry } from "../types";
import type { Category, DailyEntry, Weather } from "../types";
import { formatDateJP, todayStr } from "../lib/date";
import { formatYen } from "../lib/format";

interface Props {
  existingDates: string[];
  onSave: (entry: DailyEntry) => void;
  initialEntry?: DailyEntry;
  onCancelEdit?: () => void;
}

export default function DailyInputForm({ existingDates, onSave, initialEntry, onCancelEdit }: Props) {
  const [entry, setEntry] = useState<DailyEntry>(initialEntry ?? createEmptyEntry(todayStr()));

  const isEditing = !!initialEntry;
  const isDuplicate = !isEditing && existingDates.includes(entry.date);

  function updateItem(cat: Category, field: "salesAmount" | "wasteAmount", value: number) {
    setEntry((prev) => ({
      ...prev,
      items: { ...prev.items, [cat]: { ...prev.items[cat], [field]: value } },
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isDuplicate) return;
    onSave(entry);
    if (!isEditing) setEntry(createEmptyEntry(todayStr()));
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
          気温(℃)
          <input
            type="number"
            step="0.1"
            value={entry.temperature ?? ""}
            onChange={(e) =>
              setEntry((prev) => ({
                ...prev,
                temperature: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
          />
        </label>
        <label>
          天気
          <select
            value={entry.weather}
            onChange={(e) => setEntry((prev) => ({ ...prev, weather: e.target.value as Weather }))}
          >
            <option value="">未選択</option>
            {WEATHER_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={entry.event}
            onChange={(e) => setEntry((prev) => ({ ...prev, event: e.target.checked }))}
          />
          特売・催事あり
        </label>
      </div>

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
            const rate =
              item.salesAmount + item.wasteAmount > 0
                ? item.wasteAmount / (item.salesAmount + item.wasteAmount)
                : 0;
            return (
              <tr key={cat}>
                <td>{cat}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={item.salesAmount}
                    onChange={(e) => updateItem(cat, "salesAmount", Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={item.wasteAmount}
                    onChange={(e) => updateItem(cat, "wasteAmount", Number(e.target.value))}
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
