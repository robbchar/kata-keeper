import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewKataDialog } from './NewKataDialog'

// ---------------------------------------------------------------------------
// Module mocks
// Variables that start with "mock" can be referenced inside vi.mock factories
// because vitest's hoisting logic exempts them from the TDZ restriction.
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'test-uid' }, loading: false }),
}))

vi.mock('@/lib/userConfig', () => ({
  getUserConfig: vi.fn(),
}))

const mockGenerateKata = vi.fn()
const mockEstimateCost = vi.fn()
const mockProvider = {
  generateKata: mockGenerateKata,
  estimateCost: mockEstimateCost,
}
const mockCreateAiProvider = vi.fn((_config: unknown) => mockProvider)

vi.mock('@/lib/ai', () => ({
  createAiProvider: (config: unknown) => mockCreateAiProvider(config),
  estimateMinutes: (length: string): number =>
    ({ Snack: 15, Standard: 35, DeepDive: 75 } as Record<string, number>)[length] ?? 35,
}))

const mockCreateSandbox = vi.fn()
vi.mock('@/lib/codesandbox', () => ({
  createSandbox: (params: unknown) => mockCreateSandbox(params),
}))

const mockKataRepoUpsert = vi.fn()
const mockKataRepoList = vi.fn()
vi.mock('@/db', () => ({
  KataRepo: {
    list: () => mockKataRepoList(),
    upsert: (kata: unknown) => mockKataRepoUpsert(kata),
  },
  uuid: () => 'test-kata-uuid',
  nowISO: () => '2024-01-01T00:00:00.000Z',
}))

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const defaultConfig = {
  aiProvider: 'openai' as const,
  aiApiKey: 'sk-test',
  csToken: 'cs-test-token',
  csGitHubConnected: false,
  tags: [],
}

const sampleCandidate = {
  title: 'Debounce a Search Input',
  summary: 'Implement a debounced search input component.',
  steps: ['Create the hook', 'Wire up the input', 'Write a test'],
  starterCode: 'export function useDebounce() {}',
}

