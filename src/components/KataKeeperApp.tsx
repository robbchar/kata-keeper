import { useState, useEffect, useRef, useMemo } from "react";
import { nowISO, uuid, KataRepo, LANGUAGES, STATUSES, tryEnablePersistentStorage, formatRelative } from "../db";
import type { Kata, Language, Status, Id } from "../types";
import { SEED } from "../data/seed";
import { Label } from "./Label";
import { Input } from "./Input";
import { Select } from "./Select";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { KataForm } from "./KataForm";
import { Pill } from "./Pill";

export default function KataKeeperApp() {
  const [katas, setKatas] = useState<Kata[]>([]);
  const [query, setQuery] = useState("");
  const [langFilter, setLangFilter] = useState<Language | "">("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [sortKey, setSortKey] = useState<"updatedAt" | "createdAt" | "lastWorkedAt" | "title">("updatedAt");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Kata | null>(null);

  // Load data
  useEffect(() => {
    (async () => {
      await tryEnablePersistentStorage().catch(() => {});
      const list = await KataRepo.list();
      if (list.length === 0) {
        // seed on first run
        // await KataRepo.bulkAdd(SEED);
        // setKatas(await KataRepo.list());
      } else {
        setKatas(list);
      }
    })();
  }, []);

  async function reload() {
    setKatas(await KataRepo.list());
  }

  function openNew() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(k: Kata) {
    setEditing(k);
    setShowForm(true);
  }

  async function saveKata(k: Kata) {
    await KataRepo.upsert(k);
    setShowForm(false);
    setEditing(null);
    await reload();
  }

  async function quickStatus(k: Kata, s: Status) {
    await KataRepo.update(k.id, { status: s, updatedAt: nowISO() });
    await reload();
  }

  async function stampWorked(k: Kata) {
    await KataRepo.update(k.id, { lastWorkedAt: nowISO(), updatedAt: nowISO() });
    await reload();
  }

  async function removeKata(id: Id) {
    if (!confirm("Delete this kata?")) return;
    await KataRepo.remove(id);
    await reload();
  }

  // Import/Export
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  function exportJSON() {
    const data = JSON.stringify(katas, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kata-keeper-export-${new Date().toISOString()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function importFromFile() { fileInputRef.current?.click(); }
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const items: Kata[] = JSON.parse(text);
      const normalized = items.map(k => ({ ...k, id: k.id || uuid(), createdAt: k.createdAt || nowISO(), updatedAt: nowISO() }));
      await KataRepo.bulkAdd(normalized);
      await reload();
      alert(`Imported ${normalized.length} items.`);
    } catch {
      alert("Import failed: invalid JSON");
    } finally {
      e.target.value = ""; // reset
    }
  }

  // Derived values
  const allTags = useMemo(() => {
    const s = new Set<string>();
    katas.forEach(k => k.tags?.forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [katas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = katas;
    if (q) arr = arr.filter(k => k.title.toLowerCase().includes(q));
    if (langFilter) arr = arr.filter(k => k.languages.includes(langFilter as Language));
    if (statusFilter) arr = arr.filter(k => k.status === statusFilter);
    return [...arr].sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title);
      const av = (a[sortKey] as string | undefined) ?? "";
      const bv = (b[sortKey] as string | undefined) ?? "";
      return bv.localeCompare(av);
    });
  }, [katas, query, langFilter, statusFilter, sortKey]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="mx-auto min-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Kata Keeper</h1>
          <div className="flex items-center gap-2">
            <IconButton onClick={exportJSON} title="Export JSON">Export</IconButton>
            <IconButton onClick={importFromFile} title="Import JSON">Import</IconButton>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onImportFile} />
            <Button onClick={openNew}>New Kata</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <Label htmlFor="search">Search</Label>
            <Input id="search" placeholder="Search by title ( / )" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lang">Language</Label>
            <Select id="lang" value={langFilter} onChange={e => setLangFilter(e.target.value as Language | "")}> 
              <option value="">All</option>
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status | "")}> 
              <option value="">All</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100/60 dark:bg-slate-800/60">
              <tr className="text-left">
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2 hidden md:table-cell">Tags</th>
                <th className="px-4 py-2">Lang</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 hidden md:table-cell">Updated</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No katas yet. Click <span className="font-semibold">New Kata</span> to add one.</td>
                </tr>
              )}
              {filtered.map(k => (
                <tr key={k.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{k.title}</div>
                    {k.description && <div className="text-slate-500 text-xs mt-0.5 line-clamp-2">{k.description}</div>}
                    {k.link && (
                      <a href={k.link} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-xs mt-1 inline-block">Open link ↗</a>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell align-top">
                    <div className="flex flex-wrap gap-1">
                      {k.tags?.map(t => <Pill key={t} className="border-slate-300 dark:border-slate-600">{t}</Pill>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {k.languages.map(l => <Pill key={l} className="border-slate-300 dark:border-slate-600">{l}</Pill>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Select value={k.status} onChange={e => quickStatus(k, e.target.value as Status)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell align-top">
                    <div title={k.updatedAt}>{formatRelative(k.updatedAt)}</div>
                    <div className="text-xs text-slate-500" title={k.lastWorkedAt}>worked {formatRelative(k.lastWorkedAt)}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <IconButton onClick={() => stampWorked(k)} title="Mark worked">Worked</IconButton>
                      <IconButton onClick={() => openEdit(k)} title="Edit">Edit</IconButton>
                      <IconButton onClick={() => removeKata(k.id)} title="Delete" className="text-red-600 border-red-300 dark:border-red-700">Delete</IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sort */}
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-slate-500">Sort by:</span>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as any)} className="rounded-md border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-2 py-1">
            <option value="updatedAt">Updated</option>
            <option value="createdAt">Created</option>
            <option value="lastWorkedAt">Last worked</option>
            <option value="title">Title</option>
          </select>
        </div>
      </main>

      {/* Drawer/Modal */}
      {showForm && (
        <div role="dialog" aria-modal className="fixed inset-0 z-20 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowForm(false); setEditing(null); }} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? "Edit Kata" : "New Kata"}</h2>
              <IconButton onClick={() => { setShowForm(false); setEditing(null); }}>Close</IconButton>
            </div>
            <KataForm
              initial={editing ?? undefined}
              onCancel={() => { setShowForm(false); setEditing(null); }}
              onSave={saveKata}
            />
          </div>
        </div>
      )}
    </div>
  );
}