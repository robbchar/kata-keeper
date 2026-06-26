import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseSandboxId, sandboxEmbedUrl, sandboxOpenUrl, createSandbox, fetchSandboxMeta } from './codesandbox'

// ---------------------------------------------------------------------------
// parseSandboxId
// ---------------------------------------------------------------------------

describe('parseSandboxId', () => {
  it('parses /s/ URLs', () => {
    expect(parseSandboxId('https://codesandbox.io/s/abc123')).toBe('abc123')
  })

  it('parses /p/sandbox/ URLs', () => {
    expect(parseSandboxId('https://codesandbox.io/p/sandbox/my-kata-xyz')).toBe('my-kata-xyz')
  })

  it('parses /embed/ URLs', () => {
    expect(parseSandboxId('https://codesandbox.io/embed/abc123?foo=bar')).toBe('abc123')
  })

  it('returns null for non-CodeSandbox URLs', () => {
    expect(parseSandboxId('https://github.com/user/repo')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(parseSandboxId('')).toBeNull()
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

    await createSandbox('test-token', {
      title: 'My Kata',
      starterCode: 'function solve() {}',
      spec: '- step one\n- step two',
      language: 'typescript',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://codesandbox.io/api/v1/sandboxes/define?json=1')
  })

  it('sends the Authorization header with the token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandbox_id: 'new-sandbox-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createSandbox('my-token', {
      title: 'My Kata',
      starterCode: 'function solve() {}',
      spec: '- step one',
      language: 'typescript',
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

    await createSandbox('token', {
      title: 'React Kata',
      starterCode: 'export default function App() {}',
      spec: '- step one',
      language: 'react',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { files: Record<string, unknown> }
    expect(body.files).toHaveProperty('index.tsx')
  })

  it('includes a README.md with the kata title and spec', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandbox_id: 'new-sandbox-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createSandbox('token', {
      title: 'My Kata',
      starterCode: 'function solve() {}',
      spec: '- step one\n- step two',
      language: 'typescript',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { files: Record<string, { content: string }> }
    expect(body.files['README.md'].content).toContain('# My Kata')
    expect(body.files['README.md'].content).toContain('- step one')
  })

  it('returns the sandbox ID from the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandbox_id: 'returned-id' }),
    }))

    const result = await createSandbox('token', {
      title: 'Kata',
      starterCode: '',
      spec: '',
      language: 'typescript',
    })

    expect(result.id).toBe('returned-id')
  })

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    }))

    await expect(
      createSandbox('bad-token', { title: 'K', starterCode: '', spec: '', language: 'typescript' }),
    ).rejects.toThrow('403')
  })

  it('throws when the response contains no sandbox ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }))

    await expect(
      createSandbox('token', { title: 'K', starterCode: '', spec: '', language: 'typescript' }),
    ).rejects.toThrow('no sandbox ID')
  })
})

// ---------------------------------------------------------------------------
// fetchSandboxMeta
// ---------------------------------------------------------------------------

describe('fetchSandboxMeta', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the correct CodeSandbox endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updated_at: '2024-01-01T00:00:00Z' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchSandboxMeta('token', 'sandbox-abc')

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://codesandbox.io/api/v1/sandboxes/sandbox-abc')
  })

  it('sends the Authorization header with the token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updated_at: '2024-01-01T00:00:00Z' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchSandboxMeta('my-token', 'sandbox-abc')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-token')
  })

  it('returns updatedAt from the top-level updated_at field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updated_at: '2024-06-01T12:00:00Z' }),
    }))

    const result = await fetchSandboxMeta('token', 'sandbox-abc')
    expect(result).toEqual({ updatedAt: '2024-06-01T12:00:00Z' })
  })

  it('returns updatedAt from the nested sandbox.updated_at field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandbox: { updated_at: '2024-06-02T00:00:00Z' } }),
    }))

    const result = await fetchSandboxMeta('token', 'sandbox-abc')
    expect(result).toEqual({ updatedAt: '2024-06-02T00:00:00Z' })
  })

  it('returns null on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const result = await fetchSandboxMeta('token', 'missing-id')
    expect(result).toBeNull()
  })

  it('returns null when the network request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const result = await fetchSandboxMeta('token', 'sandbox-abc')
    expect(result).toBeNull()
  })
})
