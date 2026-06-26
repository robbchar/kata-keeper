import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KataRepo } from './firestore'
import type { Kata } from '@/types'

// Mock firebase module
vi.mock('@/lib/firebase', () => ({
  firebase: vi.fn(() => ({
    auth: { currentUser: { uid: 'user-1' } },
    db: {},
  })),
}))

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
}))

const mockKata: Kata = {
  id: 'kata-1',
  title: 'Test kata',
  languages: ['typescript'],
  tags: ['async'],
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('KataRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('list sorts by sandboxUpdatedAt descending, falling back to createdAt', async () => {
    const { getDocs } = await import('firebase/firestore')
    const older: Kata = { ...mockKata, id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }
    const newer: Kata = { ...mockKata, id: 'new', createdAt: '2026-06-01T00:00:00.000Z' }
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        { data: () => older },
        { data: () => newer },
      ],
    } as any)

    const result = await KataRepo.list()
    expect(result[0].id).toBe('new')
    expect(result[1].id).toBe('old')
  })

  it('throws when not authenticated', async () => {
    const { firebase } = await import('@/lib/firebase')
    vi.mocked(firebase).mockReturnValueOnce({ auth: { currentUser: null }, db: {} } as any)

    await expect(KataRepo.list()).rejects.toThrow('Not authenticated')
  })
})
