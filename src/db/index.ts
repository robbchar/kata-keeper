import Dexie, { type Table } from 'dexie'
import type { Kata, Id, Language } from '../types'

// ---------------------------------------------------------------------------
// Legacy Dexie database — kept only for the one-time migration in Task 4.
// Do not use this directly in application code; use KataRepo instead.
// ---------------------------------------------------------------------------
class KataDB extends Dexie {
  katas!: Table<Kata, Id>
  constructor() {
    super('kata-keeper')
    this.version(1).stores({
      // primary key id; indexes for common queries
      katas: 'id, title, *languages, *tags, createdAt',
    })
  }
}
export const legacyDb = new KataDB()

// ---------------------------------------------------------------------------
// Active repo — Firestore-backed
// ---------------------------------------------------------------------------
export { KataRepo } from './firestore'

export const LANGUAGES: Language[] = ['javascript', 'typescript', 'react']

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function classNames(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function formatRelative(iso?: string) {
  if (!iso) return '—'
  const dt = new Date(iso)
  const diff = Date.now() - dt.getTime()
  const sec = Math.round(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  if (d < 30) return `${d}d ago`
  return dt.toLocaleDateString()
}

export async function tryEnablePersistentStorage(): Promise<boolean> {
  // Ask the browser not to evict our data under storage pressure
  const persisted = await (navigator.storage as any)?.persisted?.()
  if (persisted) return true
  return (await (navigator.storage as any)?.persist?.()) ?? false
}
