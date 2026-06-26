import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  nowISO,
  uuid,
  KataRepo,
  LANGUAGES,
  tryEnablePersistentStorage,
  formatRelative,
} from '@/db';
import { runMigrationIfNeeded } from '@/db/migration';
import type { Kata, Language } from '@/types';
import { Label } from '@/components/Label';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { KataForm } from '@/components/KataForm';
import { Pill } from '@/components/Pill';
import { NewKataDialog } from '@/components/NewKataDialog';

type SortKey = 'updated' | 'createdAt' | 'title';

export default function KataListPage() {
  const [katas, setKatas] = useState<Kata[]>([]);
  const [query, setQuery] = useState('');
  const [langFilter, setLangFilter] = useState<Language | ''>('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Kata | null>(null);
  const [getFromAiOpen, setGetFromAiOpen] = useState(false);

  // Run one-time v1→v2 migration then load the list
  useEffect(() => {
    (async () => {
      await tryEnablePersistentStorage().catch(() => {});
      await runMigrationIfNeeded().catch(console.warn);
      const list = await KataRepo.list();
      setKatas(list);
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

  async function removeKata(id: string) {
    if (!confirm('Delete this kata?')) return;
    await KataRepo.remove(id);
    await reload();
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function exportJSON() {
    const data = JSON.stringify(katas, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kata-keeper-export-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importFromFile() {
    fileInputRef.current?.click();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const items: Kata[] = JSON.parse(text);
      const normalized = items.map((k) => ({
        ...k,
        id: k.id || uuid(),
        createdAt: k.createdAt || nowISO(),
      }));
      await Promise.all(normalized.map((k) => KataRepo.upsert(k)));
      await reload();
      alert(`Imported ${normalized.length} items.`);
    } catch {
      alert('Import failed: invalid JSON');
    } finally {
      e.target.value = '';
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tag = tagFilter.trim().toLowerCase();
    let arr = katas;
    if (q) arr = arr.filter((k) => k.title.toLowerCase().includes(q));
    if (langFilter) arr = arr.filter((k) => k.languages.includes(langFilter as Language));
    if (tag) arr = arr.filter((k) => k.tags.some((t) => t.includes(tag)));
    return [...arr].sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title);
      if (sortKey === 'createdAt') return b.createdAt.localeCompare(a.createdAt);
      // 'updated': sandboxUpdatedAt falls back to createdAt
      const av = a.sandboxUpdatedAt ?? a.createdAt;
      const bv = b.sandboxUpdatedAt ?? b.createdAt;
      return bv.localeCompare(av);
    });
  }, [katas, query, langFilter, tagFilter, sortKey]);

  const onImportAIKata = async (k: Omit<Kata, 'id'>) => {
    const now = nowISO();
    const item: Kata = {
      id: uuid(),
      title: k.title,
      languages: k.languages?.length ? k.languages : ['typescript'],
      tags: (k.tags ?? []).map((t) => t.toLowerCase()),
      sandboxId: k.sandboxId,
      sandboxUpdatedAt: k.sandboxUpdatedAt,
      notes: k.notes,
      createdAt: now,
    };
    await KataRepo.upsert(item);
    await reload();
    setGetFromAiOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Kata Keeper</h1>
          <div className="flex items-center gap-2">
            <IconButton onClick={exportJSON} title="Export JSON">
              Export
            </IconButton>
            <IconButton onClick={importFromFile} title="Import JSON">
              Import
            </IconButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onImportFile}
            />
            <Button onClick={openNew}>New Kata</Button>
            {import.meta.env.VITE_USE_EMULATORS === 'true' && (
              <span className="ml-2 rounded bg-amber-200 text-amber-900 px-2 py-0.5 text-xs border border-amber-400">
                Emulators
              </span>
            )}
            <button onClick={() => setGetFromAiOpen(true)} className="px-3 py-2 border rounded">
              New Kata From AI
            </button>
            <Link to="/config" className="px-3 py-2 border rounded text-sm">
              Settings
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search by title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lang">Language</Label>
            <Select
              id="lang"
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value as Language | '')}
            >
              <option value="">All</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tag">Tag</Label>
            <Input
              id="tag"
              placeholder="Filter by tag"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100/60 dark:bg-slate-800/60">
              <tr className="text-left">
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Languages</th>
                <th className="px-4 py-2">Tags</th>
                <th className="px-4 py-2 hidden md:table-cell">Updated</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No katas yet. Click <span className="font-semibold">New Kata</span> to add one.
                  </td>
                </tr>
              )}
              {filtered.map((k) => (
                <tr key={k.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 align-top">
                    <Link
                      to={`/kata/${k.id}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {k.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {k.languages.map((l) => (
                        <Pill key={l} className="border-slate-300 dark:border-slate-600">
                          {l}
                        </Pill>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {k.tags.slice(0, 4).map((t) => (
                        <Pill key={t} className="border-slate-300 dark:border-slate-600">
                          {t}
                        </Pill>
                      ))}
                      {k.tags.length > 4 && (
                        <span className="text-xs text-slate-500">+{k.tags.length - 4}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell align-top">
                    <div title={k.sandboxUpdatedAt ?? k.createdAt}>
                      {formatRelative(k.sandboxUpdatedAt ?? k.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <IconButton onClick={() => openEdit(k)} title="Edit">
                        Edit
                      </IconButton>
                      <IconButton
                        onClick={() => removeKata(k.id)}
                        title="Delete"
                        className="text-red-600 border-red-300 dark:border-red-700"
                      >
                        Delete
                      </IconButton>
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
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-2 py-1"
          >
            <option value="updated">Updated</option>
            <option value="createdAt">Created</option>
            <option value="title">Title</option>
          </select>
        </div>
      </main>

      {/* Edit/Create Form Modal */}
      {showForm && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-20 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Kata' : 'New Kata'}</h2>
              <IconButton
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                Close
              </IconButton>
            </div>
            <KataForm
              initial={editing ?? undefined}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
              onSave={saveKata}
            />
          </div>
        </div>
      )}

      {getFromAiOpen && (
        <NewKataDialog onClose={() => setGetFromAiOpen(false)} onImport={onImportAIKata} />
      )}
    </div>
  );
}
