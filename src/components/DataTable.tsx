import { Fragment } from "react";
import { CATEGORIES } from "../types";
import type { DailyEntry } from "../types";
import { formatDateJP } from "../lib/date";
import { formatYen } from "../lib/format";

interface Props {
  entries: DailyEntry[];
  onEdit: (entry: DailyEntry) => void;
  onDelete: (date: string) => void;
}

export default function DataTable({ entries, onEdit, onDelete }: Props) {
  if (entries.length === 0) {
    return <p className="muted">まだ実績データがありません。「入力」タブから登録してください。</p>;
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th rowSpan={2}>日付</th>
            <th rowSpan={2}>気温(低/高)</th>
            <th rowSpan={2}>天気</th>
            <th rowSpan={2}>セール</th>
            <th rowSpan={2}>祝日</th>
            {CATEGORIES.map((cat) => (
              <th key={cat} colSpan={3}>
                {cat}
              </th>
            ))}
            <th colSpan={3}>合計</th>
            <th rowSpan={2}></th>
          </tr>
          <tr>
            {[...CATEGORIES, "合計"].map((cat) => (
              <Fragment key={cat}>
                <th>売上金額</th>
                <th>廃棄金額</th>
                <th>廃棄率</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => {
            const totalSales = CATEGORIES.reduce((s, c) => s + entry.items[c].salesAmount, 0);
            const totalWaste = CATEGORIES.reduce((s, c) => s + entry.items[c].wasteAmount, 0);
            const totalRate = totalSales + totalWaste > 0 ? totalWaste / (totalSales + totalWaste) : 0;
            return (
              <tr key={entry.date}>
                <td>{formatDateJP(entry.date)}</td>
                <td>
                  {entry.temperatureLow ?? "-"}/{entry.temperatureHigh ?? "-"}
                </td>
                <td>{entry.weather || "-"}</td>
                <td>{entry.saleCategory || "-"}</td>
                <td>{entry.holiday ? "○" : ""}</td>
                {CATEGORIES.map((cat) => {
                  const item = entry.items[cat];
                  const rate =
                    item.salesAmount + item.wasteAmount > 0
                      ? item.wasteAmount / (item.salesAmount + item.wasteAmount)
                      : 0;
                  return (
                    <Fragment key={cat}>
                      <td>{formatYen(item.salesAmount)}</td>
                      <td>{formatYen(item.wasteAmount)}</td>
                      <td className="muted">{(rate * 100).toFixed(0)}%</td>
                    </Fragment>
                  );
                })}
                <td>{formatYen(totalSales)}</td>
                <td>{formatYen(totalWaste)}</td>
                <td className="muted">{(totalRate * 100).toFixed(0)}%</td>
                <td className="actions">
                  <button type="button" onClick={() => onEdit(entry)}>
                    編集
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (confirm(`${formatDateJP(entry.date)} のデータを削除しますか?`)) {
                        onDelete(entry.date);
                      }
                    }}
                  >
                    削除
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
