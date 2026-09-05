import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CATEGORIES } from "../types";
import type { AnalysisSettings, Category, DailyEntry } from "../types";
import { buildDesignMatrix, targetValues, withIntercept } from "../lib/features";
import { runOLS } from "../lib/regression";

interface Props {
  entries: DailyEntry[];
  settings: AnalysisSettings;
  onSettingsChange: (settings: AnalysisSettings) => void;
}

type TargetKind = "sales" | "waste";

export default function RegressionPanel({ entries, settings, onSettingsChange }: Props) {
  const [category, setCategory] = useState<Category | "合計">("合計");
  const [kind, setKind] = useState<TargetKind>("sales");

  const design = useMemo(() => buildDesignMatrix(entries, settings), [entries, settings]);

  const result = useMemo(() => {
    if (design.usedEntries.length === 0) return null;
    try {
      const y = targetValues(design.usedEntries, category, kind);
      const X = withIntercept(design.rows);
      return { ok: true as const, data: runOLS(X, y, ["切片", ...design.featureNames]) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [design, category, kind]);

  const chartData = useMemo(() => {
    if (!result || !result.ok) return [];
    return design.usedEntries.map((e, i) => ({
      date: e.date.slice(5),
      実績: result.data.predictions[i] + result.data.residuals[i],
      予測: Math.round(result.data.predictions[i] * 10) / 10,
    }));
  }, [result, design]);

  function toggle(field: keyof AnalysisSettings) {
    onSettingsChange({ ...settings, [field]: !settings[field] });
  }

  return (
    <div className="card">
      <h2>重回帰分析</h2>
      <p className="muted">
        曜日・気温・天気・催事の有無などを説明変数として、販売数(または廃棄数)への影響を分析します。
      </p>

      <div className="field-row">
        <label>
          対象カテゴリ
          <select value={category} onChange={(e) => setCategory(e.target.value as Category | "合計")}>
            <option value="合計">中食合計</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          目的変数
          <select value={kind} onChange={(e) => setKind(e.target.value as TargetKind)}>
            <option value="sales">販売数</option>
            <option value="waste">廃棄数</option>
          </select>
        </label>
      </div>

      <fieldset className="checkbox-group">
        <legend>説明変数(曜日は常に使用)</legend>
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.useTemperature} onChange={() => toggle("useTemperature")} />
          気温
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.useWeather} onChange={() => toggle("useWeather")} />
          天気
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.useEvent} onChange={() => toggle("useEvent")} />
          特売・催事
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.useTrend} onChange={() => toggle("useTrend")} />
          経過日数(トレンド)
        </label>
      </fieldset>

      <p className="muted">
        使用データ数: {design.usedEntries.length}件 / 全{entries.length}件
        {design.usedEntries.length < entries.length &&
          "(気温・天気が未入力の日は分析から除外されています)"}
      </p>

      {!result && <p className="warning">データがありません。まず実績を入力してください。</p>}
      {result && !result.ok && <p className="warning">{result.error}</p>}

      {result && result.ok && (
        <>
          <div className="stat-row">
            <div className="stat">
              <span className="stat-label">サンプル数</span>
              <span className="stat-value">{result.data.n}</span>
            </div>
            <div className="stat">
              <span className="stat-label">決定係数 R²</span>
              <span className="stat-value">{result.data.r2.toFixed(3)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">自由度調整済R²</span>
              <span className="stat-value">{result.data.adjR2.toFixed(3)}</span>
            </div>
          </div>

          <table className="coef-table">
            <thead>
              <tr>
                <th>説明変数</th>
                <th>係数</th>
                <th>標準誤差</th>
                <th>t値</th>
                <th>有意性目安</th>
              </tr>
            </thead>
            <tbody>
              {result.data.featureNames.map((name, i) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{result.data.coefficients[i].toFixed(3)}</td>
                  <td>{result.data.stdErrors[i].toFixed(3)}</td>
                  <td>{result.data.tValues[i].toFixed(2)}</td>
                  <td>{result.data.significant[i] ? "◎ 有意な傾向" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            ※有意性目安は |t値| ≥ 2 を簡易的な基準として表示しています(正式なp値検定ではありません)。
          </p>

          <h3>実績 vs 予測</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="実績" stroke="#2563eb" dot={false} />
              <Line type="monotone" dataKey="予測" stroke="#f97316" dot={false} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
