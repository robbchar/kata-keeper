import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import KataDetailPage from './KataDetailPage'
import type { Kata } from '@/types'

// ---------------------------------------------------------------------------
// Module mocks
// Variables prefixed with "mock" are hoisted safely by vitest.
// ---------------------------------------------------------------------------

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'test-uid' }, loading: false }),
}))

const mockKataRepoGet = vi.fn()
const mockKataRepoUpdate = vi.fn()
const mockKataRepoRemove = vi.fn()

vi.mock('@/db', () => ({
  KataRepo: {
    get: (id: string) => mockKataRepoGet(id),
    update: (id: string, patch: Partial<Kata>) => mockKataRepoUpdate(id, patch),
    remove: (id: string) => mockKataRepoRemove(id),
  },
  formatRelative: (iso?: string) => (iso ? 'just now' : '—'),
  classNames: (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' '),
}))

const mockGetUserConfig = vi.fn()
vi.mock('@/lib/userConfig', () => ({
  getUserConfig: (uid: string) => mockGetUserConfig(uid),
  DEFAULT_TAGS: ['hooks', 'async'],
}))

const mockFetchSandboxMetadata = vi.fn()
const mockParseSandboxIdFromUrl = vi.fn()
const mockSandboxEmbedUrl = vi.fn((id: string) => `https://codesandbox.io/embed/${id}`)
const mockSandboxOpenUrl = vi.fn((id: string) => `https://codesandbox.io/s/${id}`)

