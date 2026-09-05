import { useState } from "react";
import type { Location } from "../lib/weather";
import { searchLocations } from "../lib/weather";

interface Props {
  location: Location | null;
  onChange: (location: Location) => void;
}

export default function LocationBar({ location, onChange }: Props) {
  const [open, setOpen] = useState(!location);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const found = await searchLocations(query.trim());
      if (found.length === 0) setError("地点が見つかりませんでした");
      setResults(found);
    } catch {
      setError("検索に失敗しました。通信環境を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  function select(loc: Location) {
    onChange(loc);
    setOpen(false);
    setResults([]);
    setQuery("");
    setError("");
  }

  return (
    <div className="location-bar">
      {!open ? (
        <p className="muted small">
          気温・天気の自動取得地点: <strong>{location?.name ?? "未設定"}</strong>{" "}
          <button type="button" className="link-button" onClick={() => setOpen(true)}>
            変更
          </button>
        </p>
      ) : (
        <div>
          <form className="field-row" onSubmit={handleSearch}>
            <label>
              地点(市区町村名)
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例: 大阪市"
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "検索中..." : "検索"}
            </button>
            {location && (
              <button type="button" className="secondary" onClick={() => setOpen(false)}>
                閉じる
              </button>
            )}
          </form>
          {error && <p className="warning small">{error}</p>}
          {results.length > 0 && (
            <ul className="location-results">
              {results.map((r, i) => (
                <li key={`${r.lat}-${r.lon}-${i}`}>
                  <button type="button" onClick={() => select(r)}>
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
