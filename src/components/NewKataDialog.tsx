import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import type { Kata, Language, Difficulty } from '@/types';
import { LANGS, DIFFS, LENGTHS, type Length } from '@/ui/constants';
import { mapPreviewToKata, type AiKataCandidate } from '@/lib/mapPreviewToKata';
import { firebase } from '@/lib/firebase';
import type { FirebaseError } from 'firebase/app';

const { functions } = firebase();

type PreviewMeta = {
  language: Language;
  difficulty: Difficulty | 'warmup' | 'easy' | 'medium' | 'hard';
  length: Length;
  estMinutes: number;
  usage?: {
    month: string;
    spentUSD: number;
    budgetUSD: number;
    thisCallUSD: number;
    tokens: { in: number; out: number };
  };
};

export function NewKataDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (kata: Omit<Kata, 'id'>) => Promise<void> | void;
}) {
  const [influence, setInfluence] = useState('');
  const [language, setLanguage] = useState<Language>('typescript');
  const [difficulty, setDifficulty] = useState<Difficulty | 'warmup' | 'easy' | 'medium' | 'hard'>(
    'medium',
  );
  const [length, setLength] = useState<Length>('Standard');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<AiKataCandidate | null>(null);
  const [meta, setMeta] = useState<PreviewMeta | null>(null);
  const [usage, setUsage] = useState<PreviewMeta['usage'] | null>(null);

  const canRetry = !!candidate;

  const doPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'previewKata');
      const res = (await fn({
        influence,
        language,
        difficulty,
        length,
      })) as { data: { candidate: AiKataCandidate; meta: PreviewMeta } };
      setCandidate(res.data?.candidate ?? null);
      setMeta(res.data?.meta ?? null);
      setUsage(res.data?.meta?.usage ?? null);
    } catch (e: unknown) {
      const error = e as { message?: string; code?: string; details?: unknown };
      let msg = error?.message ?? 'Failed to generate preview.';
      // Optional: nicer messages
      if (/resource-exhausted/i.test(msg)) msg = 'Quota exceeded — check OpenAI billing/credits.';
      if (/unauthenticated/i.test(msg)) msg = 'Please sign in to generate a preview.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const doRetry = () => {
    if (canRetry) void doPreview();
  };

  const acceptAndSave = async () => {
    if (!candidate) return;
    setBusy(true);
    setError(null);
    try {
      const mapped: Omit<Kata, 'id'> = mapPreviewToKata(
        candidate,
        language,
        difficulty as Difficulty,
      );
      await onImport(mapped);
      onClose();
    } catch (e: unknown) {
      const error = e as FirebaseError;
      setError(error?.message ?? 'Failed to import kata.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-20 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          onClose();
        }}
      />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl">
        <h2 className="text-xl font-semibold mb-4">New Kata</h2>

        <div className="space-y-3">
          <label className="block text-sm">
            Influence (optional)
            <input
              className="w-full border rounded p-2 mt-1"
              placeholder="e.g., memoization, BFS on graphs, CSS Grid, RxJS, FP"
              value={influence}
              onChange={(e) => setInfluence(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">
              Language
              <select
                className="w-full border rounded p-2 mt-1"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                {LANGS.map((l) => (
                  <option key={l} value={l} className="bg-white text-gray-300">
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Difficulty
              <select
                className="w-full border rounded p-2 mt-1"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                {DIFFS.map((d) => (
                  <option key={d} value={d} className="bg-white text-gray-300">
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Length
              <select
                className="w-full border rounded p-2 mt-1"
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
              >
                {LENGTHS.map((v) => (
                  <option key={v} value={v} className="bg-white text-gray-300">
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 border rounded" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              className="px-3 py-2 rounded border"
              onClick={doRetry}
              disabled={!canRetry || busy}
              title={!canRetry ? 'Generate a preview first' : ''}
            >
              Retry
            </button>
            <button
              className="px-3 py-2 rounded bg-black text-white"
              onClick={doPreview}
              disabled={busy}
            >
              {busy ? 'Generating…' : candidate ? 'Generate New Preview' : 'Generate Preview'}
            </button>
            <button
              className="px-3 py-2 rounded bg-green-600 text-white"
              onClick={acceptAndSave}
              disabled={!candidate || busy}
            >
              Accept & Save
            </button>
          </div>

          {candidate && (
            <div className="relative mt-4 border rounded p-3">
              <div className="absolute right-2 top-2 text-[10px] uppercase tracking-wide bg-indigo-600 border-indigo-300 rounded px-2 py-0.5">
                Preview Only
              </div>

              <div className="flex items-baseline gap-2">
                <h3 className="font-semibold text-lg">{candidate.title}</h3>
                <span className="text-xs opacity-70">
                  • {language} • {difficulty} • {length}
                  {meta?.estMinutes ? ` (~${meta.estMinutes} min)` : ''}
                </span>
              </div>

              <p className="mt-2 text-sm">{candidate.summary}</p>

              <ul className="list-disc ml-5 mt-2 text-sm">
                {candidate.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Starter Code</summary>
                <pre className="mt-2 text-xs overflow-auto border rounded p-2">
                  {candidate.starterCode}
                </pre>
              </details>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Tests</summary>
                <pre className="mt-2 text-xs overflow-auto border rounded p-2">
                  {candidate.tests}
                </pre>
              </details>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Solution</summary>
                <pre className="mt-2 text-xs overflow-auto border rounded p-2">
                  {candidate.solution}
                </pre>
              </details>

              <div className="mt-3">
                <div className="text-xs opacity-70">Tags: {candidate.tags.join(', ')}</div>
                <div className="text-xs opacity-70 mt-1">Hints: {candidate.hints.join(' • ')}</div>
                <ul className="list-disc ml-5 mt-2 text-xs">
                  {candidate.acceptanceCriteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
              {usage && (
                <p className="text-xs text-muted-foreground mt-1">
                  Usage {usage.month}: ${usage.spentUSD.toFixed(2)} / ${usage.budgetUSD.toFixed(2)}
                  {usage.thisCallUSD ? ` (+$${usage.thisCallUSD.toFixed(3)} this call)` : null}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
