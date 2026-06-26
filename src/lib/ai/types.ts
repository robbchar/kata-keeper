import type { Language } from '@/types'

export type AiKataCandidate = {
  title: string
  summary: string // one-line description
  steps: string[] // requirement bullets (3-6 items)
  starterCode: string
}

export type GenerateKataParams = {
  influence?: string
  language: Language
  difficulty: 'easy' | 'medium' | 'hard'
  length: 'Snack' | 'Standard' | 'DeepDive'
  existingKataTitles?: string[]
}

export type CostEstimate = {
  inputTokens: number
  outputTokens: number
  totalUSD: number
}

export interface AiProvider {
  generateKata(params: GenerateKataParams): Promise<AiKataCandidate>
  estimateCost(candidate: AiKataCandidate, params: GenerateKataParams): CostEstimate
}
