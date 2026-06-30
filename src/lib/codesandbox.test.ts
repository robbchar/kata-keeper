import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseSandboxIdFromUrl,
  sandboxEmbedUrl,
  sandboxOpenUrl,
  createSandbox,
  fetchSandboxMetadata,
} from './codesandbox'

// ---------------------------------------------------------------------------
// parseSandboxIdFromUrl
// ---------------------------------------------------------------------------

describe('parseSandboxIdFromUrl', () => {
  it('parses /s/ URLs', () => {
    expect(parseSandboxIdFromUrl('https://codesandbox.io/s/abc123')).toBe('abc123')
  })

  it('parses /p/sandbox/ URLs', () => {
    expect(parseSandboxIdFromUrl('https://codesandbox.io/p/sandbox/my-kata-xyz')).toBe('my-kata-xyz')
  })

  it('parses /embed/ URLs', () => {
    expect(parseSandboxIdFromUrl('https://codesandbox.io/embed/abc123?foo=bar')).toBe('abc123')
  })

  it('returns null for non-CodeSandbox URLs', () => {
    expect(parseSandboxIdFromUrl('https://github.com/user/repo')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(parseSandboxIdFromUrl('')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// sandboxEmbedUrl
// ---------------------------------------------------------------------------

describe('sandboxEmbedUrl', () => {
  it('produces an embed URL containing the sandbox ID', () => {
    const url = sandboxEmbedUrl('abc123')
    expect(url).toContain('codesandbox.io/embed/abc123')
  })

  it('includes the dark theme parameter', () => {
    const url = sandboxEmbedUrl('abc123')
    expect(url).toContain('theme=dark')
  })
})

// ---------------------------------------------------------------------------
// sandboxOpenUrl
// ---------------------------------------------------------------------------

describe('sandboxOpenUrl', () => {
  it('produces a direct /s/ open URL', () => {
    expect(sandboxOpenUrl('abc123')).toBe('https://codesandbox.io/s/abc123')
  })
})

// ---------------------------------------------------------------------------
// createSandbox
// ---------------------------------------------------------------------------

describe('createSandbox', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the correct CodeSandbox endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandbox_id: 'new-sandbox-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createSandbox({
      candidate: {
        title: 'My Kata',
        summary: 'A kata',
        steps: ['step one', 'step two'],
        starterCode: 'function solve() {}',
        language: 'typescript',
      },
      csToken: 'test-token',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.codesandbox.io/api/v1/sandboxes')
  })

  it('sends the Authorization header with the token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandbox_id: 'new-sandbox-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createSandbox({
      candidate: {
        title: 'My Kata',
        summary: 'A kata',
        steps: ['step one'],
        starterCode: 'function solve() {}',
        language: 'typescript',
      },
      csToken: 'my-token',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-token')
  })

  it('sends files with correct extensions for each language', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandbox_id: 'new-sandbox-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createSandbox({
      candidate: {
        title: 'React Kata',
        summary: 'A react kata',
        steps: ['step one'],
        starterCode: 'export default function App() {}',
        language: 'react',
      },
      csToken: 'token',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { files: Record<string, unknown> }
    expect(body.files).toHaveProperty('index.tsx')
  })

  it('includes a README.md with the kata title and steps as a bullet list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandbox_id: 'new-sandbox-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createSandbox({
      candidate: {
        title: 'My Kata',
        summary: 'A kata',
        steps: ['step one', 'step two'],
        starterCode: 'function solve() {}',
        language: 'typescript',
      },
      csToken: 'token',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { files: Record<string, { content: string }> }
    expect(body.files['README.md'].content).toContain('# My Kata')
    expect(body.files['README.md'].content).toContain('- step one')
  })

  it('returns just the sandbox ID string from the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandbox_id: 'returned-id' }),
    }))

    const result = await createSandbox({
      candidate: {
        title: 'Kata',
        summary: '',
        steps: [],
        starterCode: '',
        language: 'typescript',
      },
      csToken: 'token',
    })

    expect(result).toBe('returned-id')
  })

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    }))

    await expect(
      createSandbox({
        candidate: { title: 'K', summary: '', steps: [], starterCode: '', language: 'typescript' },
        csToken: 'bad-token',
      }),
    ).rejects.toThrow('403')
  })

  it('throws when the response contains no sandbox ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }))

    await expect(
      createSandbox({
        candidate: { title: 'K', summary: '', steps: [], starterCode: '', language: 'typescript' },
        csToken: 'token',
      }),
    ).rejects.toThrow('no sandbox ID')
  })
})

// ---------------------------------------------------------------------------
// fetchSandboxMetadata
// ---------------------------------------------------------------------------

describe('fetchSandboxMetadata', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the correct CodeSandbox endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updated_at: '2024-01-01T00:00:00Z' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchSandboxMetadata({ sandboxId: 'sandbox-abc', csToken: 'token' })

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.codesandbox.io/api/v1/sandboxes/sandbox-abc')
  })

  it('sends the Authorization header with the token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updated_at: '2024-01-01T00:00:00Z' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchSandboxMetadata({ sandboxId: 'sandbox-abc', csToken: 'my-token' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-token')
  })

  it('returns sandboxId and updatedAt from the top-level updated_at field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updated_at: '2024-06-01T12:00:00Z' }),
    }))

    const result = await fetchSandboxMetadata({ sandboxId: 'sandbox-abc', csToken: 'token' })
    expect(result).toEqual({ sandboxId: 'sandbox-abc', updatedAt: '2024-06-01T12:00:00Z' })
  })

  it('returns sandboxId and updatedAt from the nested sandbox.updated_at field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandbox: { updated_at: '2024-06-02T00:00:00Z' } }),
    }))

    const result = await fetchSandboxMetadata({ sandboxId: 'sandbox-abc', csToken: 'token' })
    expect(result).toEqual({ sandboxId: 'sandbox-abc', updatedAt: '2024-06-02T00:00:00Z' })
  })

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    await expect(
      fetchSandboxMetadata({ sandboxId: 'missing-id', csToken: 'token' }),
    ).rejects.toThrow('404')
  })

  it('throws when the network request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    await expect(
      fetchSandboxMetadata({ sandboxId: 'sandbox-abc', csToken: 'token' }),
    ).rejects.toThrow('Network error')
  })
})
