import type { Kata, Language } from '@/types'
import { legacyDb, uuid } from './index'
import { KataRepo } from './firestore'

const VALID_LANGUAGES = new Set<Language>(['javascript', 'typescript', 'react'])

/**
 * Extracts a CodeSandbox sandbox ID from a URL.
 * Supports the /s/, /p/sandbox/, and /embed/ URL formats.
 * Returns null for any non-CodeSandbox URL or empty string.
 */
export function parseSandboxIdFromUrl(url: string): string | null {
  if (!url) return null
  const patterns = [
    /codesandbox\.io\/s\/([^/?#]+)/,
    /codesandbox\.io\/p\/sandbox\/([^/?#]+)/,
    /codesandbox\.io\/embed\/([^/?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * Maps a raw v1 Dexie Kata record to the v2 Kata shape.
 *
 * Handles:
 * - Missing or undefined fields (safe defaults)
 * - Invalid languages (filtered to the bounded Language union; defaults to ['typescript'])
 * - CodeSandbox URL → sandboxId extraction from the v1 `link` field
 * - Drops all v1-only fields (status, updatedAt, link, etc.)
 */
export function mapLegacyKata(legacy: Record<string, unknown>): Kata {
  const validLangs = ((legacy.languages as string[] | undefined) ?? []).filter((l: string) =>
    VALID_LANGUAGES.has(l as Language),
  ) as Language[]

  return {
    id: (legacy.id as string) ?? uuid(),
    title: (legacy.title as string) ?? 'Untitled',
    languages: validLangs.length > 0 ? validLangs : ['typescript'],
    tags: ((legacy.tags as string[]) ?? []).map((t: string) => t.toLowerCase()),
    sandboxId: legacy.link ? (parseSandboxIdFromUrl(legacy.link as string) ?? undefined) : undefined,
    notes: legacy.notes as string | undefined,
    createdAt: (legacy.createdAt as string) ?? new Date().toISOString(),
  }
}

/**
 * Runs a one-time migration from the legacy Dexie database to Firestore.
 *
 * Migration only proceeds when:
 * 1. The local Dexie `katas` table has records (there is data to migrate)
 * 2. The user's Firestore collection is empty (prevents overwriting existing v2 data)
 *
 * After a successful migration all local Dexie records are cleared.
 *
 * @returns `true` if migration ran, `false` if it was skipped.
 */
export async function runMigrationIfNeeded(): Promise<boolean> {
  const legacyKatas = await legacyDb.katas.toArray()
  if (legacyKatas.length === 0) return false

  const existingKatas = await KataRepo.list()
  if (existingKatas.length > 0) return false

  const mapped = (legacyKatas as unknown as Record<string, unknown>[]).map(mapLegacyKata)
  await Promise.all(mapped.map((k) => KataRepo.upsert(k)))
  await legacyDb.katas.clear()
  return true
}
