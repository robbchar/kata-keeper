import { describe, it, expectTypeOf } from 'vitest'
import type { Kata, Language } from './index'
import type { UserConfig } from './config'

describe('Kata type', () => {
  it('has required fields', () => {
    const k: Kata = {
      id: 'abc',
      title: 'Test',
      languages: ['typescript'],
      tags: [],
      createdAt: new Date().toISOString(),
    }
    expectTypeOf(k).toMatchTypeOf<Kata>()
  })

  it('accepts optional sandbox fields', () => {
    const k: Kata = {
      id: 'abc',
      title: 'Test',
      languages: ['react'],
      tags: ['hooks'],
      sandboxId: 'xyz123',
      sandboxUpdatedAt: new Date().toISOString(),
      notes: 'some notes',
      createdAt: new Date().toISOString(),
    }
    expectTypeOf(k).toMatchTypeOf<Kata>()
  })
})

describe('Language type', () => {
  it('only allows bounded values', () => {
    const langs: Language[] = ['javascript', 'typescript', 'react']
    expectTypeOf(langs).toMatchTypeOf<Language[]>()
  })
})

describe('UserConfig type', () => {
  it('has required fields', () => {
    const config: UserConfig = {
      aiProvider: 'openai',
      aiApiKey: 'sk-...',
      csToken: '',
      csGitHubConnected: false,
      tags: ['hooks', 'async'],
    }
    expectTypeOf(config).toMatchTypeOf<UserConfig>()
  })
})
