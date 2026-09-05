import { useState } from "react";
import type { DailyEntry } from "../types";
import { parseWorkbookFile } from "../lib/excelImport";
import { formatDateJP } from "../lib/date";
import { formatYen } from "../lib/format";

interface Props {
  existingEntries: DailyEntry[];
  onImport: (entries: DailyEntry[], overwrite: boolean) => { imported: number; skipped: number };
}

export default function ImportPanel({ existingEntries, onImport }: Props) {
  const [sheets, setSheets] = useState<{ sheetName: string; entries: DailyEntry[] }[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [overwrite, setOverwrite] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [fileName, setFileName] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    setFileName(file.name);
    try {
      const parsed = await parseWorkbookFile(file);
      setSheets(parsed);
      const firstWithData = parsed.findIndex((s) => s.entries.length > 0);
      setSelectedSheet(firstWithData >= 0 ? firstWithData : 0);
    } catch {
      setError("ファイルの読み込みに失敗しました。.xlsx形式のファイルを選択してください。");
      setSheets([]);
    }
  }

  const current = sheets[selectedSheet];
  const existingDates = new Set(existingEntries.map((e) => e.date));
  const overlapCount = current ? current.entries.filter((e) => existingDates.has(e.date)).length : 0;

  function handleImport() {
    if (!current || current.entries.length === 0) return;
    setResult(onImport(current.entries, overwrite));
  }

  return (
    <div className="card">
      <h2>Excelからインポート</h2>
      <p className="muted">
        日付・曜日・カテゴリ別の列を持つExcel(.xlsx)を読み込み、実績データとして取り込みます。
        数値の列は売上金額・廃棄金額(円)として扱われます。
      </p>

      <div className="field-row">
        <label>
          ファイルを選択
          <input type="file" accept=".xlsx" onChange={handleFile} />
        </label>
        {sheets.length > 0 && (
          <label>
            シート
            <select value={selectedSheet} onChange={(e) => setSelectedSheet(Number(e.target.value))}>
              {sheets.map((s, i) => (
                <option key={s.sheetName} value={i}>
                  {s.sheetName}({s.entries.length}件)
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p className="warning">{error}</p>}

      {current && current.entries.length === 0 && (
        <p className="warning">
          「{current.sheetName}」シートからは取り込めるデータが見つかりませんでした。日付列・カテゴリ列の見出しが
          サンプルテンプレートと一致しているか確認してください。
        </p>
      )}

      {current && current.entries.length > 0 && (
        <>
          <p className="muted">
            {fileName} / {current.sheetName}: {current.entries.length}件のデータを検出(期間:{" "}
            {formatDateJP(current.entries[0].date)} 〜 {formatDateJP(current.entries[current.entries.length - 1].date)})
            {overlapCount > 0 && ` / 既存データと重複する日付: ${overlapCount}件`}
          </p>

          <div className="table-scroll">
            <table className="coef-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>売上金額合計</th>
                  <th>廃棄金額合計</th>
                </tr>
              </thead>
              <tbody>
                {current.entries.slice(0, 5).map((e) => {
                  const sales = Object.values(e.items).reduce((s, i) => s + i.salesAmount, 0);
                  const waste = Object.values(e.items).reduce((s, i) => s + i.wasteAmount, 0);
                  return (
                    <tr key={e.date}>
                      <td>{formatDateJP(e.date)}</td>
                      <td>{formatYen(sales)}</td>
                      <td>{formatYen(waste)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small">プレビュー: 先頭5件のみ表示({current.entries.length}件中)</p>

          {overlapCount > 0 && (
            <label className="checkbox-label">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              重複する日付は上書きする(オフの場合はスキップ)
            </label>
          )}

          <div className="form-actions">
            <button type="button" onClick={handleImport}>
              取り込む
            </button>
          </div>
        </>
      )}

      {result && (
        <p className="import-success">
          {result.imported}件を取り込みました。
          {result.skipped > 0 && `(${result.skipped}件は重複のためスキップ)`}
          「一覧」タブで確認できます。
        </p>
      )}
    </div>
  );
}
