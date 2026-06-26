import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { firebase } from '@/lib/firebase'
import type { Kata, Id } from '@/types'

/** Firestore namespace — all user data lives under this top-level document */
const NS = 'kata-keeper'

/**
 * Resolves the authenticated user's UID and the Firestore instance in a
 * single `firebase()` call. Throws `'Not authenticated'` if no user is
 * signed in. Keeping this to one call also makes mocking in tests reliable.
 */
function getContext() {
  const { auth, db } = firebase()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  return { db, uid }
}

export const KataRepo = {
  /**
   * Fetches all katas for the current user, sorted descending by
   * `sandboxUpdatedAt` when present, falling back to `createdAt`.
   * Sorting is done client-side because Firestore cannot coalesce fields.
   */
  async list(): Promise<Kata[]> {
    const { db, uid } = getContext()
    const col = collection(db, NS, 'users', uid, 'katas')
    const snap = await getDocs(col)
    return snap.docs
      .map((d) => d.data() as Kata)
      .sort((a, b) => {
        const timestampA = a.sandboxUpdatedAt ?? a.createdAt
        const timestampB = b.sandboxUpdatedAt ?? b.createdAt
        return timestampB.localeCompare(timestampA)
      })
  },

  /** Returns a single kata by ID, or `undefined` if it does not exist */
  async get(id: Id): Promise<Kata | undefined> {
    const { db, uid } = getContext()
    const snap = await getDoc(doc(db, NS, 'users', uid, 'katas', id))
    return snap.exists() ? (snap.data() as Kata) : undefined
  },

  /** Creates or fully overwrites a kata document */
  async upsert(kata: Kata): Promise<void> {
    const { db, uid } = getContext()
    await setDoc(doc(db, NS, 'users', uid, 'katas', kata.id), kata)
  },

  /** Applies a partial update to an existing kata document */
  async update(id: Id, patch: Partial<Kata>): Promise<void> {
    const { db, uid } = getContext()
    await updateDoc(doc(db, NS, 'users', uid, 'katas', id), patch)
  },

  /** Deletes a kata document by ID */
  async remove(id: Id): Promise<void> {
    const { db, uid } = getContext()
    await deleteDoc(doc(db, NS, 'users', uid, 'katas', id))
  },
}
