import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIProvider } from './openai'
import type { AiKataCandidate, GenerateKataParams } from './types'

const MOCK_CANDIDATE: AiKataCandidate = {
  title: 'Build a debounce',
  summary: 'Implement a debounce utility function.',
  steps: ['Accept fn and delay', 'Return wrapper function', 'Clear timer on each call'],
  starterCode: 'function debounce(fn, delay) {}',
}

const BASE_PARAMS: GenerateKataParams = {
  language: 'typescript',
  difficulty: 'medium',
  length: 'Standard',
}

function makeFetchMock(candidate: AiKataCandidate) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: JSON.stringify(candidate) } }],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      }),
    text: () => Promise.resolve(''),
  })
}

describe('OpenAIProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the correct OpenAI endpoint', async () => {
    const fetchMock = makeFetchMock(MOCK_CANDIDATE)
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OpenAIProvider('sk-test-key')
    await provider.generateKata(BASE_PARAMS)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('sends the Authorization header with the api key', async () => {
    const fetchMock = makeFetchMock(MOCK_CANDIDATE)
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OpenAIProvider('sk-test-key')
    await provider.generateKata(BASE_PARAMS)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer sk-test-key')
  })

  it('parses the response into an AiKataCandidate', async () => {
    vi.stubGlobal('fetch', makeFetchMock(MOCK_CANDIDATE))

    const provider = new OpenAIProvider('sk-test-key')
    const result = await provider.generateKata(BASE_PARAMS)

    expect(result.title).toBe(MOCK_CANDIDATE.title)
    expect(result.summary).toBe(MOCK_CANDIDATE.summary)
    expect(result.steps).toEqual(MOCK_CANDIDATE.steps)
    expect(result.starterCode).toBe(MOCK_CANDIDATE.starterCode)
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      }),
    )

    const provider = new OpenAIProvider('bad-key')
    await expect(provider.generateKata(BASE_PARAMS)).rejects.toThrow('401')
  })

  it('estimateCost returns positive USD and token counts', () => {
    const provider = new OpenAIProvider('sk-test-key')
    const cost = provider.estimateCost(MOCK_CANDIDATE, BASE_PARAMS)

    expect(cost.inputTokens).toBeGreaterThan(0)
    expect(cost.outputTokens).toBeGreaterThan(0)
    expect(cost.totalUSD).toBeGreaterThan(0)
  })
})
