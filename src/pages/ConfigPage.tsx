import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { GithubAuthProvider, signInWithPopup } from 'firebase/auth'
import { useAuth } from '@/auth/AuthProvider'
import { firebase } from '@/lib/firebase'
import { getUserConfig, updateUserConfig } from '@/lib/userConfig'
import { KataRepo } from '@/db'
import { TagInput } from '@/components/TagInput'
import type { UserConfig } from '@/types/config'
import { classNames } from '@/db'

// ---------------------------------------------------------------------------
// Section wrapper — consistent card styling
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Labelled input helper — keeps repetition minimal
// ---------------------------------------------------------------------------
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block text-sm text-slate-700 dark:text-slate-300 space-y-1">
      <span>{label}</span>
      {children}
    </label>
  )
}

const INPUT_CLASS = classNames(
  'mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700',
  'bg-white dark:bg-slate-800 px-3 py-2 text-sm',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500',
)

// ---------------------------------------------------------------------------
// ConfigPage
// ---------------------------------------------------------------------------
export default function ConfigPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<UserConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [githubConnecting, setGithubConnecting] = useState(false)
  const [githubError, setGithubError] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return
    getUserConfig(user.uid).then(setConfig)
  }, [user])

  /**
   * Merge a partial patch into local state and persist to Firestore. Optimistic
   * update keeps the UI snappy — Firestore write happens in the background.
   */
  const save = useCallback(
    async (patch: Partial<UserConfig>) => {
      if (!user || !config) return
      const updated = { ...config, ...patch }
      setConfig(updated)
      setSaving(true)
      try {
        await updateUserConfig(user.uid, patch)
      } finally {
        setSaving(false)
      }
    },
    [user, config],
  )

  /**
   * Debounced save for sensitive text fields (API keys, tokens). Waits 400ms
   * after the last keystroke before persisting — avoids a Firestore write per
   * character while the user is still typing.
   */
  function debouncedSave(patch: Partial<UserConfig>) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(patch), 400)
  }

  // ---------------------------------------------------------------------------
  // AI connection test
  // ---------------------------------------------------------------------------
  async function handleTestConnection() {
    if (!config?.aiApiKey) {
      setTestStatus('error')
      setTestMessage('Enter an API key first.')
      return
    }

    setTestStatus('testing')
    setTestMessage('')

    try {
      if (config.aiProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${config.aiApiKey}` },
        })
        if (res.ok) {
          setTestStatus('ok')
          setTestMessage('Connected')
        } else {
          const body = await res.json().catch(() => ({}))
          setTestStatus('error')
          setTestMessage(body?.error?.message ?? `HTTP ${res.status}`)
        }
      } else {
        // Anthropic — use the list-models endpoint (cheap, unauthenticated response shape)
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': config.aiApiKey,
            'anthropic-version': '2023-06-01',
          },
        })
        if (res.ok) {
          setTestStatus('ok')
          setTestMessage('Connected')
        } else {
          const body = await res.json().catch(() => ({}))
          setTestStatus('error')
          setTestMessage(body?.error?.message ?? `HTTP ${res.status}`)
        }
      }
    } catch {
      setTestStatus('error')
      setTestMessage('Network error — check your connection.')
    }
  }

  // ---------------------------------------------------------------------------
  // GitHub OAuth for CodeSandbox
  // ---------------------------------------------------------------------------
  async function handleConnectGitHub() {
    setGithubConnecting(true)
    setGithubError('')
    try {
      const { auth } = firebase()
      const provider = new GithubAuthProvider()
      // Request the repo scope so CodeSandbox can create sandboxes from GitHub
      provider.addScope('repo')
      const result = await signInWithPopup(auth, provider)
      const credential = GithubAuthProvider.credentialFromResult(result)
      const accessToken = credential?.accessToken ?? ''
      await save({ csToken: accessToken, csGitHubConnected: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'GitHub sign-in failed.'
      setGithubError(message)
    } finally {
      setGithubConnecting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Export all katas as JSON
  // ---------------------------------------------------------------------------
  async function handleExportJSON() {
    try {
      const katas = await KataRepo.list()
      const data = JSON.stringify(katas, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `kata-keeper-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[export] Failed to export katas:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (!config) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-slate-500 dark:text-slate-400">
        Loading settings…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-4">
          <Link to="/" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          {saving && (
            <span className="ml-auto text-xs text-slate-400">Saving…</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* ------------------------------------------------------------------ */}
        {/* AI Provider                                                         */}
        {/* ------------------------------------------------------------------ */}
        <Section title="AI Provider">
          <Field label="Provider">
            <select
              className={INPUT_CLASS}
              value={config.aiProvider}
              onChange={(e) => {
                save({ aiProvider: e.target.value as 'openai' | 'anthropic' })
                // Reset test status when provider changes
                setTestStatus('idle')
                setTestMessage('')
              }}
            >
              <option value="openai">OpenAI (gpt-4o-mini)</option>
              <option value="anthropic">Anthropic (claude-sonnet-4-6)</option>
            </select>
          </Field>

          <Field label="API Key">
            <input
              type="password"
              className={INPUT_CLASS}
              value={config.aiApiKey}
              onChange={(e) => {
                debouncedSave({ aiApiKey: e.target.value })
                setTestStatus('idle')
                setTestMessage('')
              }}
              placeholder={config.aiProvider === 'openai' ? 'sk-…' : 'sk-ant-…'}
              autoComplete="off"
            />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              className={classNames(
                'px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
                'border-slate-300 dark:border-slate-600',
                'hover:bg-slate-100 dark:hover:bg-slate-800',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
            </button>

            {testStatus === 'ok' && (
              <span className="text-sm text-green-600 dark:text-green-400">
                ✓ {testMessage}
              </span>
            )}
            {testStatus === 'error' && (
              <span className="text-sm text-red-600 dark:text-red-400">
                ✗ {testMessage}
              </span>
            )}
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* CodeSandbox                                                         */}
        {/* ------------------------------------------------------------------ */}
        <Section title="CodeSandbox">
          <Field label="API Token">
            <input
              type="password"
              className={INPUT_CLASS}
              value={config.csToken}
              onChange={(e) => debouncedSave({ csToken: e.target.value })}
              placeholder="Your CodeSandbox API token"
              autoComplete="off"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {config.csGitHubConnected
                ? '✓ GitHub is connected — sandbox creation is enabled.'
                : 'Connect GitHub to allow Kata Keeper to create sandboxes on your behalf.'}
            </p>

            <button
              type="button"
              onClick={handleConnectGitHub}
              disabled={githubConnecting}
              className={classNames(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
                'border-slate-300 dark:border-slate-600',
                'hover:bg-slate-100 dark:hover:bg-slate-800',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {githubConnecting
                ? (config.csGitHubConnected ? 'Reconnecting…' : 'Connecting…')
                : (config.csGitHubConnected ? 'Reconnect GitHub' : 'Connect GitHub')}
            </button>

            {githubError && (
              <p className="text-sm text-red-600 dark:text-red-400">✗ {githubError}</p>
            )}
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Tags                                                                */}
        {/* ------------------------------------------------------------------ */}
        <Section title="Tags">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage the tags used to categorise your katas. Changes are saved immediately.
          </p>
          <TagInput
            tags={config.tags}
            onChange={(tags) => save({ tags })}
          />
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Data                                                                */}
        {/* ------------------------------------------------------------------ */}
        <Section title="Data">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Download all your katas as a JSON file.
          </p>
          <button
            type="button"
            onClick={handleExportJSON}
            className={classNames(
              'px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
              'border-slate-300 dark:border-slate-600',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
            )}
          >
            Export JSON
          </button>
        </Section>
      </main>
    </div>
  )
}
