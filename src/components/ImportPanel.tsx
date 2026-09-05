import { useMemo, useState } from "react";
import type { DailyEntry } from "../types";
import { mergeParsedSheets, parseWorkbookFile } from "../lib/excelImport";
import type { ParsedSheet } from "../lib/excelImport";
import { formatDateJP } from "../lib/date";
import { formatYen } from "../lib/format";

interface Props {
  existingEntries: DailyEntry[];
  onImport: (entries: DailyEntry[], overwrite: boolean) => { imported: number; skipped: number };
}

const KIND_LABEL: Record<ParsedSheet["kind"], string> = {
  sales: "売上データ",
  waste: "廃棄データ",
  combined: "売上+廃棄データ",
  unrecognized: "認識できませんでした",
};

export default function ImportPanel({ existingEntries, onImport }: Props) {
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
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
      const initialChecked: Record<string, boolean> = {};
      parsed.forEach((s) => {
        initialChecked[s.sheetName] = s.kind !== "unrecognized" && s.entries.length > 0;
      });
      setChecked(initialChecked);
    } catch {
      setError("ファイルの読み込みに失敗しました。.xlsx / .xlsm形式のファイルを選択してください。");
      setSheets([]);
      setChecked({});
    }
  }

  const selectedSheets = sheets.filter((s) => checked[s.sheetName]);
  const merged = useMemo(() => mergeParsedSheets(selectedSheets), [selectedSheets]);
  const skippedNoDateTotal = selectedSheets.reduce((sum, s) => sum + s.skippedNoDate, 0);

  const existingDates = new Set(existingEntries.map((e) => e.date));
  const overlapCount = merged.filter((e) => existingDates.has(e.date)).length;

  function handleImport() {
    if (merged.length === 0) return;
    setResult(onImport(merged, overwrite));
  }

  return (
    <div className="card">
      <h2>Excelからインポート</h2>
      <p className="muted">
        日付・カテゴリ別の列を持つExcel(.xlsx / .xlsm)を読み込み、実績データとして取り込みます。
        売上シートと廃棄シートが分かれている場合は、両方チェックすると日付単位で自動的に統合されます。
      </p>

      <div className="field-row">
        <label>
          ファイルを選択
          <input type="file" accept=".xlsx,.xlsm" onChange={handleFile} />
        </label>
      </div>

      {error && <p className="warning">{error}</p>}

      {sheets.length > 0 && (
        <>
          <fieldset className="checkbox-group">
            <legend>取り込むシート</legend>
            {sheets.map((s) => (
              <label key={s.sheetName} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!checked[s.sheetName]}
                  disabled={s.entries.length === 0}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [s.sheetName]: e.target.checked }))}
                />
                {s.sheetName}({KIND_LABEL[s.kind]}・{s.entries.length}件)
              </label>
            ))}
          </fieldset>

          {merged.length === 0 ? (
            <p className="warning">
              チェックしたシートから取り込めるデータが見つかりませんでした。日付列・カテゴリ列の見出しを確認してください。
            </p>
          ) : (
            <>
              <p className="muted">
                {fileName}: {merged.length}件のデータを検出(期間: {formatDateJP(merged[0].date)} 〜{" "}
                {formatDateJP(merged[merged.length - 1].date)})
                {overlapCount > 0 && ` / 既存データと重複する日付: ${overlapCount}件`}
                {skippedNoDateTotal > 0 && ` / 日付が空欄のためスキップした行: ${skippedNoDateTotal}件`}
              </p>

              <div className="table-scroll">
                <table className="coef-table">
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th>天気</th>
                      <th>気温(低/高)</th>
                      <th>売上金額合計</th>
                      <th>廃棄金額合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merged.slice(0, 5).map((e) => {
                      const sales = Object.values(e.items).reduce((s, i) => s + i.salesAmount, 0);
                      const waste = Object.values(e.items).reduce((s, i) => s + i.wasteAmount, 0);
                      return (
                        <tr key={e.date}>
                          <td>{formatDateJP(e.date)}</td>
                          <td>{e.weather || "-"}</td>
                          <td>
                            {e.temperatureLow ?? "-"}/{e.temperatureHigh ?? "-"}
                          </td>
                          <td>{formatYen(sales)}</td>
                          <td>{formatYen(waste)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="muted small">プレビュー: 先頭5件のみ表示({merged.length}件中)</p>

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
