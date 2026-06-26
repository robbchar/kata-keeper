import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UserConfig } from '@/types/config'
import { DEFAULT_TAGS, getUserConfig, updateUserConfig } from './userConfig'

vi.mock('@/lib/firebase', () => ({
  firebase: vi.fn(() => ({ db: {} })),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}))

describe('DEFAULT_TAGS', () => {
  it('includes the required starter tags', () => {
    expect(DEFAULT_TAGS).toContain('hooks')
    expect(DEFAULT_TAGS).toContain('async')
    expect(DEFAULT_TAGS).toContain('algorithms')
    expect(DEFAULT_TAGS.length).toBeGreaterThanOrEqual(12)
  })
})

describe('getUserConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seeds defaults when no config doc exists', async () => {
    const { getDoc, setDoc } = await import('firebase/firestore')
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as never)
    vi.mocked(setDoc).mockResolvedValueOnce(undefined)

    const config = await getUserConfig('user-1')

    expect(config.aiProvider).toBe('openai')
    expect(config.tags).toEqual(DEFAULT_TAGS)
    expect(setDoc).toHaveBeenCalledOnce()
  })

  it('returns existing config when doc exists', async () => {
    const { getDoc } = await import('firebase/firestore')
    const existing: UserConfig = {
      aiProvider: 'anthropic',
      aiApiKey: 'sk-ant-123',
      csToken: '',
      csGitHubConnected: false,
      tags: ['hooks'],
    }
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => existing,
    } as never)

    const config = await getUserConfig('user-1')

    expect(config.aiProvider).toBe('anthropic')
    expect(config.tags).toEqual(['hooks'])
  })
})

describe('updateUserConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls updateDoc with the uid and patch', async () => {
    const { updateDoc } = await import('firebase/firestore')
    vi.mocked(updateDoc).mockResolvedValueOnce(undefined)

    await updateUserConfig('user-1', { aiProvider: 'anthropic' })

    expect(updateDoc).toHaveBeenCalledOnce()
    expect(updateDoc).toHaveBeenCalledWith(
      undefined, // doc() is mocked and returns undefined
      { aiProvider: 'anthropic' },
    )
  })

  it('passes through a partial patch without overwriting unrelated fields', async () => {
    const { updateDoc } = await import('firebase/firestore')
    vi.mocked(updateDoc).mockResolvedValueOnce(undefined)

    const patch = { csToken: 'new-token', csGitHubConnected: true }
    await updateUserConfig('user-42', patch)

    expect(updateDoc).toHaveBeenCalledWith(undefined, patch)
  })
})
