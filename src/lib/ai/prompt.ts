import type { GenerateKataParams } from './types'

const LENGTH_MINUTES: Record<string, number> = {
  Snack: 15,
  Standard: 35,
  DeepDive: 75,
}

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  react: 'React (TSX)',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Beginner',
  medium: 'Intermediate',
  hard: 'Advanced',
}

export function buildSystemPrompt(): string {
  return 'You generate concise, runnable coding katas. Keep code minimal; avoid heavy dependencies. Title must be 8 words or fewer.'
}

export function buildUserPrompt(params: GenerateKataParams): string {
  const { influence, language, difficulty, length, existingKataTitles } = params
  const estMinutes = LENGTH_MINUTES[length] ?? LENGTH_MINUTES['Standard']
  const langLabel = LANGUAGE_LABELS[language] ?? LANGUAGE_LABELS['typescript']
  const diffLabel = DIFFICULTY_LABELS[difficulty] ?? DIFFICULTY_LABELS['medium']

  return [
    influence ? `Influence/focus: ${influence}` : '',
    `Language: ${langLabel}`,
    `Difficulty: ${diffLabel}, target time: ${estMinutes} min`,
    existingKataTitles?.length
      ? `Avoid topics already covered: ${existingKataTitles.join(', ')}`
      : '',
    `Return ONLY valid JSON with these fields: title (string, ≤8 words), summary (string, one sentence), steps (array of 3–6 requirement strings), starterCode (string in ${langLabel}).`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function estimateMinutes(length: string): number {
  return LENGTH_MINUTES[length] ?? LENGTH_MINUTES['Standard']
}
