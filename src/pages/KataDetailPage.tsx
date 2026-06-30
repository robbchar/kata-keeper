import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { KataRepo, formatRelative, classNames } from '@/db'
import { getUserConfig } from '@/lib/userConfig'
import { sandboxEmbedUrl, sandboxOpenUrl, fetchSandboxMetadata, parseSandboxIdFromUrl } from '@/lib/codesandbox'
import { TagInput } from '@/components/TagInput'
import type { Kata, Language } from '@/types'

const LANGUAGES: Language[] = ['javascript', 'typescript', 'react']

export default function KataDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [kata, setKata] = useState<Kata | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [sandboxUrlInput, setSandboxUrlInput] = useState('')
  const [editingTitle, setEditingTitle] = useState<string | null>(null)

  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load kata and user config on mount
  useEffect(() => {
    if (!id || !user) return
    KataRepo.get(id).then((k) => {
      if (!k) { setNotFound(true); return }
      setKata(k)
    })
  }, [id, user])

  // Fire-and-forget: refresh sandboxUpdatedAt from CodeSandbox API
  useEffect(() => {
    if (!kata?.sandboxId || !user) return
    getUserConfig(user.uid).then(async (config) => {
      if (!config.csToken) return
      try {
        const meta = await fetchSandboxMetadata({ sandboxId: kata.sandboxId!, csToken: config.csToken })
        if (meta && meta.updatedAt !== kata.sandboxUpdatedAt) {
          await KataRepo.update(kata.id, { sandboxUpdatedAt: meta.updatedAt })
          setKata((prev) => prev ? { ...prev, sandboxUpdatedAt: meta.updatedAt } : prev)
        }
      } catch {
        // Silently ignore — this is a best-effort background refresh
      }
    })
  // intentionally omits kata.sandboxUpdatedAt — fire once per sandboxId, not on every metadata refresh
  }, [kata?.sandboxId, user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function patchKata(patch: Partial<Kata>) {
    if (!kata) return
    const updated = { ...kata, ...patch }
    setKata(updated)
    await KataRepo.update(kata.id, patch)
  }

  function onNotesChange(notes: string) {
    if (!kata) return
    setKata((prev) => prev ? { ...prev, notes } : prev)
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)
    notesDebounceRef.current = setTimeout(() => {
      KataRepo.update(kata.id, { notes })
    }, 1000)
  }

  async function linkSandboxUrl() {
    const parsed = parseSandboxIdFromUrl(sandboxUrlInput)
    if (!parsed) return
    await patchKata({ sandboxId: parsed })
    setSandboxUrlInput('')
  }

  async function deleteKata() {
    if (!kata || !confirm('Delete this kata?')) return
    await KataRepo.remove(kata.id)
    navigate('/')
  }

  function toggleLanguage(lang: Language) {
    if (!kata) return
    const next = kata.languages.includes(lang)
      ? kata.languages.filter((l) => l !== lang)
      : [...kata.languages, lang]
    patchKata({ languages: next })
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/" className="text-sm text-indigo-600 hover:underline">← Back</Link>
        <p className="mt-4 text-slate-500">Kata not found.</p>
      </div>
    )
  }

  if (!kata) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 text-slate-500">Loading…</div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Sticky header with editable title and nav */}
      <header className="sticky top-0 z-10 border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-full px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-sm text-indigo-600 hover:underline shrink-0">← Back</Link>
          <input
            className="flex-1 min-w-0 bg-transparent text-lg font-semibold focus:outline-none"
            value={editingTitle ?? kata.title}
            onFocus={() => setEditingTitle(kata.title)}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={() => {
              const trimmed = editingTitle?.trim()
              if (trimmed && trimmed !== kata.title) patchKata({ title: trimmed })
              setEditingTitle(null)
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            aria-label="Kata title"
          />
          <button
            onClick={deleteKata}
            className="shrink-0 text-xs text-red-500 hover:underline"
          >
            Delete
          </button>
        </div>
      </header>

      {/* Two-panel layout: notes above on narrow, side-by-side on wide */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* Narrow-first: metadata + notes panel renders first (above iframe) */}
        <div className="order-first lg:order-last lg:w-[35%] flex flex-col overflow-y-auto p-4 gap-5 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800">

          {/* Language chips */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Languages</div>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={classNames(
                    'rounded-full border px-3 py-0.5 text-xs',
                    kata.languages.includes(lang)
                      ? 'bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
                      : 'border-slate-300 dark:border-slate-600',
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Tag chips */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Tags</div>
            <TagInput
              tags={kata.tags}
              onChange={(tags) => patchKata({ tags })}
            />
          </div>

          {/* Notes textarea with 1-second autosave debounce */}
          <div className="flex-1 flex flex-col">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Notes</div>
            <textarea
              className={classNames(
                'flex-1 w-full rounded-md border border-slate-200 dark:border-slate-700',
                'bg-white dark:bg-slate-800 p-3 text-sm resize-none',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500',
              )}
              style={{ minHeight: '200px' }}
              placeholder="Add thoughts, learnings, links… (markdown ok)"
              value={kata.notes ?? ''}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>

          {/* Last-updated timestamp */}
          <div className="text-xs text-slate-400">
            Updated {formatRelative(kata.sandboxUpdatedAt ?? kata.createdAt)}
          </div>

        </div>

        {/* Left panel: CodeSandbox iframe or URL-linking placeholder */}
        <div className="order-last lg:order-first flex flex-col lg:w-[65%] border-slate-200 dark:border-slate-800">
          {kata.sandboxId ? (
            <>
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <a
                  href={sandboxOpenUrl(kata.sandboxId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Open in CodeSandbox ↗
                </a>
              </div>
              <iframe
                src={sandboxEmbedUrl(kata.sandboxId)}
                className="flex-1 w-full"
                style={{ minHeight: '600px', border: 0 }}
                allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb; xr-spatial-tracking"
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                title="CodeSandbox"
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
              <p className="text-slate-500 text-sm">No sandbox linked yet.</p>
              <div className="flex gap-2 w-full max-w-sm">
                <input
                  className="flex-1 border rounded px-3 py-1.5 text-sm bg-transparent"
                  placeholder="Paste CodeSandbox URL…"
                  value={sandboxUrlInput}
                  onChange={(e) => setSandboxUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && linkSandboxUrl()}
                  aria-label="CodeSandbox URL"
                />
                <button
                  onClick={linkSandboxUrl}
                  className="px-3 py-1.5 rounded border text-sm"
                >
                  Link
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
