import { useState } from 'react';
import { nowISO, uuid, LANGUAGES, classNames } from '../db';
import type { Kata, Language } from '../types';
import { Label } from './Label';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { IconButton } from './IconButton';

export function KataForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Partial<Kata>;
  onCancel: () => void;
  onSave: (k: Kata) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [languagesSel, setLanguagesSel] = useState<Language[]>(initial?.languages ?? []);
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '));
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const now = nowISO();
    const k: Kata = {
      id: (initial?.id as string) ?? uuid(),
      title: title.trim(),
      languages: languagesSel,
      tags: tagsText
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      notes: notes.trim() || undefined,
      sandboxId: initial?.sandboxId,
      sandboxUpdatedAt: initial?.sandboxUpdatedAt,
      createdAt: (initial?.createdAt as string) ?? now,
    };
    onSave(k);
  }

  function toggleLanguage(lang: Language) {
    setLanguagesSel((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Accessible Async Autocomplete"
          required
        />
      </div>
      <div>
        <Label>Languages</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggleLanguage(l)}
              className={classNames(
                'rounded-full border px-3 py-1 text-xs',
                languagesSel.includes(l)
                  ? 'bg-indigo-300 border-indigo-400 text-indigo-700'
                  : 'border-slate-300 dark:border-slate-600',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="hooks, async, debounce"
        />
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add thoughts, learnings, links…"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <IconButton type="button" onClick={onCancel}>
          Cancel
        </IconButton>
        <Button type="submit">Save Kata</Button>
      </div>
    </form>
  );
}
