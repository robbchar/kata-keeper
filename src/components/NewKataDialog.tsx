import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { getUserConfig } from '@/lib/userConfig'
import { createAiProvider, estimateMinutes } from '@/lib/ai'
import type { AiKataCandidate, CostEstimate, GenerateKataParams } from '@/lib/ai'
import { createSandbox } from '@/lib/codesandbox'
import type { Language } from '@/types'
import { LANGS, DIFFS, LENGTHS, type Length } from '@/ui/constants'
import { KataRepo, uuid, nowISO } from '@/db'

export function NewKataDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Form state
  const [influence, setInfluence] = useState('')
  const [language, setLanguage] = useState<Language>('typescript')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [length, setLength] = useState<Length>('Standard')
  const [useExisting, setUseExisting] = useState(false)

  // Async state
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidate, setCandidate] = useState<AiKataCandidate | null>(null)
  const [cost, setCost] = useState<CostEstimate | null>(null)

  async function doGenerate() {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      const config = await getUserConfig(user.uid)
      if (!config.aiApiKey) {
        setError('No AI API key configured. Add one in Settings.')
        return
      }

      const provider = createAiProvider(config)

      let existingKataTitles: string[] | undefined
      if (useExisting) {
        const katas = await KataRepo.list()
        existingKataTitles = katas.map((k) => k.title)
      }

      const params: GenerateKataParams = {
        influence: influence || undefined,
        language,
        difficulty,
        length,
        existingKataTitles,
      }

      const generated = await provider.generateKata(params)
      const estimate = provider.estimateCost(generated, params)
      setCandidate(generated)
      setCost(estimate)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate preview.')
    } finally {
      setBusy(false)
    }
  }

  async function acceptAndSave() {
    if (!candidate || !user) return
    setBusy(true)
    setError(null)
    try {
      const config = await getUserConfig(user.uid)

      let sandboxId: string | undefined

      if (config.csToken) {
        try {
          // Attach the form language to the candidate so createSandbox picks the right file extension
          const candidateWithLanguage: AiKataCandidate = { ...candidate, language }
          sandboxId = await createSandbox({ candidate: candidateWithLanguage, csToken: config.csToken })
        } catch (sbErr) {
          console.warn('Sandbox creation failed, saving kata without it:', sbErr)
        }
      }

      const kataId = uuid()
      await KataRepo.upsert({
        id: kataId,
        title: candidate.title,
        languages: [language],
        tags: [],
        sandboxId,
        createdAt: nowISO(),
      })

      onClose()
      navigate(`/kata/${kataId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setBusy(false)
    }
  }

  const estMinutes = estimateMinutes(length)

  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-20 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-xl font-semibold mb-4">New Kata from AI</h2>

        <div className="space-y-4">
          <label className="block text-sm">
            Influence (optional)
            <input
              className="mt-1 w-full border rounded p-2 bg-transparent"
              placeholder="e.g., memoization, BFS, CSS Grid"
              value={influence}
              onChange={(e) => setInfluence(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">
              Language
              <select
                className="mt-1 w-full border rounded p-2 bg-transparent"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Difficulty
              <select
                className="mt-1 w-full border rounded p-2 bg-transparent"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              >
                {DIFFS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Length
              <select
                className="mt-1 w-full border rounded p-2 bg-transparent"
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
              >
                {LENGTHS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={useExisting}
              onChange={(e) => setUseExisting(e.target.checked)}
            />
            Take my existing katas into account
          </label>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 border rounded text-sm" onClick={onClose} disabled={busy}>
              Cancel
            </button>

            {candidate && (
              <button
                className="px-3 py-2 border rounded text-sm"
                onClick={doGenerate}
                disabled={busy}
              >
                Retry
              </button>
            )}

            <button
              className="px-3 py-2 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm"
              onClick={doGenerate}
              disabled={busy}
            >
              {busy ? 'Generating…' : candidate ? 'Generate New' : 'Generate Preview'}
            </button>

            <button
              className="px-3 py-2 rounded bg-green-600 text-white text-sm"
              onClick={acceptAndSave}
              disabled={!candidate || busy}
            >
              Accept & Save
            </button>
          </div>

          {candidate && (
            <div className="relative mt-2 border rounded p-4">
              <div className="absolute right-2 top-2 text-[10px] uppercase tracking-wide bg-indigo-600 text-white rounded px-2 py-0.5">
                Preview Only
              </div>

              <h3 className="font-semibold text-lg pr-20">{candidate.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language} • {difficulty} • {length} (~{estMinutes} min)
              </p>

              <p className="mt-3 text-sm">{candidate.summary}</p>

              <ul className="list-disc ml-5 mt-2 text-sm space-y-1">
                {candidate.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Starter Code</summary>
                <pre className="mt-2 text-xs overflow-auto border rounded p-2 bg-slate-50 dark:bg-slate-800">
                  {candidate.starterCode}
                </pre>
              </details>

              {cost && (
                <p className="text-xs text-slate-400 mt-3">
                  {cost.inputTokens} in / {cost.outputTokens} out tokens (~${cost.totalUSD.toFixed(4)})
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
