# Kata Keeper v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Kata Keeper to a Firestore-backed, CodeSandbox-integrated v2 with client-side AI generation, a config screen, and a kata detail page with an embedded sandbox iframe.

**Architecture:** Incremental layering on the existing codebase — data layer swaps from Dexie (IndexedDB) to Firestore while the `KataRepo` public interface stays unchanged. New features (config screen, kata detail route, AI provider abstraction) are added as isolated modules. The existing Cloud Function (`previewKata`) is retired entirely in favour of direct browser-to-AI-API calls using the user's own key.

**Tech stack:** React 19, TypeScript 5.8, Tailwind v4, React Router v7, Firebase 12 (Auth + Firestore), Vitest, Testing Library, OpenAI SDK, Anthropic SDK.

**Spec:** `.ignored/superpowers/specs/2026-06-25-kata-keeper-v2-design.md`

## Global Constraints

- Firebase project: `robbchar-3db11` — multi-app. All Firestore paths must be under `/kata-keeper/` namespace. Never write Firestore rules to this repo — they go in `~/Projects/firebase-robbchar-config`.
- Package manager: `yarn` (v4.9.4). Use `yarn add` / `yarn add -D`.
- Test runner: `yarn vitest --run` (never `--watch`). Test files live alongside source: `Foo.test.ts` next to `Foo.ts`.
- No `any`. Use `unknown` when the type is uncertain.
- No comments unless the WHY is non-obvious.
- Tailwind v4 utility classes only — no custom CSS files except `src/index.css`.
- US English spelling throughout.

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `src/types/config.ts` | `UserConfig` type |
| `src/db/firestore.ts` | `KataRepo` backed by Firestore |
| `src/db/migration.ts` | One-time Dexie → Firestore migration |
| `src/lib/userConfig.ts` | Read/write user config doc in Firestore |
| `src/lib/ai/types.ts` | `AiProvider` interface, shared AI types |
| `src/lib/ai/prompt.ts` | Prompt builder (pure, testable) |
| `src/lib/ai/openai.ts` | OpenAI provider implementation |
| `src/lib/ai/anthropic.ts` | Anthropic provider implementation |
| `src/lib/ai/index.ts` | `createAiProvider` factory |
| `src/lib/codesandbox.ts` | CS API client + URL utilities |
| `src/pages/KataListPage.tsx` | List page (replaces `KataKeeperApp.tsx`) |
| `src/pages/KataDetailPage.tsx` | Kata detail with iframe + notes |
| `src/pages/ConfigPage.tsx` | Config screen |
| `src/components/TagInput.tsx` | Chip autocomplete for tags |
| `src/test/setup.ts` | Vitest global test setup |
| `vitest.config.ts` | Vitest config |

### Modified files
| Path | Change |
|---|---|
| `src/types/index.ts` | v2 `Kata` schema + bounded `Language` |
| `src/db/index.ts` | Re-export from `firestore.ts`; keep utility fns |
| `src/lib/firebase.ts` | Remove `Functions` init |
| `src/App.tsx` | Add `/kata/:id` and `/config` routes |
| `src/components/NewKataDialog.tsx` | Client-side AI, trimmed preview, CS sandbox creation |
| `src/components/KataForm.tsx` | v2 schema (no status/difficulty/link) |
| `firebase.json` | Strip `functions` + `firestore` sections |
| `package.json` | Add vitest, testing-library, openai, @anthropic-ai/sdk |
| `.gitignore` | Add `coverage/` |

### Deleted files
| Path | Reason |
|---|---|
| `firebase-setup/` | `previewKata` Cloud Function is retired |
| `firestore.rules` | Rules belong in `firebase-robbchar-config` |
| `src/data/saveAiPreviewLocal.ts` | Superseded by Firestore flow |
| `src/lib/mapPreviewToKata.ts` | Superseded by new AI types |
| `src/data/index.ts` | Empty file |
| `src/data/seed.ts` | Seed data no longer used |
| `src/pages/KataKeeperApp.tsx` | Replaced by `KataListPage.tsx` |

---

## Task 1: Test infrastructure + Firebase cleanup

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `firebase.json`
- Modify: `src/lib/firebase.ts`
- Delete: `firebase-setup/`, `firestore.rules`, `src/data/saveAiPreviewLocal.ts`, `src/lib/mapPreviewToKata.ts`, `src/data/index.ts`, `src/data/seed.ts`

**Interfaces:**
- Produces: `yarn test` command that runs vitest; clean repo with no dead Firebase infra

- [ ] **Step 1: Install test dependencies**

