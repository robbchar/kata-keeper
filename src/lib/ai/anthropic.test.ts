import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicProvider } from './anthropic'
import type { AiKataCandidate, GenerateKataParams } from './types'

const MOCK_CANDIDATE: AiKataCandidate = {
  title: 'Implement BFS',
  summary: 'Traverse a graph using breadth-first search.',
  steps: ['Define a queue', 'Mark visited nodes', 'Process each neighbour'],
  starterCode: 'function bfs(graph, start) {}',
}

const BASE_PARAMS: GenerateKataParams = {
  language: 'javascript',
  difficulty: 'hard',
  length: 'DeepDive',
}

function makeFetchMock(candidate: AiKataCandidate) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify(candidate) }],
        usage: { input_tokens: 80, output_tokens: 150 },
      }),
    text: () => Promise.resolve(''),
  })
}

describe('AnthropicProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the correct Anthropic endpoint', async () => {
    const fetchMock = makeFetchMock(MOCK_CANDIDATE)
    vi.stubGlobal('fetch', fetchMock)

    const provider = new AnthropicProvider('sk-ant-test')
    await provider.generateKata(BASE_PARAMS)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
  })

  it('sends required Anthropic headers', async () => {
    const fetchMock = makeFetchMock(MOCK_CANDIDATE)
    vi.stubGlobal('fetch', fetchMock)

    const provider = new AnthropicProvider('sk-ant-test')
    await provider.generateKata(BASE_PARAMS)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['anthropic-dangerous-direct-browser-calls']).toBe('true')
  })

  it('parses the response into an AiKataCandidate', async () => {
    vi.stubGlobal('fetch', makeFetchMock(MOCK_CANDIDATE))

    const provider = new AnthropicProvider('sk-ant-test')
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
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      }),
    )

    const provider = new AnthropicProvider('bad-key')
    await expect(provider.generateKata(BASE_PARAMS)).rejects.toThrow('403')
  })

  it('estimateCost returns positive USD and token counts', () => {
    const provider = new AnthropicProvider('sk-ant-test')
    const cost = provider.estimateCost(MOCK_CANDIDATE, BASE_PARAMS)

    expect(cost.inputTokens).toBeGreaterThan(0)
    expect(cost.outputTokens).toBeGreaterThan(0)
    expect(cost.totalUSD).toBeGreaterThan(0)
  })
})
