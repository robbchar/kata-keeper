import { describe, it, expect } from 'vitest'
import { buildUserPrompt, estimateMinutes } from './prompt'
import type { GenerateKataParams } from './types'

const base: GenerateKataParams = {
  language: 'typescript',
  difficulty: 'medium',
  length: 'Standard',
}

describe('buildUserPrompt', () => {
  it('includes language and difficulty', () => {
    const prompt = buildUserPrompt(base)
    expect(prompt).toContain('TypeScript')
    expect(prompt).toContain('Intermediate')
  })

  it('includes influence when provided', () => {
    const prompt = buildUserPrompt({ ...base, influence: 'memoization' })
    expect(prompt).toContain('memoization')
  })

  it('includes existing kata titles when provided', () => {
    const prompt = buildUserPrompt({
      ...base,
      existingKataTitles: ['Build a debounce', 'Implement BFS'],
    })
    expect(prompt).toContain('Build a debounce')
    expect(prompt).toContain('Implement BFS')
  })

  it('omits existing katas line when array is empty', () => {
    const prompt = buildUserPrompt({ ...base, existingKataTitles: [] })
    expect(prompt).not.toContain('Avoid')
  })
})

describe('estimateMinutes', () => {
  it('returns 15 for Snack', () => expect(estimateMinutes('Snack')).toBe(15))
  it('returns 35 for Standard', () => expect(estimateMinutes('Standard')).toBe(35))
  it('returns 75 for DeepDive', () => expect(estimateMinutes('DeepDive')).toBe(75))
})