```bash
yarn add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Expected: packages appear in `package.json` devDependencies, no errors.

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 3: Create test setup file**

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add test script + coverage to .gitignore**

In `package.json`, add to `scripts`:
```json
"test": "vitest --run",
"test:ui": "vitest --ui"
```

In `.gitignore`, add:
```
coverage/
```

- [ ] **Step 5: Write a smoke test to verify the setup works**

Create `src/test/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('test setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run tests to verify setup**

```bash
yarn test
```

Expected output: `✓ src/test/smoke.test.ts > test setup > runs`

- [ ] **Step 7: Strip Firebase cleanup from firebase.json**

Replace the full contents of `firebase.json` with hosting-only config:

```json
{
  "hosting": [
    {
      "target": "kata-keeper-app",
      "public": "dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    }
  ]
}
```

- [ ] **Step 8: Remove Functions init from firebase.ts**

In `src/lib/firebase.ts`, remove everything related to `getFunctions` / `connectFunctionsEmulator` / `_functions` / `Functions`. The final file should only export `{ auth, db }`:

```ts
import { initializeApp, getApp, getApps } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  type Auth,
} from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { setupAuthDebug } from '../debug/authDebug'

const USE_EMU =
  import.meta.env.DEV && String(import.meta.env.VITE_USE_EMULATORS).toLowerCase() === 'true'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY!,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID!,
}

let _auth: Auth | null = null
let _db: Firestore | null = null

export function firebase() {
  if (_auth && _db) return { auth: _auth, db: _db }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  _auth = getAuth(app)
  _db = getFirestore(app)

  if (USE_EMU) {
    connectAuthEmulator(_auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(_db, '127.0.0.1', 8080)
  }

  setPersistence(_auth, browserLocalPersistence).catch((e) => {
    console.warn('[auth] setPersistence failed', e)
  })

  setupAuthDebug(_auth)
  return { auth: _auth, db: _db }
}
```

- [ ] **Step 9: Delete dead files**

```bash
rm -rf firebase-setup/
rm firestore.rules
rm src/data/saveAiPreviewLocal.ts
rm src/lib/mapPreviewToKata.ts
rm src/data/index.ts
rm src/data/seed.ts
```

- [ ] **Step 10: Verify the build still passes**

```bash
yarn build
```

Expected: build succeeds (ignore any TS errors from files we haven't updated yet — fix only import errors from deleted files).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: add vitest, strip dead Firebase infra"
```

---

## Task 2: v2 type definitions

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/types/config.ts`
- Test: `src/types/types.test.ts`

**Interfaces:**
- Produces:
  - `Kata` — v2 schema
  - `Language` — `'javascript' | 'typescript' | 'react'`
  - `UserConfig` — AI provider config + CS token + tags

- [ ] **Step 1: Write the type tests first**

Create `src/types/types.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest'
import type { Kata, Language } from './index'
import type { UserConfig } from './config'

describe('Kata type', () => {
  it('has required fields', () => {
    const k: Kata = {
      id: 'abc',
      title: 'Test',
      languages: ['typescript'],
      tags: [],
      createdAt: new Date().toISOString(),
    }
    expectTypeOf(k).toMatchTypeOf<Kata>()
  })

  it('accepts optional sandbox fields', () => {
    const k: Kata = {
      id: 'abc',
      title: 'Test',
      languages: ['react'],
      tags: ['hooks'],
      sandboxId: 'xyz123',
      sandboxUpdatedAt: new Date().toISOString(),
      notes: 'some notes',
      createdAt: new Date().toISOString(),
    }
    expectTypeOf(k).toMatchTypeOf<Kata>()
  })
})

describe('Language type', () => {
  it('only allows bounded values', () => {
    const langs: Language[] = ['javascript', 'typescript', 'react']
    expectTypeOf(langs).toMatchTypeOf<Language[]>()
  })
})

describe('UserConfig type', () => {
  it('has required fields', () => {
    const config: UserConfig = {
      aiProvider: 'openai',
      aiApiKey: 'sk-...',
      csToken: '',
      csGitHubConnected: false,
      tags: ['hooks', 'async'],
    }
    expectTypeOf(config).toMatchTypeOf<UserConfig>()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
yarn test src/types/types.test.ts
```

Expected: type errors or import failures (types don't match v2 yet).

- [ ] **Step 3: Replace src/types/index.ts with v2 schema**

```ts
export type Id = string

export type Language = 'javascript' | 'typescript' | 'react'

export interface Kata {
  id: Id
  title: string
  languages: Language[]
  tags: string[]
  sandboxId?: string
  sandboxUpdatedAt?: string
  notes?: string
  createdAt: string
}
```

- [ ] **Step 4: Create src/types/config.ts**

```ts
export interface UserConfig {
  aiProvider: 'openai' | 'anthropic'
  aiApiKey: string
  csToken: string
  csGitHubConnected: boolean
  tags: string[]
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
yarn test src/types/types.test.ts
```

Expected: all pass.

- [ ] **Step 6: Fix cascading type errors from the schema change**

Run `yarn build` to surface type errors. For each error, either fix it or add `// TODO(v2)` if it's in a component being rewritten in a later task. The important ones to fix now are in `src/db/index.ts` — remove `Status`, `Difficulty`, `STATUSES`, `DIFFICULTIES` exports and the Dexie schema indexes for those fields. The Dexie table definition can stay temporarily but remove the dead constants.

In `src/db/index.ts`, remove:
- `export type { Status, Difficulty }` (these are gone from types)
- `export const STATUSES` and `export const DIFFICULTIES`
- Update the Dexie schema string to remove `status`, `difficulty`, `lastWorkedAt` indexes (leave the table definition for now — migration task will clear it)

- [ ] **Step 7: Commit**

```bash
git add src/types/ src/db/index.ts
git commit -m "feat: v2 type definitions — Kata schema, Language, UserConfig"
```

---

## Task 3: Firestore KataRepo

**Files:**
- Create: `src/db/firestore.ts`
- Modify: `src/db/index.ts`
- Test: `src/db/firestore.test.ts`

**Interfaces:**
- Consumes: `firebase()` from `src/lib/firebase.ts`, `Kata`, `Id` from `src/types/index.ts`
- Produces: `KataRepo` object with `list(uid?)`, `get(id)`, `upsert(k)`, `update(id, patch)`, `remove(id)` — uid sourced internally from `auth.currentUser` when not provided

- [ ] **Step 1: Write the tests first**

Create `src/db/firestore.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
yarn test src/db/firestore.test.ts
```

Expected: FAIL — `KataRepo` not defined yet.

- [ ] **Step 3: Create src/db/firestore.ts**

```ts
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

const NS = 'kata-keeper'

function uid(): string {
  const u = firebase().auth.currentUser?.uid
  if (!u) throw new Error('Not authenticated')
  return u
}

function katasCol() {
  return collection(firebase().db, NS, 'users', uid(), 'katas')
}

function kataDoc(id: string) {
  return doc(firebase().db, NS, 'users', uid(), 'katas', id)
}

export const KataRepo = {
  async list(): Promise<Kata[]> {
    const snap = await getDocs(katasCol())
    return snap.docs
      .map((d) => d.data() as Kata)
      .sort((a, b) => {
        const ta = a.sandboxUpdatedAt ?? a.createdAt
        const tb = b.sandboxUpdatedAt ?? b.createdAt
        return tb.localeCompare(ta)
      })
  },

  async get(id: Id): Promise<Kata | undefined> {
    const snap = await getDoc(kataDoc(id))
    return snap.exists() ? (snap.data() as Kata) : undefined
  },

  async upsert(k: Kata): Promise<void> {
    await setDoc(kataDoc(k.id), k)
  },

  async update(id: Id, patch: Partial<Kata>): Promise<void> {
    await updateDoc(kataDoc(id), patch)
  },

  async remove(id: Id): Promise<void> {
    await deleteDoc(kataDoc(id))
  },
}
```

- [ ] **Step 4: Update src/db/index.ts to export from firestore.ts**

Replace the `KataRepo` export and remove Dexie-specific imports/exports. Keep `uuid`, `nowISO`, `classNames`, `formatRelative`, `tryEnablePersistentStorage`. The file becomes:

```ts
import Dexie, { type Table } from 'dexie'
import type { Kata, Id } from '../types'

// Kept only for migration — see src/db/migration.ts
class KataDB extends Dexie {
  katas!: Table<Kata, Id>
  constructor() {
    super('kata-keeper')
    this.version(1).stores({
      katas: 'id, title, *languages, *tags, createdAt',
    })
  }
}
export const legacyDb = new KataDB()

// Active repo — Firestore-backed
export { KataRepo } from './firestore'

export const LANGUAGES = ['javascript', 'typescript', 'react'] as const

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
  const persisted = await (navigator.storage as any)?.persisted?.()
  if (persisted) return true
  return (await (navigator.storage as any)?.persist?.()) ?? false
}
```

- [ ] **Step 5: Run tests**

```bash
yarn test src/db/firestore.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/db/
git commit -m "feat: Firestore-backed KataRepo under kata-keeper namespace"
```

---

## Task 4: Dexie → Firestore migration

**Files:**
- Create: `src/db/migration.ts`
- Test: `src/db/migration.test.ts`

**Interfaces:**
- Consumes: `legacyDb` from `src/db/index.ts`, `KataRepo` from `src/db/firestore.ts`
- Produces: `runMigrationIfNeeded(uid: string): Promise<boolean>` — returns `true` if migration ran

- [ ] **Step 1: Write the mapping logic tests first**

Create `src/db/migration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapLegacyKata, parseSandboxIdFromUrl } from './migration'

describe('parseSandboxIdFromUrl', () => {
  it('parses /s/ URLs', () => {
    expect(parseSandboxIdFromUrl('https://codesandbox.io/s/abc123')).toBe('abc123')
  })

  it('parses /p/sandbox/ URLs', () => {
    expect(parseSandboxIdFromUrl('https://codesandbox.io/p/sandbox/my-sandbox-xyz')).toBe('my-sandbox-xyz')
  })

  it('returns null for non-CS URLs', () => {
    expect(parseSandboxIdFromUrl('https://github.com/user/repo')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseSandboxIdFromUrl('')).toBeNull()
  })
})

describe('mapLegacyKata', () => {
  const base = {
    id: 'kata-1',
    title: 'Build a hook',
    languages: ['typescript' as const],
    tags: ['hooks'],
    status: 'backlog' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  }

  it('maps title, languages, tags, notes, createdAt', () => {
    const result = mapLegacyKata({ ...base, notes: 'my notes' })
    expect(result.title).toBe('Build a hook')
    expect(result.languages).toEqual(['typescript'])
    expect(result.tags).toEqual(['hooks'])
    expect(result.notes).toBe('my notes')
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('parses sandboxId from a CodeSandbox link', () => {
    const result = mapLegacyKata({ ...base, link: 'https://codesandbox.io/s/abc123' })
    expect(result.sandboxId).toBe('abc123')
  })

  it('drops non-CS links', () => {
    const result = mapLegacyKata({ ...base, link: 'https://github.com/foo/bar' })
    expect(result.sandboxId).toBeUndefined()
  })

  it('filters languages to the bounded set', () => {
    const result = mapLegacyKata({ ...base, languages: ['python' as any, 'typescript'] })
    expect(result.languages).toEqual(['typescript'])
  })

  it('defaults to typescript when no valid language survives', () => {
    const result = mapLegacyKata({ ...base, languages: ['python' as any] })
    expect(result.languages).toEqual(['typescript'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
yarn test src/db/migration.test.ts
```

Expected: FAIL — functions not defined yet.

- [ ] **Step 3: Create src/db/migration.ts**

```ts
import type { Kata, Language } from '@/types'
import { legacyDb, uuid } from './index'
import { KataRepo } from './firestore'

const VALID_LANGUAGES = new Set<Language>(['javascript', 'typescript', 'react'])

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

export function mapLegacyKata(legacy: Record<string, any>): Kata {
  const validLangs = (legacy.languages ?? []).filter((l: string) =>
    VALID_LANGUAGES.has(l as Language),
  ) as Language[]

  return {
    id: legacy.id ?? uuid(),
    title: legacy.title ?? 'Untitled',
    languages: validLangs.length > 0 ? validLangs : ['typescript'],
    tags: (legacy.tags ?? []).map((t: string) => t.toLowerCase()),
    sandboxId: legacy.link ? (parseSandboxIdFromUrl(legacy.link) ?? undefined) : undefined,
    notes: legacy.notes || undefined,
    createdAt: legacy.createdAt ?? new Date().toISOString(),
  }
}

export async function runMigrationIfNeeded(): Promise<boolean> {
  const legacyKatas = await legacyDb.katas.toArray()
  if (legacyKatas.length === 0) return false

  const existingKatas = await KataRepo.list()
  if (existingKatas.length > 0) return false

  const mapped = legacyKatas.map(mapLegacyKata)
  await Promise.all(mapped.map((k) => KataRepo.upsert(k)))
  await legacyDb.katas.clear()
  return true
}
```

- [ ] **Step 4: Run tests**

```bash
yarn test src/db/migration.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/db/migration.ts src/db/migration.test.ts
git commit -m "feat: Dexie-to-Firestore migration with v1→v2 mapping"
```

---

## Task 5: Routing + nav skeleton

**Files:**
- Create: `src/pages/KataListPage.tsx` (copy of `KataKeeperApp.tsx` initially)
- Create: `src/pages/KataDetailPage.tsx` (stub)
- Create: `src/pages/ConfigPage.tsx` (stub)
- Modify: `src/App.tsx`
- Delete: `src/pages/KataKeeperApp.tsx`

**Interfaces:**
- Produces: working routes at `/`, `/kata/:id`, `/config`; nav links to Config and back

- [ ] **Step 1: Copy KataKeeperApp to KataListPage**

```bash
cp src/pages/KataKeeperApp.tsx src/pages/KataListPage.tsx
```

In `src/pages/KataListPage.tsx`, rename the default export from `KataKeeperApp` to `KataListPage`.

- [ ] **Step 2: Create ConfigPage stub**

Create `src/pages/ConfigPage.tsx`:

```tsx
export default function ConfigPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <p className="text-slate-500">Config coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 3: Create KataDetailPage stub**

Create `src/pages/KataDetailPage.tsx`:

```tsx
import { useParams, Link } from 'react-router-dom'

export default function KataDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/" className="text-sm text-indigo-600 hover:underline">← Back</Link>
      <p className="mt-4 text-slate-500">Kata detail for {id} — coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 4: Update App.tsx with new routes**

Replace the contents of `src/App.tsx`:

```tsx
import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from '@/pages/Login'
import SignUp from '@/pages/SignUp'
import KataListPage from '@/pages/KataListPage'
import KataDetailPage from '@/pages/KataDetailPage'
import ConfigPage from '@/pages/ConfigPage'
import { RedirectIfAuthed, RequireAuth } from './auth/guards'
import Logout from './components/Logout'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/logout" element={<Logout />} />
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<KataListPage />} />
          <Route path="/kata/:id" element={<KataDetailPage />} />
          <Route path="/config" element={<ConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 5: Add Config nav link to the list page header**

In `src/pages/KataListPage.tsx`, import `Link` from `react-router-dom` and add a Settings link in the header next to the existing buttons:

```tsx
import { Link } from 'react-router-dom'
// In the header div:
<Link to="/config" className="px-3 py-2 border rounded text-sm">Settings</Link>
```

- [ ] **Step 6: Delete KataKeeperApp.tsx**

```bash
rm src/pages/KataKeeperApp.tsx
```

- [ ] **Step 7: Verify build**

```bash
yarn build
```

Expected: succeeds. Navigate to `/config` and `/kata/test` in the browser to confirm the stubs render.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add /config and /kata/:id routes, rename KataListPage"
```

---

## Task 6: List view v2 + KataForm cleanup

**Files:**
- Modify: `src/pages/KataListPage.tsx`
- Modify: `src/components/KataForm.tsx`
- Modify: `src/ui/constants.ts`

**Interfaces:**
- Produces: list with Tags column; no Status/Difficulty columns; timestamp uses `sandboxUpdatedAt ?? createdAt`; KataForm uses v2 schema; migration runs on first load

- [ ] **Step 1: Wire migration into KataListPage on first load**

In `src/pages/KataListPage.tsx`, update the load effect to run the migration before loading katas:

```tsx
import { runMigrationIfNeeded } from '@/db/migration'

useEffect(() => {
  (async () => {
    await tryEnablePersistentStorage().catch(() => {})
    await runMigrationIfNeeded().catch(console.warn)
    const list = await KataRepo.list()
    setKatas(list)
  })()
}, [])
```

- [ ] **Step 2: Remove Status and Difficulty from KataListPage state and filters**

In `src/pages/KataListPage.tsx`:
- Remove `statusFilter` state and its `<Select>` filter
- Remove `sortKey` options `'difficulty'` and `'lastWorkedAt'`
- Remove `stampWorked` function
- Remove `quickStatus` function
- Update the `filtered` useMemo to remove status filter and difficulty sort logic
- Update the sort `<select>` options to: Updated, Created, Title only
- Update `onImportAIKata` to use v2 fields only (remove `status`, `difficulty`, `description`, `requirements`, `link`, `lastWorkedAt`)

Updated `onImportAIKata`:
```tsx
const onImportAIKata = async (k: Omit<Kata, 'id'>) => {
  const now = nowISO()
  const item: Kata = {
    id: uuid(),
    title: k.title,
    languages: k.languages?.length ? k.languages : ['typescript'],
    tags: (k.tags ?? []).map((t) => t.toLowerCase()),
    sandboxId: k.sandboxId,
    sandboxUpdatedAt: k.sandboxUpdatedAt,
    notes: k.notes,
    createdAt: now,
  }
  await KataRepo.upsert(item)
  await reload()
  setGetFromAiOpen(false)
}
```

- [ ] **Step 3: Update the list table columns**

Replace the table header and rows in `KataListPage.tsx`. New columns: Title, Languages, Tags, Updated.

```tsx
<thead className="bg-slate-100/60 dark:bg-slate-800/60">
  <tr className="text-left">
    <th className="px-4 py-2">Title</th>
    <th className="px-4 py-2">Languages</th>
    <th className="px-4 py-2">Tags</th>
    <th className="px-4 py-2 hidden md:table-cell">Updated</th>
    <th className="px-4 py-2">Actions</th>
  </tr>
</thead>
```

In the row map, replace the old status/difficulty/link cells with:
```tsx
<td className="px-4 py-3 align-top">
  <div className="flex flex-wrap gap-1">
    {k.languages.map((l) => (
      <Pill key={l} className="border-slate-300 dark:border-slate-600">{l}</Pill>
    ))}
  </div>
</td>
<td className="px-4 py-3 align-top">
  <div className="flex flex-wrap gap-1">
    {k.tags.slice(0, 4).map((t) => (
      <Pill key={t} className="border-slate-300 dark:border-slate-600">{t}</Pill>
    ))}
    {k.tags.length > 4 && (
      <span className="text-xs text-slate-500">+{k.tags.length - 4}</span>
    )}
  </div>
</td>
<td className="px-4 py-3 hidden md:table-cell align-top">
  <div title={k.sandboxUpdatedAt ?? k.createdAt}>
    {formatRelative(k.sandboxUpdatedAt ?? k.createdAt)}
  </div>
</td>
```

Replace the Actions cell — remove Worked button, keep Edit and Delete. Make the title a `<Link>` to `/kata/:id` instead of opening the detail modal:
```tsx
<Link
  to={`/kata/${k.id}`}
  className="font-medium text-indigo-600 hover:underline"
>
  {k.title}
</Link>
```

Remove the `details` modal state and its overlay entirely (the route handles it now).

- [ ] **Step 4: Update the lang filter to use bounded languages**

Replace the language filter `<Select>` options to use `LANGUAGES` from `@/db` (now `['javascript', 'typescript', 'react']`).

- [ ] **Step 5: Update constants.ts**

Replace `src/ui/constants.ts`:

```ts
export const LANGS = ['javascript', 'typescript', 'react'] as const
export const DIFFS = ['easy', 'medium', 'hard'] as const
export const LENGTHS = ['Snack', 'Standard', 'DeepDive'] as const

export type Length = (typeof LENGTHS)[number]
```

- [ ] **Step 6: Rewrite KataForm for v2 schema**

Replace `src/components/KataForm.tsx`:

```tsx
import { useState } from 'react'
import { nowISO, uuid, LANGUAGES, classNames } from '../db'
import type { Kata, Language } from '../types'
import { Label } from './Label'
import { Input } from './Input'
import { Textarea } from './Textarea'
import { Button } from './Button'
import { IconButton } from './IconButton'

export function KataForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Partial<Kata>
  onCancel: () => void
  onSave: (k: Kata) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [languagesSel, setLanguagesSel] = useState<Language[]>(initial?.languages ?? [])
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '))
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const now = nowISO()
    const k: Kata = {
      id: (initial?.id as string) ?? uuid(),
      title: title.trim(),
      languages: languagesSel,
      tags: tagsText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      notes: notes.trim() || undefined,
      sandboxId: initial?.sandboxId,
      sandboxUpdatedAt: initial?.sandboxUpdatedAt,
      createdAt: (initial?.createdAt as string) ?? now,
    }
    onSave(k)
  }

  function toggleLanguage(lang: Language) {
    setLanguagesSel((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Accessible Async Autocomplete"
          required
        />
      </div>
      <div>
        <Label>Languages</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggleLanguage(l)}
              className={classNames(
                'rounded-full border px-3 py-1 text-xs',
                languagesSel.includes(l)
                  ? 'bg-indigo-300 border-indigo-400 text-indigo-700'
                  : 'border-slate-300 dark:border-slate-600',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="hooks, async, debounce"
        />
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add thoughts, learnings, links…"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <IconButton type="button" onClick={onCancel}>Cancel</IconButton>
        <Button type="submit">Save Kata</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 7: Verify build and test**

```bash
yarn build && yarn test
```

Expected: build succeeds, tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: list view v2 — remove status/difficulty, add tags column, wire migration"
```

---

## Task 7: UserConfig service

**Files:**
- Create: `src/lib/userConfig.ts`
- Test: `src/lib/userConfig.test.ts`

**Interfaces:**
- Consumes: `firebase()` from `src/lib/firebase.ts`, `UserConfig` from `src/types/config.ts`
- Produces:
  - `DEFAULT_TAGS: string[]`
  - `getUserConfig(uid: string): Promise<UserConfig>`
  - `updateUserConfig(uid: string, patch: Partial<UserConfig>): Promise<void>`

- [ ] **Step 1: Write the tests**

Create `src/lib/userConfig.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_TAGS, getUserConfig } from './userConfig'

vi.mock('@/lib/firebase', () => ({
  firebase: vi.fn(() => ({ db: {} })),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}))

describe('DEFAULT_TAGS', () => {
  it('includes the required starter tags', () => {
    expect(DEFAULT_TAGS).toContain('hooks')
    expect(DEFAULT_TAGS).toContain('async')
    expect(DEFAULT_TAGS).toContain('algorithms')
    expect(DEFAULT_TAGS.length).toBeGreaterThanOrEqual(12)
  })
})

describe('getUserConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seeds defaults when no config doc exists', async () => {
    const { getDoc, setDoc } = await import('firebase/firestore')
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as any)
    vi.mocked(setDoc).mockResolvedValueOnce(undefined)

    const config = await getUserConfig('user-1')
    expect(config.aiProvider).toBe('openai')
    expect(config.tags).toEqual(DEFAULT_TAGS)
    expect(setDoc).toHaveBeenCalledOnce()
  })

  it('returns existing config when doc exists', async () => {
    const { getDoc } = await import('firebase/firestore')
    const existing = {
      aiProvider: 'anthropic',
      aiApiKey: 'sk-ant-123',
      csToken: '',
      csGitHubConnected: false,
      tags: ['hooks'],
    }
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => existing,
    } as any)

    const config = await getUserConfig('user-1')
    expect(config.aiProvider).toBe('anthropic')
    expect(config.tags).toEqual(['hooks'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
yarn test src/lib/userConfig.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create src/lib/userConfig.ts**

```ts
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { firebase } from '@/lib/firebase'
import type { UserConfig } from '@/types/config'

export const DEFAULT_TAGS = [
  'hooks', 'async', 'state', 'forms', 'routing', 'testing',
  'performance', 'a11y', 'arrays', 'strings', 'algorithms', 'api',
]

function configDoc(uid: string) {
  return doc(firebase().db, 'kata-keeper', 'users', uid)
}

export async function getUserConfig(uid: string): Promise<UserConfig> {
  const snap = await getDoc(configDoc(uid))
  if (!snap.exists()) {
    const defaults: UserConfig = {
      aiProvider: 'openai',
      aiApiKey: '',
      csToken: '',
      csGitHubConnected: false,
      tags: DEFAULT_TAGS,
    }
    await setDoc(configDoc(uid), defaults)
    return defaults
  }
  return snap.data() as UserConfig
}

export async function updateUserConfig(uid: string, patch: Partial<UserConfig>): Promise<void> {
  await updateDoc(configDoc(uid), patch)
}
```

- [ ] **Step 4: Run tests**

```bash
yarn test src/lib/userConfig.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/userConfig.ts src/lib/userConfig.test.ts
git commit -m "feat: UserConfig service — read/write Firestore config doc"
```

---

## Task 8: Config screen

**Files:**
- Modify: `src/pages/ConfigPage.tsx`
- Create: `src/components/TagInput.tsx`
- Test: `src/components/TagInput.test.tsx`

**Interfaces:**
- Consumes: `getUserConfig`, `updateUserConfig` from `src/lib/userConfig.ts`; `useAuth` from `src/auth/AuthProvider.tsx`
- Produces: working Config page with AI provider, CS token, GitHub connect, and tag management

- [ ] **Step 1: Write TagInput tests**

Create `src/components/TagInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagInput } from './TagInput'

describe('TagInput', () => {
  it('renders existing tags as chips', () => {
    render(<TagInput tags={['hooks', 'async']} onChange={vi.fn()} />)
    expect(screen.getByText('hooks')).toBeInTheDocument()
    expect(screen.getByText('async')).toBeInTheDocument()
  })

  it('calls onChange with tag removed when × is clicked', () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks', 'async']} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
    expect(onChange).toHaveBeenCalledWith(['async'])
  })

  it('calls onChange with new tag added on Enter', () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    fireEvent.change(input, { target: { value: 'state' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['hooks', 'state'])
  })

  it('does not add duplicate tags', () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    fireEvent.change(input, { target: { value: 'hooks' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
yarn test src/components/TagInput.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create src/components/TagInput.tsx**

```tsx
import { useState } from 'react'
import { classNames } from '@/db'

export function TagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState('')

  function addTag() {
    const tag = input.trim().toLowerCase()
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-slate-600 px-3 py-0.5 text-xs"
          >
            {tag}
            <button
              type="button"
              aria-label={`remove ${tag}`}
              onClick={() => removeTag(tag)}
              className="ml-0.5 text-slate-400 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className={classNames(
          'w-full rounded-md border border-slate-300 dark:border-slate-700',
          'bg-white dark:bg-slate-800 px-3 py-1.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500',
        )}
        placeholder="Add tag… (Enter to add)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run TagInput tests**

```bash
yarn test src/components/TagInput.test.tsx
```

Expected: all pass.

- [ ] **Step 5: Build out ConfigPage**

Replace `src/pages/ConfigPage.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { getUserConfig, updateUserConfig } from '@/lib/userConfig'
import { TagInput } from '@/components/TagInput'
import type { UserConfig } from '@/types/config'
import { Link } from 'react-router-dom'

export default function ConfigPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<UserConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getUserConfig(user.uid).then(setConfig)
  }, [user])

  async function save(patch: Partial<UserConfig>) {
    if (!user || !config) return
    setSaving(true)
    const updated = { ...config, ...patch }
    setConfig(updated)
    await updateUserConfig(user.uid, patch)
    setSaving(false)
  }

  async function testConnection() {
    if (!config?.aiApiKey) return
    setTestResult('Testing…')
    try {
      if (config.aiProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${config.aiApiKey}` },
        })
        setTestResult(res.ok ? '✓ Connected' : `✗ Error ${res.status}`)
      } else {
        // Anthropic: list models endpoint
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': config.aiApiKey,
            'anthropic-version': '2023-06-01',
          },
        })
        setTestResult(res.ok ? '✓ Connected' : `✗ Error ${res.status}`)
      }
    } catch {
      setTestResult('✗ Network error')
    }
  }

  if (!config) {
    return <div className="mx-auto max-w-2xl px-4 py-8 text-slate-500">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-4">
          <Link to="/" className="text-sm text-indigo-600 hover:underline">← Back</Link>
          <h1 className="text-xl font-semibold">Settings</h1>
          {saving && <span className="text-xs text-slate-400">Saving…</span>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-10">

        {/* AI Provider */}
        <section>
          <h2 className="text-lg font-semibold mb-4">AI Provider</h2>
          <div className="space-y-4">
            <label className="block text-sm">
              Provider
              <select
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                value={config.aiProvider}
                onChange={(e) => save({ aiProvider: e.target.value as 'openai' | 'anthropic' })}
              >
                <option value="openai">OpenAI (gpt-4o-mini)</option>
                <option value="anthropic">Anthropic (claude-sonnet-4-6)</option>
              </select>
            </label>
            <label className="block text-sm">
              API Key
              <input
                type="password"
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                value={config.aiApiKey}
                onChange={(e) => save({ aiApiKey: e.target.value })}
                placeholder={config.aiProvider === 'openai' ? 'sk-…' : 'sk-ant-…'}
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={testConnection}
                className="px-3 py-1.5 rounded border text-sm"
              >
                Test connection
              </button>
              {testResult && <span className="text-sm">{testResult}</span>}
            </div>
          </div>
        </section>

        {/* CodeSandbox */}
        <section>
          <h2 className="text-lg font-semibold mb-4">CodeSandbox</h2>
          <div className="space-y-4">
            <label className="block text-sm">
              API Token
              <input
                type="password"
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                value={config.csToken}
                onChange={(e) => save({ csToken: e.target.value })}
                placeholder="Your CodeSandbox API token"
              />
            </label>
            <p className="text-xs text-slate-500">
              {config.csGitHubConnected
                ? '✓ GitHub connected'
                : 'GitHub not connected — connect to enable sandbox creation.'}
            </p>
            {/* GitHub OAuth wired in Task 12 */}
          </div>
        </section>

        {/* Tags */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Tags</h2>
          <TagInput
            tags={config.tags}
            onChange={(tags) => save({ tags })}
          />
        </section>

      </main>
    </div>
  )
}
```

- [ ] **Step 6: Verify build**

```bash
yarn build
```

Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Config screen — AI provider, CS token, tag management"
```

---

## Task 9: AI provider abstraction

**Files:**
- Create: `src/lib/ai/types.ts`
- Create: `src/lib/ai/prompt.ts`
- Create: `src/lib/ai/openai.ts`
- Create: `src/lib/ai/anthropic.ts`
- Create: `src/lib/ai/index.ts`
- Test: `src/lib/ai/prompt.test.ts`

**Interfaces:**
- Produces:
  - `createAiProvider(config) => AiProvider`
  - `AiProvider.generateKata(params) => Promise<{ candidate: AiKataCandidate; cost: CostEstimate }>`
  - `estimateMinutes(length: string) => number`

- [ ] **Step 1: Install AI SDK dependencies**

```bash
yarn add openai @anthropic-ai/sdk
```

- [ ] **Step 2: Write prompt builder tests**

Create `src/lib/ai/prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildUserPrompt, estimateMinutes } from './prompt'
import type { GenerateKataParams } from './types'

const base: GenerateKataParams = {
  language: 'typescript',
  difficulty: 'medium',
  length: 'Standard',
}

describe('buildUserPrompt', () => {
  it('includes language and difficulty', () => {
    const prompt = buildUserPrompt(base)
    expect(prompt).toContain('TypeScript')
    expect(prompt).toContain('Intermediate')
  })

  it('includes influence when provided', () => {
    const prompt = buildUserPrompt({ ...base, influence: 'memoization' })
    expect(prompt).toContain('memoization')
  })

  it('includes existing kata titles when provided', () => {
    const prompt = buildUserPrompt({
      ...base,
      existingKataTitles: ['Build a debounce', 'Implement BFS'],
    })
    expect(prompt).toContain('Build a debounce')
    expect(prompt).toContain('Implement BFS')
  })

  it('omits existing katas line when array is empty', () => {
    const prompt = buildUserPrompt({ ...base, existingKataTitles: [] })
    expect(prompt).not.toContain('Avoid')
  })
})

describe('estimateMinutes', () => {
  it('returns 15 for Snack', () => expect(estimateMinutes('Snack')).toBe(15))
  it('returns 35 for Standard', () => expect(estimateMinutes('Standard')).toBe(35))
  it('returns 75 for DeepDive', () => expect(estimateMinutes('DeepDive')).toBe(75))
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
yarn test src/lib/ai/prompt.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Create src/lib/ai/types.ts**

```ts
import type { Language } from '@/types'

export type AiKataCandidate = {
  title: string
  summary: string
  steps: string[]
  starterCode: string
}

export type GenerateKataParams = {
  influence?: string
  language: Language
  difficulty: 'easy' | 'medium' | 'hard'
  length: 'Snack' | 'Standard' | 'DeepDive'
  existingKataTitles?: string[]
}

export type CostEstimate = {
  inputTokens: number
  outputTokens: number
  totalUSD: number
}

export interface AiProvider {
  generateKata(params: GenerateKataParams): Promise<{ candidate: AiKataCandidate; cost: CostEstimate }>
}
```

- [ ] **Step 5: Create src/lib/ai/prompt.ts**

```ts
import type { GenerateKataParams } from './types'

const LENGTH_MINUTES: Record<string, number> = {
  Snack: 15,
  Standard: 35,
  DeepDive: 75,
}

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  react: 'React (TSX)',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Beginner',
  medium: 'Intermediate',
  hard: 'Advanced',
}

export function buildSystemPrompt(): string {
  return 'You generate concise, runnable coding katas. Keep code minimal; avoid heavy dependencies. Title must be 8 words or fewer.'
}

export function buildUserPrompt(params: GenerateKataParams): string {
  const { influence, language, difficulty, length, existingKataTitles } = params
  const estMinutes = LENGTH_MINUTES[length] ?? 35
  const langLabel = LANGUAGE_LABELS[language] ?? language
  const diffLabel = DIFFICULTY_LABELS[difficulty] ?? difficulty

  return [
    influence ? `Influence/focus: ${influence}` : '',
    `Language: ${langLabel}`,
    `Difficulty: ${diffLabel}, target time: ${estMinutes} min`,
    existingKataTitles?.length
      ? `Avoid topics already covered: ${existingKataTitles.join(', ')}`
      : '',
    `Return ONLY valid JSON with these fields: title (string, ≤8 words), summary (string, one sentence), steps (array of 3–6 requirement strings), starterCode (string in ${langLabel}).`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function estimateMinutes(length: string): number {
  return LENGTH_MINUTES[length] ?? 35
}
```

- [ ] **Step 6: Run prompt tests**

```bash
yarn test src/lib/ai/prompt.test.ts
```

Expected: all pass.

- [ ] **Step 7: Create src/lib/ai/openai.ts**

```ts
import OpenAI from 'openai'
import type { AiProvider, AiKataCandidate, GenerateKataParams, CostEstimate } from './types'
import { buildSystemPrompt, buildUserPrompt } from './prompt'

// gpt-4o-mini pricing — verify at https://openai.com/api/pricing if stale
const PRICE_IN = 0.6 / 1_000_000
const PRICE_OUT = 2.4 / 1_000_000

const JSON_SCHEMA = {
  name: 'kata',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      steps: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
      starterCode: { type: 'string' },
    },
    required: ['title', 'summary', 'steps', 'starterCode'],
  },
} as const

export class OpenAIProvider implements AiProvider {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
  }

  async generateKata(
    params: GenerateKataParams,
  ): Promise<{ candidate: AiKataCandidate; cost: CostEstimate }> {
    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(params) },
      ],
      temperature: 0.5,
      max_tokens: 1000,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const candidate = JSON.parse(raw) as AiKataCandidate
    const inTokens = completion.usage?.prompt_tokens ?? 0
    const outTokens = completion.usage?.completion_tokens ?? 0

    return {
      candidate,
      cost: {
        inputTokens: inTokens,
        outputTokens: outTokens,
        totalUSD: inTokens * PRICE_IN + outTokens * PRICE_OUT,
      },
    }
  }
}
```

- [ ] **Step 8: Create src/lib/ai/anthropic.ts**

```ts
import Anthropic from '@anthropic-ai/sdk'
import type { AiProvider, AiKataCandidate, GenerateKataParams, CostEstimate } from './types'
import { buildSystemPrompt, buildUserPrompt } from './prompt'

// claude-sonnet-4-6 pricing — verify at https://www.anthropic.com/api if stale
const PRICE_IN = 3.0 / 1_000_000
const PRICE_OUT = 15.0 / 1_000_000

export class AnthropicProvider implements AiProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  }

  async generateKata(
    params: GenerateKataParams,
  ): Promise<{ candidate: AiKataCandidate; cost: CostEstimate }> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt() + ' Return ONLY valid JSON — no markdown fencing.',
      messages: [{ role: 'user', content: buildUserPrompt(params) }],
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const candidate = JSON.parse(raw) as AiKataCandidate
    const inTokens = response.usage.input_tokens
    const outTokens = response.usage.output_tokens

    return {
      candidate,
      cost: {
        inputTokens: inTokens,
        outputTokens: outTokens,
        totalUSD: inTokens * PRICE_IN + outTokens * PRICE_OUT,
      },
    }
  }
}
```

- [ ] **Step 9: Create src/lib/ai/index.ts**

```ts
import type { UserConfig } from '@/types/config'
import type { AiProvider } from './types'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'

export { type AiProvider } from './types'
export { type AiKataCandidate, type GenerateKataParams, type CostEstimate } from './types'
export { estimateMinutes } from './prompt'

export function createAiProvider(config: Pick<UserConfig, 'aiProvider' | 'aiApiKey'>): AiProvider {
  if (config.aiProvider === 'anthropic') return new AnthropicProvider(config.aiApiKey)
  return new OpenAIProvider(config.aiApiKey)
}
```

- [ ] **Step 10: Run all tests**

```bash
yarn test
```

Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add src/lib/ai/
git commit -m "feat: AI provider abstraction — OpenAI and Anthropic client-side providers"
```

---

## Task 10: CodeSandbox client

**Files:**
- Create: `src/lib/codesandbox.ts`
- Test: `src/lib/codesandbox.test.ts`

**Interfaces:**
- Produces:
  - `parseSandboxId(url: string): string | null`
  - `sandboxEmbedUrl(id: string): string`
  - `sandboxOpenUrl(id: string): string`
  - `createSandbox(token, opts): Promise<{ id: string; updatedAt: string }>`
  - `fetchSandboxMeta(token, id): Promise<{ updatedAt: string } | null>`

> **Note:** Verify the CodeSandbox REST API endpoints against their current docs before shipping. The define endpoint (`POST /api/v1/sandboxes/define?json=1`) and sandbox info endpoint (`GET /api/v1/sandboxes/:id`) are the most stable but may have changed. Check https://codesandbox.io/docs/learn/devboxes/api if the calls fail.

- [ ] **Step 1: Write the tests**

Create `src/lib/codesandbox.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseSandboxId, sandboxEmbedUrl, sandboxOpenUrl } from './codesandbox'

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

  it('returns null for non-CS URLs', () => {
    expect(parseSandboxId('https://github.com/user/repo')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(parseSandboxId('')).toBeNull()
  })
})

describe('sandboxEmbedUrl', () => {
  it('produces an embed URL', () => {
    const url = sandboxEmbedUrl('abc123')
    expect(url).toContain('codesandbox.io/embed/abc123')
    expect(url).toContain('theme=dark')
  })
})

describe('sandboxOpenUrl', () => {
  it('produces a direct open URL', () => {
    expect(sandboxOpenUrl('abc123')).toBe('https://codesandbox.io/s/abc123')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
yarn test src/lib/codesandbox.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create src/lib/codesandbox.ts**

```ts
const CS_API = 'https://codesandbox.io/api/v1'

const LANG_EXT: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  react: 'tsx',
}

export function parseSandboxId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /codesandbox\.io\/s\/([^/?#\s]+)/,
    /codesandbox\.io\/p\/sandbox\/([^/?#\s]+)/,
    /codesandbox\.io\/embed\/([^/?#\s]+)/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }
  return null
}

export function sandboxEmbedUrl(sandboxId: string): string {
  return `https://codesandbox.io/embed/${sandboxId}?fontsize=14&hidenavigation=0&theme=dark`
}

export function sandboxOpenUrl(sandboxId: string): string {
  return `https://codesandbox.io/s/${sandboxId}`
}

export async function createSandbox(
  token: string,
  opts: { title: string; starterCode: string; spec: string; language: string },
): Promise<{ id: string; updatedAt: string }> {
  const ext = LANG_EXT[opts.language] ?? 'ts'
  const res = await fetch(`${CS_API}/sandboxes/define?json=1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      files: {
        [`index.${ext}`]: { content: opts.starterCode },
        'README.md': { content: `# ${opts.title}\n\n${opts.spec}` },
      },
    }),
  })
  if (!res.ok) throw new Error(`CodeSandbox API error: ${res.status}`)
  const data = await res.json()
  const id = data.sandbox_id ?? data.id
  if (!id) throw new Error('CodeSandbox returned no sandbox ID')
  return { id, updatedAt: new Date().toISOString() }
}

export async function fetchSandboxMeta(
  token: string,
  sandboxId: string,
): Promise<{ updatedAt: string } | null> {
  try {
    const res = await fetch(`${CS_API}/sandboxes/${sandboxId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    const updatedAt =
      data.updated_at ?? data.updatedAt ?? data.sandbox?.updated_at ?? null
    return updatedAt ? { updatedAt } : null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests**

```bash
yarn test src/lib/codesandbox.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/codesandbox.ts src/lib/codesandbox.test.ts
git commit -m "feat: CodeSandbox API client — create sandbox, fetch metadata, parse URLs"
```

---

## Task 11: New Kata from AI (updated)

**Files:**
- Modify: `src/components/NewKataDialog.tsx`

**Interfaces:**
- Consumes: `createAiProvider`, `AiKataCandidate`, `estimateMinutes` from `src/lib/ai/index.ts`; `createSandbox` from `src/lib/codesandbox.ts`; `getUserConfig` from `src/lib/userConfig.ts`; `useAuth` from `src/auth/AuthProvider.tsx`
- Produces: updated dialog that calls AI client-side, shows trimmed preview, creates CS sandbox on accept

- [ ] **Step 1: Rewrite NewKataDialog.tsx**

Replace the full contents of `src/components/NewKataDialog.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { getUserConfig } from '@/lib/userConfig'
import { createAiProvider, estimateMinutes } from '@/lib/ai'
import type { AiKataCandidate, CostEstimate } from '@/lib/ai'
import { createSandbox } from '@/lib/codesandbox'
import type { Kata, Language } from '@/types'
import { LANGS, DIFFS, LENGTHS, type Length } from '@/ui/constants'
import { KataRepo, uuid, nowISO } from '@/db'
import { useNavigate } from 'react-router-dom'

export function NewKataDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [influence, setInfluence] = useState('')
  const [language, setLanguage] = useState<Language>('typescript')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [length, setLength] = useState<Length>('Standard')
  const [useExisting, setUseExisting] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidate, setCandidate] = useState<AiKataCandidate | null>(null)
  const [cost, setCost] = useState<CostEstimate | null>(null)

  async function doGenerate() {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      const config = await getUserConfig(user.uid)
      if (!config.aiApiKey) {
        setError('No AI API key configured. Add one in Settings.')
        return
      }
      const provider = createAiProvider(config)
      let existingKataTitles: string[] | undefined
      if (useExisting) {
        const katas = await KataRepo.list()
        existingKataTitles = katas.map((k) => k.title)
      }
      const result = await provider.generateKata({
        influence: influence || undefined,
        language,
        difficulty,
        length,
        existingKataTitles,
      })
      setCandidate(result.candidate)
      setCost(result.cost)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate preview.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function acceptAndSave() {
    if (!candidate || !user) return
    setBusy(true)
    setError(null)
    try {
      const config = await getUserConfig(user.uid)
      const spec = candidate.steps.map((s) => `- ${s}`).join('\n')

      let sandboxId: string | undefined
      let sandboxUpdatedAt: string | undefined

      if (config.csToken) {
        try {
          const sb = await createSandbox(config.csToken, {
            title: candidate.title,
            starterCode: candidate.starterCode,
            spec,
            language,
          })
          sandboxId = sb.id
          sandboxUpdatedAt = sb.updatedAt
        } catch (sbErr) {
          console.warn('Sandbox creation failed, saving without it:', sbErr)
        }
      }

      const now = nowISO()
      const kata: Kata = {
        id: uuid(),
        title: candidate.title,
        languages: [language],
        tags: [],
        sandboxId,
        sandboxUpdatedAt,
        createdAt: now,
      }
      await KataRepo.upsert(kata)
      onClose()
      navigate(`/kata/${kata.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setBusy(false)
    }
  }

  const estMinutes = estimateMinutes(length)

  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-20 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-xl font-semibold mb-4">New Kata from AI</h2>

        <div className="space-y-4">
          <label className="block text-sm">
            Influence (optional)
            <input
              className="mt-1 w-full border rounded p-2 bg-transparent"
              placeholder="e.g., memoization, BFS, CSS Grid"
              value={influence}
              onChange={(e) => setInfluence(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">
              Language
              <select
                className="mt-1 w-full border rounded p-2 bg-transparent"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              Difficulty
              <select
                className="mt-1 w-full border rounded p-2 bg-transparent"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              >
                {DIFFS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              Length
              <select
                className="mt-1 w-full border rounded p-2 bg-transparent"
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
              >
                {LENGTHS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={useExisting}
              onChange={(e) => setUseExisting(e.target.checked)}
            />
            Take my existing katas into account
          </label>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 border rounded text-sm" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            {candidate && (
              <button className="px-3 py-2 border rounded text-sm" onClick={doGenerate} disabled={busy}>
                Retry
              </button>
            )}
            <button
              className="px-3 py-2 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm"
              onClick={doGenerate}
              disabled={busy}
            >
              {busy ? 'Generating…' : candidate ? 'Generate New' : 'Generate Preview'}
            </button>
            <button
              className="px-3 py-2 rounded bg-green-600 text-white text-sm"
              onClick={acceptAndSave}
              disabled={!candidate || busy}
            >
              Accept & Save
            </button>
          </div>

          {candidate && (
            <div className="relative mt-2 border rounded p-4">
              <div className="absolute right-2 top-2 text-[10px] uppercase tracking-wide bg-indigo-600 text-white rounded px-2 py-0.5">
                Preview Only
              </div>

              <h3 className="font-semibold text-lg pr-20">{candidate.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language} • {difficulty} • {length} (~{estMinutes} min)
              </p>

              <p className="mt-3 text-sm">{candidate.summary}</p>

              <ul className="list-disc ml-5 mt-2 text-sm space-y-1">
                {candidate.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Starter Code</summary>
                <pre className="mt-2 text-xs overflow-auto border rounded p-2 bg-slate-50 dark:bg-slate-800">
                  {candidate.starterCode}
                </pre>
              </details>

              {cost && (
                <p className="text-xs text-slate-400 mt-3">
                  {cost.inputTokens} in / {cost.outputTokens} out tokens
                  {' '}(~${cost.totalUSD.toFixed(4)})
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update the NewKataDialog call site in KataListPage**

In `src/pages/KataListPage.tsx`, the `NewKataDialog` no longer takes an `onImport` prop. Update the call site:

```tsx
{getFromAiOpen && (
  <NewKataDialog onClose={() => setGetFromAiOpen(false)} />
)}
```

Remove the `onImportAIKata` function from `KataListPage` entirely — the dialog now handles its own save + navigate.

- [ ] **Step 3: Verify build**

```bash
yarn build
```

Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/NewKataDialog.tsx src/pages/KataListPage.tsx
git commit -m "feat: New Kata from AI — client-side AI providers, trimmed preview, CS sandbox creation"
```

---

## Task 12: Kata detail page

**Files:**
- Modify: `src/pages/KataDetailPage.tsx`

**Interfaces:**
- Consumes: `KataRepo` from `src/db`; `sandboxEmbedUrl`, `sandboxOpenUrl`, `fetchSandboxMeta` from `src/lib/codesandbox.ts`; `getUserConfig` from `src/lib/userConfig.ts`; `useAuth`, `TagInput`

- [ ] **Step 1: Build out KataDetailPage**

Replace the full contents of `src/pages/KataDetailPage.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { KataRepo, formatRelative, nowISO, classNames } from '@/db'
import { getUserConfig } from '@/lib/userConfig'
import { sandboxEmbedUrl, sandboxOpenUrl, fetchSandboxMeta, parseSandboxId } from '@/lib/codesandbox'
import { TagInput } from '@/components/TagInput'
import type { Kata, Language } from '@/types'

const LANGUAGES: Language[] = ['javascript', 'typescript', 'react']

export default function KataDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [kata, setKata] = useState<Kata | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [userTags, setUserTags] = useState<string[]>([])
  const [sandboxUrlInput, setSandboxUrlInput] = useState('')

  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!id || !user) return
    KataRepo.get(id).then((k) => {
      if (!k) { setNotFound(true); return }
      setKata(k)
    })
    getUserConfig(user.uid).then((c) => setUserTags(c.tags))
  }, [id, user])

  // Fire-and-forget: refresh sandboxUpdatedAt from CS API on load
  useEffect(() => {
    if (!kata?.sandboxId || !user) return
    getUserConfig(user.uid).then(async (config) => {
      if (!config.csToken) return
      const meta = await fetchSandboxMeta(config.csToken, kata.sandboxId!)
      if (meta && meta.updatedAt !== kata.sandboxUpdatedAt) {
        await KataRepo.update(kata.id, { sandboxUpdatedAt: meta.updatedAt })
        setKata((prev) => prev ? { ...prev, sandboxUpdatedAt: meta.updatedAt } : prev)
      }
    })
  }, [kata?.sandboxId])

  async function patchKata(patch: Partial<Kata>) {
    if (!kata) return
    const updated = { ...kata, ...patch }
    setKata(updated)
    await KataRepo.update(kata.id, patch)
  }

  function onNotesChange(notes: string) {
    if (!kata) return
    setKata((prev) => prev ? { ...prev, notes } : prev)
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)
    notesDebounceRef.current = setTimeout(() => {
      KataRepo.update(kata.id, { notes })
    }, 1000)
  }

  async function linkSandboxUrl() {
    const parsed = parseSandboxId(sandboxUrlInput)
    if (!parsed) return
    await patchKata({ sandboxId: parsed })
    setSandboxUrlInput('')
  }

  async function deleteKata() {
    if (!kata || !confirm('Delete this kata?')) return
    await KataRepo.remove(kata.id)
    navigate('/')
  }

  function toggleLanguage(lang: Language) {
    if (!kata) return
    const next = kata.languages.includes(lang)
      ? kata.languages.filter((l) => l !== lang)
      : [...kata.languages, lang]
    patchKata({ languages: next })
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/" className="text-sm text-indigo-600 hover:underline">← Back</Link>
        <p className="mt-4 text-slate-500">Kata not found.</p>
      </div>
    )
  }

  if (!kata) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 text-slate-500">Loading…</div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-full px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-sm text-indigo-600 hover:underline shrink-0">← Back</Link>
          <input
            className="flex-1 min-w-0 bg-transparent text-lg font-semibold focus:outline-none"
            value={kata.title}
            onChange={(e) => patchKata({ title: e.target.value })}
            aria-label="Kata title"
          />
          <button
            onClick={deleteKata}
            className="shrink-0 text-xs text-red-500 hover:underline"
          >
            Delete
          </button>
        </div>
      </header>

      {/* Two-panel body */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* Left: sandbox iframe */}
        <div className="flex flex-col md:w-[65%] border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
          {kata.sandboxId ? (
            <>
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <a
                  href={sandboxOpenUrl(kata.sandboxId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Open in CodeSandbox ↗
                </a>
              </div>
              <iframe
                src={sandboxEmbedUrl(kata.sandboxId)}
                className="flex-1 w-full"
                style={{ minHeight: '600px', border: 0 }}
                allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb; xr-spatial-tracking"
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                title="CodeSandbox"
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
              <p className="text-slate-500 text-sm">No sandbox linked yet.</p>
              <div className="flex gap-2 w-full max-w-sm">
                <input
                  className="flex-1 border rounded px-3 py-1.5 text-sm bg-transparent"
                  placeholder="Paste CodeSandbox URL…"
                  value={sandboxUrlInput}
                  onChange={(e) => setSandboxUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && linkSandboxUrl()}
                />
                <button
                  onClick={linkSandboxUrl}
                  className="px-3 py-1.5 rounded border text-sm"
                >
                  Link
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: metadata + notes */}
        <div className="md:w-[35%] flex flex-col overflow-y-auto p-4 gap-5">

          {/* Languages */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Languages</div>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={classNames(
                    'rounded-full border px-3 py-0.5 text-xs',
                    kata.languages.includes(lang)
                      ? 'bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
                      : 'border-slate-300 dark:border-slate-600',
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Tags</div>
            <TagInput
              tags={kata.tags}
              onChange={(tags) => patchKata({ tags })}
            />
          </div>

          {/* Notes */}
          <div className="flex-1 flex flex-col">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Notes</div>
            <textarea
              className={classNames(
                'flex-1 w-full rounded-md border border-slate-200 dark:border-slate-700',
                'bg-white dark:bg-slate-800 p-3 text-sm resize-none',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500',
              )}
              style={{ minHeight: '200px' }}
              placeholder="Add thoughts, learnings, links… (markdown ok)"
              value={kata.notes ?? ''}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>

          {/* Timestamp */}
          <div className="text-xs text-slate-400">
            Updated {formatRelative(kata.sandboxUpdatedAt ?? kata.createdAt)}
          </div>

        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
yarn build
```

Expected: succeeds.

- [ ] **Step 3: Run all tests**

```bash
yarn test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/KataDetailPage.tsx
git commit -m "feat: kata detail page — sandbox iframe, inline notes, language/tag editing"
```

---

## Task 13: Firestore rules (external step)

**Files:** in `~/Projects/firebase-robbchar-config` — **not in this repo**

> This task must be done in the `firebase-robbchar-config` project. Never add `.rules` files to the kata-keeper repo.

- [ ] **Step 1: Open the firebase-robbchar-config project**

```bash
cd ~/Projects/firebase-robbchar-config
```

- [ ] **Step 2: Add the kata-keeper namespace block to firestore.rules**

In `firestore.rules`, add inside the `match /databases/{database}/documents` block (without touching any existing app blocks):

```
match /kata-keeper/users/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /kata-keeper/users/{uid}/katas/{kataId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

- [ ] **Step 3: Deploy rules from that project**

Follow the deployment process defined in `firebase-robbchar-config`. Do not run `firebase deploy` from the kata-keeper repo.

- [ ] **Step 4: Back in kata-keeper — update README**

In the kata-keeper repo, create or update `README.md` to include a Firebase section:

```markdown
## Firebase

This app uses Firebase project `robbchar-3db11` (Hosting, Auth, Firestore).

**Firestore rules** are not in this repo. They are managed centrally in
`~/Projects/firebase-robbchar-config`. To update rules for the `kata-keeper`
namespace, edit `firestore.rules` in that project and deploy from there.

**Hosting** is deployed automatically via GitHub Actions on push to `main`.
```

- [ ] **Step 5: Commit the README**

```bash
git add README.md
git commit -m "docs: document Firebase split — rules in firebase-robbchar-config"
```

---

## Self-review against spec

| Spec requirement | Task |
|---|---|
| Firestore storage under `kata-keeper` namespace | Tasks 3, 13 |
| v2 Kata schema (remove status/difficulty/link etc.) | Task 2 |
| Dexie → Firestore migration with field mapping | Task 4 |
| Keep email/password auth unchanged | No task needed — untouched |
| GitHub OAuth for CS (separate from app login) | Task 8 (stub in Config) — wire in future work when CS API is confirmed |
| AI provider abstraction (OpenAI + Anthropic) | Task 9 |
| Client-side AI calls with user's own key | Tasks 9, 11 |
| Config screen: AI provider, CS token, tags | Task 8 |
| `previewKata` Cloud Function retired | Task 1 |
| `firebase-setup/` deleted | Task 1 |
| `firestore.rules` deleted from this repo | Task 1 |
| `firebase.json` hosting-only | Task 1 |
| New routes: `/kata/:id`, `/config` | Task 5 |
| List view: remove status/difficulty, add tags column | Task 6 |
| Timestamp: `sandboxUpdatedAt ?? createdAt` | Task 6 |
| New Kata from AI: trimmed preview (no tests/solution/hints) | Task 11 |
| "Take existing katas into account" checkbox | Task 11 |
| CS sandbox creation on Accept & Save | Task 11 |
| Kata detail: iframe + notes + tag/language editing | Task 12 |
| Fire-and-forget sandbox metadata refresh | Task 12 |
| Notes autosave with debounce | Task 12 |
| Firestore rules in `firebase-robbchar-config` | Task 13 |
| README note about Firebase split | Task 13 |
| Test infrastructure | Task 1 |
| Tests alongside source files | All tasks |

**GitHub OAuth for CS** (Config screen step) is partially stubbed in Task 8 with a status display but the actual Firebase GitHub provider OAuth flow is deferred — the CS API endpoint behaviour should be confirmed first. If the `createSandbox` call works with a plain CS API token (no GitHub token needed), the GitHub connect button may be unnecessary. Wire it only if the CS API requires a GitHub OAuth token rather than a CS-issued token.