vi.mock('@/lib/codesandbox', () => ({
  fetchSandboxMetadata: (params: { sandboxId: string; csToken: string }) =>
    mockFetchSandboxMetadata(params),
  parseSandboxIdFromUrl: (url: string) => mockParseSandboxIdFromUrl(url),
  sandboxEmbedUrl: (id: string) => mockSandboxEmbedUrl(id),
  sandboxOpenUrl: (id: string) => mockSandboxOpenUrl(id),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseKata: Kata = {
  id: 'kata-abc',
  title: 'Debounce a Search Input',
  languages: ['typescript'],
  tags: ['hooks'],
  sandboxId: 'sandbox-xyz',
  sandboxUpdatedAt: '2024-06-01T10:00:00.000Z',
  notes: 'Initial notes.',
  createdAt: '2024-05-01T09:00:00.000Z',
}

const kataWithoutSandbox: Kata = {
  id: 'kata-nosandbox',
  title: 'Kata Without Sandbox',
  languages: ['javascript'],
  tags: [],
  createdAt: '2024-05-01T09:00:00.000Z',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage(kataId = 'kata-abc') {
  return {
    userActions: userEvent.setup(),
    ...render(
      <MemoryRouter initialEntries={[`/kata/${kataId}`]}>
        <Routes>
          <Route path="/kata/:id" element={<KataDetailPage />} />
        </Routes>
      </MemoryRouter>,
    ),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KataDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKataRepoGet.mockResolvedValue(baseKata)
    mockKataRepoUpdate.mockResolvedValue(undefined)
    mockKataRepoRemove.mockResolvedValue(undefined)
    mockGetUserConfig.mockResolvedValue({
      aiProvider: 'openai',
      aiApiKey: 'sk-test',
      csToken: 'cs-test-token',
      csGitHubConnected: false,
      tags: ['hooks', 'async'],
    })
    // Default: return same updatedAt so no update is triggered
    mockFetchSandboxMetadata.mockResolvedValue({
      sandboxId: 'sandbox-xyz',
      updatedAt: baseKata.sandboxUpdatedAt,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // Loading and rendering
  // -------------------------------------------------------------------------
  describe('page load', () => {
    it('shows a loading state before the kata is fetched', () => {
      mockKataRepoGet.mockReturnValue(new Promise(() => {})) // never resolves
      renderPage()
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('loads and renders the kata title in the header input', async () => {
      renderPage()
      expect(await screen.findByDisplayValue(baseKata.title)).toBeInTheDocument()
    })

    it('calls KataRepo.get with the route id', async () => {
      renderPage('kata-abc')
      await screen.findByDisplayValue(baseKata.title)
      expect(mockKataRepoGet).toHaveBeenCalledWith('kata-abc')
    })

    it('shows "not found" message when KataRepo.get returns undefined', async () => {
      mockKataRepoGet.mockResolvedValue(undefined)
      renderPage()
      expect(await screen.findByText(/kata not found/i)).toBeInTheDocument()
    })

    it('renders the back link', async () => {
      renderPage()
      await screen.findByDisplayValue(baseKata.title)
      expect(screen.getByRole('link', { name: /back/i })).toBeInTheDocument()
    })

    it('renders language chips for all three options', async () => {
      renderPage()
      await screen.findByDisplayValue(baseKata.title)
      expect(screen.getByRole('button', { name: 'javascript' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'typescript' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'react' })).toBeInTheDocument()
    })

    it('renders the notes textarea with pre-existing notes', async () => {
      renderPage()
      await screen.findByDisplayValue(baseKata.title)
      expect(screen.getByDisplayValue('Initial notes.')).toBeInTheDocument()
    })

    it('renders the CodeSandbox iframe when sandboxId is set', async () => {
      renderPage()
      await screen.findByDisplayValue(baseKata.title)
      const iframe = screen.getByTitle('CodeSandbox')
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('src', expect.stringContaining('sandbox-xyz'))
    })

    it('renders the "Open in CodeSandbox" link when sandboxId is set', async () => {
      renderPage()
      await screen.findByDisplayValue(baseKata.title)
      expect(screen.getByRole('link', { name: /open in codesandbox/i })).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Sandbox URL linking placeholder
  // -------------------------------------------------------------------------
  describe('sandbox placeholder (no sandboxId)', () => {
    it('renders the URL input placeholder when kata has no sandboxId', async () => {
      mockKataRepoGet.mockResolvedValue(kataWithoutSandbox)
      renderPage('kata-nosandbox')
      expect(await screen.findByPlaceholderText(/paste codesandbox url/i)).toBeInTheDocument()
    })

    it('does not render the iframe when kata has no sandboxId', async () => {
      mockKataRepoGet.mockResolvedValue(kataWithoutSandbox)
      renderPage('kata-nosandbox')
      await screen.findByPlaceholderText(/paste codesandbox url/i)
      expect(screen.queryByTitle('CodeSandbox')).not.toBeInTheDocument()
    })

    it('parses and saves sandboxId when a valid URL is submitted via the Link button', async () => {
      mockKataRepoGet.mockResolvedValue(kataWithoutSandbox)
      mockParseSandboxIdFromUrl.mockReturnValue('new-sandbox-id')

      const { userActions } = renderPage('kata-nosandbox')
      const input = await screen.findByPlaceholderText(/paste codesandbox url/i)

      await userActions.type(input, 'https://codesandbox.io/s/new-sandbox-id')
      await userActions.click(screen.getByRole('button', { name: /link/i }))

      await waitFor(() => {
        expect(mockKataRepoUpdate).toHaveBeenCalledWith(
          'kata-nosandbox',
          expect.objectContaining({ sandboxId: 'new-sandbox-id' }),
        )
      })
    })

    it('does not call KataRepo.update when parseSandboxIdFromUrl returns null', async () => {
      mockKataRepoGet.mockResolvedValue(kataWithoutSandbox)
      mockParseSandboxIdFromUrl.mockReturnValue(null)

      const { userActions } = renderPage('kata-nosandbox')
      const input = await screen.findByPlaceholderText(/paste codesandbox url/i)

      await userActions.type(input, 'not-a-valid-url')
      await userActions.click(screen.getByRole('button', { name: /link/i }))

      expect(mockKataRepoUpdate).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Inline title editing
  // -------------------------------------------------------------------------
  describe('inline title editing', () => {
    it('calls KataRepo.update when the title changes', async () => {
      renderPage()
      const titleInput = await screen.findByDisplayValue(baseKata.title)

      fireEvent.change(titleInput, { target: { value: 'Updated Title' } })

      await waitFor(() => {
        expect(mockKataRepoUpdate).toHaveBeenCalledWith(
          'kata-abc',
          expect.objectContaining({ title: 'Updated Title' }),
        )
      })
    })
  })

  // -------------------------------------------------------------------------
  // Notes autosave debounce
  //
  // Strategy: render and wait for kata load with real timers, THEN switch to
  // fake timers so that vi.advanceTimersByTime controls the debounce timeout
  // without interfering with waitFor / Promise resolution during page load.
  // -------------------------------------------------------------------------
  describe('notes autosave with debounce', () => {
    it('does not call KataRepo.update for notes immediately on change', async () => {
      // Load with real timers
      renderPage()
      await screen.findByDisplayValue(baseKata.title)

      // Clear any calls that happened during load, then switch to fake timers
      mockKataRepoUpdate.mockClear()
      vi.useFakeTimers()

      const notesTextarea = screen.getByPlaceholderText(/add thoughts/i)
      fireEvent.change(notesTextarea, { target: { value: 'Updated notes' } })

      // No update should have fired yet — the 1s debounce has not elapsed
      const notesCalls = mockKataRepoUpdate.mock.calls.filter(([, p]) => 'notes' in p)
      expect(notesCalls).toHaveLength(0)
    })

    it('fires KataRepo.update for notes after the 1-second debounce', async () => {
      // Load with real timers
      renderPage()
      await screen.findByDisplayValue(baseKata.title)

      mockKataRepoUpdate.mockClear()
      vi.useFakeTimers()

      const notesTextarea = screen.getByPlaceholderText(/add thoughts/i)
      fireEvent.change(notesTextarea, { target: { value: 'Debounced notes' } })

      // Advance past the debounce window — this executes the setTimeout callback
      act(() => { vi.advanceTimersByTime(1100) })

      const notesCalls = mockKataRepoUpdate.mock.calls.filter(([, p]) => 'notes' in p)
      expect(notesCalls).toHaveLength(1)
      expect(notesCalls[0]).toEqual(['kata-abc', { notes: 'Debounced notes' }])
    })

    it('resets the debounce timer when notes change again before 1 second elapses', async () => {
      // Load with real timers
      renderPage()
      await screen.findByDisplayValue(baseKata.title)

      mockKataRepoUpdate.mockClear()
      vi.useFakeTimers()

      const notesTextarea = screen.getByPlaceholderText(/add thoughts/i)

      fireEvent.change(notesTextarea, { target: { value: 'First change' } })
      act(() => { vi.advanceTimersByTime(500) }) // 500ms — debounce has not fired

      fireEvent.change(notesTextarea, { target: { value: 'Second change' } })
      act(() => { vi.advanceTimersByTime(500) }) // only 500ms since last change — still no fire

      expect(mockKataRepoUpdate.mock.calls.filter(([, p]) => 'notes' in p)).toHaveLength(0)

      act(() => { vi.advanceTimersByTime(600) }) // now > 1s since last change — fires

      const notesCalls = mockKataRepoUpdate.mock.calls.filter(([, p]) => 'notes' in p)
      expect(notesCalls).toHaveLength(1)
      expect(notesCalls[0][1]).toEqual({ notes: 'Second change' })
    })
  })

  // -------------------------------------------------------------------------
  // Language toggle
  // -------------------------------------------------------------------------
  describe('language toggling', () => {
    it('removes an active language when its chip is clicked', async () => {
      const { userActions } = renderPage()
      await screen.findByDisplayValue(baseKata.title)

      // typescript is active in baseKata.languages
      await userActions.click(screen.getByRole('button', { name: 'typescript' }))

      await waitFor(() => {
        expect(mockKataRepoUpdate).toHaveBeenCalledWith(
          'kata-abc',
          expect.objectContaining({ languages: [] }),
        )
      })
    })

    it('adds an inactive language when its chip is clicked', async () => {
      const { userActions } = renderPage()
      await screen.findByDisplayValue(baseKata.title)

      // javascript is NOT in baseKata.languages
      await userActions.click(screen.getByRole('button', { name: 'javascript' }))

      await waitFor(() => {
        expect(mockKataRepoUpdate).toHaveBeenCalledWith(
          'kata-abc',
          expect.objectContaining({
            languages: expect.arrayContaining(['typescript', 'javascript']),
          }),
        )
      })
    })
  })

  // -------------------------------------------------------------------------
  // Background sandbox metadata refresh
  // -------------------------------------------------------------------------
  describe('sandbox metadata background refresh', () => {
    it('calls fetchSandboxMetadata with sandboxId and csToken on load', async () => {
      renderPage()
      await screen.findByDisplayValue(baseKata.title)

      await waitFor(() => {
        expect(mockFetchSandboxMetadata).toHaveBeenCalledWith({
          sandboxId: 'sandbox-xyz',
          csToken: 'cs-test-token',
        })
      })
    })

    it('calls KataRepo.update with a newer sandboxUpdatedAt when the timestamp differs', async () => {
      const newerTimestamp = '2024-07-01T12:00:00.000Z'
      mockFetchSandboxMetadata.mockResolvedValue({
        sandboxId: 'sandbox-xyz',
        updatedAt: newerTimestamp,
      })

      renderPage()
      await screen.findByDisplayValue(baseKata.title)

      await waitFor(() => {
        expect(mockKataRepoUpdate).toHaveBeenCalledWith(
          'kata-abc',
          { sandboxUpdatedAt: newerTimestamp },
        )
      })
    })

    it('does not call KataRepo.update when the fetched timestamp matches the stored one', async () => {
      // mockFetchSandboxMetadata already returns the same updatedAt as baseKata (set in beforeEach)
      renderPage()
      await screen.findByDisplayValue(baseKata.title)

      await act(async () => { await new Promise((r) => setTimeout(r, 50)) })

      const sandboxUpdateCalls = mockKataRepoUpdate.mock.calls.filter(
        ([, patch]) => 'sandboxUpdatedAt' in patch,
      )
      expect(sandboxUpdateCalls).toHaveLength(0)
    })

    it('skips fetchSandboxMetadata when csToken is missing from user config', async () => {
      mockGetUserConfig.mockResolvedValue({
        aiProvider: 'openai',
        aiApiKey: '',
        csToken: '',
        csGitHubConnected: false,
        tags: [],
      })

      renderPage()
      await screen.findByDisplayValue(baseKata.title)

      await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
      expect(mockFetchSandboxMetadata).not.toHaveBeenCalled()
    })

    it('does not block page load when fetchSandboxMetadata rejects', async () => {
      mockFetchSandboxMetadata.mockRejectedValue(new Error('CS API error'))

      renderPage()
      // Page must still load normally despite the background error
      expect(await screen.findByDisplayValue(baseKata.title)).toBeInTheDocument()
    })
  })
})
