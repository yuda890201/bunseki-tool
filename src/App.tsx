import { useState } from "react";
import "./App.css";
import type { DailyEntry } from "./types";
import {
  deleteEntry,
  importEntries,
  loadEntries,
  loadLocation,
  loadSettings,
  saveLocation,
  saveSettings,
  upsertEntry,
} from "./lib/storage";
import type { Location } from "./lib/weather";
import DailyInputForm from "./components/DailyInputForm";
import DataTable from "./components/DataTable";
import RegressionPanel from "./components/RegressionPanel";
import OrderSuggestionPanel from "./components/OrderSuggestionPanel";
import ImportPanel from "./components/ImportPanel";
import SpaceInvader from "./components/SpaceInvader";
import { AnalysisIcon, ImportIcon, InputIcon, ListIcon, OrderIcon } from "./components/TabIcons";

type Tab = "input" | "import" | "list" | "analysis" | "order";

const TABS: { id: Tab; label: string; Icon: (props: { size?: number }) => React.JSX.Element }[] = [
  { id: "input", label: "入力", Icon: InputIcon },
  { id: "import", label: "インポート", Icon: ImportIcon },
  { id: "list", label: "一覧", Icon: ListIcon },
  { id: "analysis", label: "分析", Icon: AnalysisIcon },
  { id: "order", label: "発注提案", Icon: OrderIcon },
];

export default function App() {
  const [entries, setEntries] = useState<DailyEntry[]>(() => loadEntries());
  const [settings, setSettings] = useState(() => loadSettings());
  const [tab, setTab] = useState<Tab>("input");
  const [editing, setEditing] = useState<DailyEntry | undefined>(undefined);
  const [location, setLocation] = useState<Location | null>(() => loadLocation());

  function handleLocationChange(next: Location) {
    setLocation(next);
    saveLocation(next);
  }

  function handleSave(entry: DailyEntry) {
    setEntries(upsertEntry(entries, entry));
    setEditing(undefined);
    setTab("list");
  }

  function handleDelete(date: string) {
    setEntries(deleteEntry(entries, date));
  }

  function handleEdit(entry: DailyEntry) {
    setEditing(entry);
    setTab("input");
  }

  function handleSettingsChange(next: typeof settings) {
    setSettings(next);
    saveSettings(next);
  }

  function handleImport(imported: DailyEntry[], overwrite: boolean) {
    const result = importEntries(entries, imported, overwrite);
    setEntries(result.entries);
    return { imported: result.imported, skipped: result.skipped };
  }

  return (
    <div className="app-shell">
      <header>
        <div className="title-row">
          <SpaceInvader size={30} />
          <h1>
            中食 実績分析ツール<span className="cursor-blink">_</span>
          </h1>
          <SpaceInvader size={30} className="magenta" />
        </div>
        <p className="muted">日々の販売・廃棄実績を記録し、重回帰分析と発注提案に活用します</p>
      </header>

      <main>
        {tab === "input" && (
          <DailyInputForm
            key={editing?.date ?? "new"}
            existingDates={entries.map((e) => e.date)}
            onSave={handleSave}
            initialEntry={editing}
            onCancelEdit={() => setEditing(undefined)}
            location={location}
            onLocationChange={handleLocationChange}
          />
        )}
        {tab === "import" && <ImportPanel existingEntries={entries} onImport={handleImport} />}
        {tab === "list" && <DataTable entries={entries} onEdit={handleEdit} onDelete={handleDelete} />}
        {tab === "analysis" && (
          <RegressionPanel entries={entries} settings={settings} onSettingsChange={handleSettingsChange} />
        )}
        {tab === "order" && (
          <OrderSuggestionPanel
            entries={entries}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            location={location}
          />
        )}
      </main>

      <nav className="bottom-nav">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={id === tab ? "bottom-nav-item active" : "bottom-nav-item"}
            title={label}
            aria-label={label}
            onClick={() => {
              if (id !== "input") setEditing(undefined);
              setTab(id);
            }}
          >
            <Icon size={22} />
          </button>
        ))}
      </nav>
    </div>
  );
}
