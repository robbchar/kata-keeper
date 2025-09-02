import { useState } from 'react';
import { nowISO, uuid, LANGUAGES, DIFFICULTIES, STATUSES } from '../db';
import type { Kata, Language, Status, Difficulty } from '../types';
import { Label } from './Label';
import { Input } from './Input';
import { Select } from './Select';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { classNames } from '../db';

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
  const [description, setDescription] = useState(initial?.description ?? '');
  const [requirements, setRequirements] = useState(initial?.requirements ?? '');
  const [languagesSel, setLanguagesSel] = useState<Language[]>(initial?.languages ?? []);
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '));
  const [link, setLink] = useState(initial?.link ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [status, setStatus] = useState<Status>(initial?.status ?? 'backlog');
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(initial?.difficulty);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const now = nowISO();
    const k: Kata = {
      id: (initial?.id as string) ?? uuid(),
      title: title.trim(),
      description: description.trim() || undefined,
      requirements: requirements.trim() || undefined,
      languages: languagesSel,
      tags: tagsText
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      link: link.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
      difficulty,
      createdAt: (initial?.createdAt as string) ?? now,
      updatedAt: now,
      lastWorkedAt: initial?.lastWorkedAt,
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
          placeholder="a11y, async, debounce"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select
            id="difficulty"
            value={difficulty ?? ''}
            onChange={(e) => setDifficulty((e.target.value || undefined) as Difficulty | undefined)}
          >
            <option value="">—</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="link">Link (CodeSandbox, GitHub, etc.)</Label>
        <Input
          id="link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://codesandbox.io/s/…"
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short blurb"
        />
      </div>
      <div>
        <Label htmlFor="requirements">Requirements</Label>
        <Textarea
          id="requirements"
          rows={4}
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          placeholder="Longer spec or acceptance criteria"
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
