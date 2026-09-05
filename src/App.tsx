import { useState } from "react";
import "./App.css";
import type { DailyEntry } from "./types";
import { deleteEntry, importEntries, loadEntries, loadSettings, saveSettings, upsertEntry } from "./lib/storage";
import DailyInputForm from "./components/DailyInputForm";
import DataTable from "./components/DataTable";
import RegressionPanel from "./components/RegressionPanel";
import OrderSuggestionPanel from "./components/OrderSuggestionPanel";
import ImportPanel from "./components/ImportPanel";

type Tab = "input" | "import" | "list" | "analysis" | "order";

const TABS: { id: Tab; label: string }[] = [
  { id: "input", label: "入力" },
  { id: "import", label: "インポート" },
  { id: "list", label: "一覧" },
  { id: "analysis", label: "分析" },
  { id: "order", label: "発注提案" },
];

export default function App() {
  const [entries, setEntries] = useState<DailyEntry[]>(() => loadEntries());
  const [settings, setSettings] = useState(() => loadSettings());
  const [tab, setTab] = useState<Tab>("input");
  const [editing, setEditing] = useState<DailyEntry | undefined>(undefined);

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
        <h1>中食 実績分析ツール</h1>
        <p className="muted">日々の販売・廃棄実績を記録し、重回帰分析と発注提案に活用します</p>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? "tab active" : "tab"}
            onClick={() => {
              if (t.id !== "input") setEditing(undefined);
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === "input" && (
          <DailyInputForm
            key={editing?.date ?? "new"}
            existingDates={entries.map((e) => e.date)}
            onSave={handleSave}
            initialEntry={editing}
            onCancelEdit={() => setEditing(undefined)}
          />
        )}
        {tab === "import" && <ImportPanel existingEntries={entries} onImport={handleImport} />}
        {tab === "list" && <DataTable entries={entries} onEdit={handleEdit} onDelete={handleDelete} />}
        {tab === "analysis" && (
          <RegressionPanel entries={entries} settings={settings} onSettingsChange={handleSettingsChange} />
        )}
        {tab === "order" && (
          <OrderSuggestionPanel entries={entries} settings={settings} onSettingsChange={handleSettingsChange} />
        )}
      </main>
    </div>
  );
}