const sampleCost = { inputTokens: 100, outputTokens: 200, totalUSD: 0.0012 }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(onClose = vi.fn()) {
  return { userActions: userEvent.setup(), onClose, ...render(<NewKataDialog onClose={onClose} />) }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewKataDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKataRepoList.mockResolvedValue([])
    mockKataRepoUpsert.mockResolvedValue(undefined)
    mockCreateSandbox.mockResolvedValue('sandbox-abc123')
    mockGenerateKata.mockResolvedValue(sampleCandidate)
    mockEstimateCost.mockReturnValue(sampleCost)
  })

  // -------------------------------------------------------------------------
  // Idle state
  // -------------------------------------------------------------------------
  describe('idle state', () => {
    it('renders the form controls and action buttons', () => {
      renderDialog()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('New Kata from AI')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/memoization/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /generate preview/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('disables "Accept & Save" before generation', () => {
      renderDialog()
      expect(screen.getByRole('button', { name: /accept & save/i })).toBeDisabled()
    })

    it('calls onClose when Cancel is clicked', async () => {
      const { userActions, onClose } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /cancel/i }))
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose when the backdrop overlay is clicked', async () => {
      const { userActions, onClose } = renderDialog()
      const backdrop = document.querySelector('.fixed .absolute') as HTMLElement
      await userActions.click(backdrop)
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  // -------------------------------------------------------------------------
  // Idle → Generating transition
  // -------------------------------------------------------------------------
  describe('idle → generating', () => {
    it('shows "Generating…" while the AI request is in flight', async () => {
      const { getUserConfig } = await import('@/lib/userConfig')
      vi.mocked(getUserConfig).mockResolvedValue(defaultConfig)
      mockGenerateKata.mockReturnValue(new Promise(() => {})) // never resolves

      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))

      expect(await screen.findByText('Generating…')).toBeInTheDocument()
    })

    it('shows an error when the AI API key is not configured', async () => {
      const { getUserConfig } = await import('@/lib/userConfig')
      vi.mocked(getUserConfig).mockResolvedValue({ ...defaultConfig, aiApiKey: '' })

      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))

      expect(await screen.findByText(/no ai api key/i)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Generating → Preview transition
  // -------------------------------------------------------------------------
  describe('generating → preview', () => {
    beforeEach(async () => {
      const { getUserConfig } = await import('@/lib/userConfig')
      vi.mocked(getUserConfig).mockResolvedValue(defaultConfig)
    })

    it('shows the candidate title and summary after generation', async () => {
      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))

      expect(await screen.findByText(sampleCandidate.title)).toBeInTheDocument()
      expect(screen.getByText(sampleCandidate.summary)).toBeInTheDocument()
    })

    it('renders each step bullet point', async () => {
      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))

      await screen.findByText(sampleCandidate.title)
      for (const step of sampleCandidate.steps) {
        expect(screen.getByText(step)).toBeInTheDocument()
      }
    })

    it('displays the token cost estimate', async () => {
      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))

      await screen.findByText(sampleCandidate.title)
      expect(screen.getByText(/100 in \/ 200 out/)).toBeInTheDocument()
    })

    it('shows the "Preview Only" badge on the candidate card', async () => {
      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))

      expect(await screen.findByText(/preview only/i)).toBeInTheDocument()
    })

    it('enables "Accept & Save" once a candidate is shown', async () => {
      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))

      await screen.findByText(sampleCandidate.title)
      expect(screen.getByRole('button', { name: /accept & save/i })).not.toBeDisabled()
    })

    it('shows a "Retry" button after the first successful generation', async () => {
      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))

      expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Preview → Saving (with CS token configured)
  // -------------------------------------------------------------------------
  describe('preview → saving with a CS token', () => {
    async function generateAndSave() {
      const { getUserConfig } = await import('@/lib/userConfig')
      vi.mocked(getUserConfig).mockResolvedValue(defaultConfig)

      const { userActions, onClose } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))
      await screen.findByText(sampleCandidate.title)
      await userActions.click(screen.getByRole('button', { name: /accept & save/i }))
      return { onClose }
    }

    it('calls createSandbox with the candidate and csToken', async () => {
      await generateAndSave()
      await waitFor(() => {
        expect(mockCreateSandbox).toHaveBeenCalledWith(
          expect.objectContaining({
            csToken: defaultConfig.csToken,
            candidate: expect.objectContaining({ title: sampleCandidate.title }),
          }),
        )
      })
    })

    it('saves the kata to KataRepo with the returned sandbox ID', async () => {
      await generateAndSave()
      await waitFor(() => {
        expect(mockKataRepoUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'test-kata-uuid',
            title: sampleCandidate.title,
            sandboxId: 'sandbox-abc123',
          }),
        )
      })
    })

    it('calls onClose after a successful save', async () => {
      const { onClose } = await generateAndSave()
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })

    it('navigates to /kata/:id after saving', async () => {
      await generateAndSave()
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/kata/test-kata-uuid'))
    })
  })

  // -------------------------------------------------------------------------
  // Preview → Saving (no CS token)
  // -------------------------------------------------------------------------
  describe('preview → saving without a CS token', () => {
    beforeEach(async () => {
      const { getUserConfig } = await import('@/lib/userConfig')
      vi.mocked(getUserConfig).mockResolvedValue({ ...defaultConfig, csToken: '' })
    })

    it('saves the kata without a sandboxId', async () => {
      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))
      await screen.findByText(sampleCandidate.title)
      await userActions.click(screen.getByRole('button', { name: /accept & save/i }))

      await waitFor(() => {
        expect(mockKataRepoUpsert).toHaveBeenCalledWith(
          expect.objectContaining({ sandboxId: undefined }),
        )
      })
    })

    it('does not call createSandbox', async () => {
      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))
      await screen.findByText(sampleCandidate.title)
      await userActions.click(screen.getByRole('button', { name: /accept & save/i }))

      await waitFor(() => expect(mockKataRepoUpsert).toHaveBeenCalled())
      expect(mockCreateSandbox).not.toHaveBeenCalled()
    })

    it('still navigates to /kata/:id after saving', async () => {
      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))
      await screen.findByText(sampleCandidate.title)
      await userActions.click(screen.getByRole('button', { name: /accept & save/i }))

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/kata/test-kata-uuid'))
    })
  })

  // -------------------------------------------------------------------------
  // Retry
  // -------------------------------------------------------------------------
  describe('retry', () => {
    it('calls generateKata again when Retry is clicked', async () => {
      const { getUserConfig } = await import('@/lib/userConfig')
      vi.mocked(getUserConfig).mockResolvedValue(defaultConfig)

      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))
      await screen.findByText(sampleCandidate.title)

      await userActions.click(screen.getByRole('button', { name: /retry/i }))
      await waitFor(() => expect(mockGenerateKata).toHaveBeenCalledTimes(2))
    })
  })

  // -------------------------------------------------------------------------
  // "Take existing katas into account" checkbox
  // -------------------------------------------------------------------------
  describe('"take existing katas into account" checkbox', () => {
    it('fetches existing kata titles and passes them to generateKata when checked', async () => {
      const { getUserConfig } = await import('@/lib/userConfig')
      vi.mocked(getUserConfig).mockResolvedValue(defaultConfig)
      mockKataRepoList.mockResolvedValue([
        { id: '1', title: 'Binary Search', languages: ['typescript'], tags: [], createdAt: '' },
      ])

      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('checkbox'))
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))

      await waitFor(() => {
        expect(mockGenerateKata).toHaveBeenCalledWith(
          expect.objectContaining({ existingKataTitles: ['Binary Search'] }),
        )
      })
    })
  })

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('shows the error message when generateKata throws', async () => {
      const { getUserConfig } = await import('@/lib/userConfig')
      vi.mocked(getUserConfig).mockResolvedValue(defaultConfig)
      mockGenerateKata.mockRejectedValue(new Error('Network failure'))

      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))

      expect(await screen.findByText('Network failure')).toBeInTheDocument()
    })

    it('shows the error message when KataRepo.upsert throws', async () => {
      const { getUserConfig } = await import('@/lib/userConfig')
      vi.mocked(getUserConfig).mockResolvedValue(defaultConfig)
      mockKataRepoUpsert.mockRejectedValue(new Error('Firestore write failed'))

      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))
      await screen.findByText(sampleCandidate.title)
      await userActions.click(screen.getByRole('button', { name: /accept & save/i }))

      expect(await screen.findByText('Firestore write failed')).toBeInTheDocument()
    })

    it('saves the kata without sandboxId when createSandbox throws', async () => {
      const { getUserConfig } = await import('@/lib/userConfig')
      vi.mocked(getUserConfig).mockResolvedValue(defaultConfig)
      mockCreateSandbox.mockRejectedValue(new Error('CodeSandbox API unavailable'))

      const { userActions } = renderDialog()
      await userActions.click(screen.getByRole('button', { name: /generate preview/i }))
      await screen.findByText(sampleCandidate.title)
      await userActions.click(screen.getByRole('button', { name: /accept & save/i }))

      await waitFor(() => {
        expect(mockKataRepoUpsert).toHaveBeenCalledWith(
          expect.objectContaining({ sandboxId: undefined }),
        )
      })
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/kata/test-kata-uuid'))
    })
  })
})
