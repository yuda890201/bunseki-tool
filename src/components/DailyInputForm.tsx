import { useEffect, useRef, useState } from "react";
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

const AMOUNT_INPUT_COUNT = CATEGORIES.length * 2;

export default function DailyInputForm({ existingDates, onSave, initialEntry, onCancelEdit, location }: Props) {
  const [entry, setEntry] = useState<DraftEntry>(initialEntry ?? emptyDraftEntry(todayStr()));
  const amountTableRef = useRef<HTMLTableElement>(null);
  const [activeAmountIndex, setActiveAmountIndex] = useState<number | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const blurTimer = useRef<number | null>(null);

  const isEditing = !!initialEntry;
  const isDuplicate = !isEditing && existingDates.includes(entry.date);

  // iOSのテンキーはEnterキー自体が存在せず、上部のく/だけのアクセサリバーは
  // JSからキー入力として検知できないため、それとは別に自前の「次へ」バーを
  // キーボードの直上(visualViewport基準)に表示して確実に次項目へ移動できるようにする。
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      if (!vv) return;
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(Math.max(0, Math.round(offset)));
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  function focusAmountIndex(index: number) {
    const el = amountTableRef.current?.querySelector<HTMLInputElement>(`[data-amount-index="${index}"]`);
    el?.focus();
    el?.select();
  }

  // 開いてすぐ入力に取りかかれるよう、新規入力時は最初の金額欄に自動でフォーカスする
  // (既存データの編集時は、確認が先になることが多いので自動フォーカスしない)。
  useEffect(() => {
    if (!isEditing) focusAmountIndex(0);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- 初回マウント時のみ実行したい
  }, []);

  function handleAmountFocus(index: number) {
    if (blurTimer.current !== null) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setActiveAmountIndex(index);
  }

  function handleAmountBlur() {
    blurTimer.current = window.setTimeout(() => setActiveAmountIndex(null), 150);
  }

  // テンキーの「次へ」で連続入力できるよう、Enterで次の金額欄へフォーカスを送る
  // (Androidなど、テンキー自体にEnter相当のキーがある端末向け)。
  // 最後の欄はキーボードを閉じるだけにする(誤送信を避けるため自動保存はしない)。
  function handleAmountKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index >= AMOUNT_INPUT_COUNT - 1) {
      e.currentTarget.blur();
      return;
    }
    focusAmountIndex(index + 1);
  }

  function handleToolbarNext() {
    if (activeAmountIndex === null) return;
    if (activeAmountIndex >= AMOUNT_INPUT_COUNT - 1) {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    focusAmountIndex(activeAmountIndex + 1);
  }

  function handleToolbarPrev() {
    if (activeAmountIndex === null || activeAmountIndex <= 0) return;
    focusAmountIndex(activeAmountIndex - 1);
  }

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

      <table className="input-table" ref={amountTableRef}>
        <thead>
          <tr>
            <th>カテゴリ</th>
            <th>売上金額(円)</th>
            <th>廃棄金額(円)</th>
            <th>廃棄率</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((cat, i) => {
            const item = entry.items[cat];
            const sales = item.salesAmount ?? 0;
            const waste = item.wasteAmount ?? 0;
            const rate = sales + waste > 0 ? waste / (sales + waste) : 0;
            const salesIndex = i * 2;
            const wasteIndex = i * 2 + 1;
            return (
              <tr key={cat}>
                <td>{cat}</td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint={salesIndex === AMOUNT_INPUT_COUNT - 1 ? "done" : "next"}
                    data-amount-index={salesIndex}
                    placeholder="0"
                    value={item.salesAmount ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      updateItem(cat, "salesAmount", raw === "" ? null : Number(raw));
                    }}
                    onKeyDown={(e) => handleAmountKeyDown(e, salesIndex)}
                    onFocus={() => handleAmountFocus(salesIndex)}
                    onBlur={handleAmountBlur}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint={wasteIndex === AMOUNT_INPUT_COUNT - 1 ? "done" : "next"}
                    data-amount-index={wasteIndex}
                    placeholder="0"
                    value={item.wasteAmount ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      updateItem(cat, "wasteAmount", raw === "" ? null : Number(raw));
                    }}
                    onKeyDown={(e) => handleAmountKeyDown(e, wasteIndex)}
                    onFocus={() => handleAmountFocus(wasteIndex)}
                    onBlur={handleAmountBlur}
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

      {activeAmountIndex !== null && (
        <div className="keypad-toolbar" style={{ bottom: keyboardOffset }}>
          <button
            type="button"
            className="secondary"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToolbarPrev}
            disabled={activeAmountIndex <= 0}
          >
            ◀ 前へ
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleToolbarNext}>
            {activeAmountIndex >= AMOUNT_INPUT_COUNT - 1 ? "完了" : "次へ ▶"}
          </button>
        </div>
      )}
    </form>
  );
}
