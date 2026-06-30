# Kata Keeper v2 — Design Spec

**Date:** 2026-06-25  
**Status:** Approved

---

## Overview

Kata Keeper is a personal coding kata tracker. v2 rethinks the core loop: discover or generate a kata → work on it in CodeSandbox → come back to Kata Keeper to track it and leave notes. Code lives in CodeSandbox; Kata Keeper owns the metadata and reflection.

---

## Architecture: Option A — Incremental layering

Keep the existing component and routing skeleton. Migrate data layer from Dexie → Firestore in one focused pass, then add new features as additive layers. The `KataRepo` interface is preserved; only its internals change.

---

## Firebase

**Project ID:** `robbchar-3db11` (multi-app project — scope all changes to `kata-keeper` namespace only)

### What stays in this repo
- Cloud Functions source (none in v2 — `previewKata` is retired)
- Hosting config (`firebase.json` hosting section, `.firebaserc`)
- CI hosting deploy (`.github/workflows/firebase-deploy.yml`)

### What is centralized in `firebase-robbchar-config`
- All Firestore rules (`.rules` files)
- Project-level config

**Firestore rules for v2** must be added to `~/Projects/firebase-robbchar-config`:

```
match /kata-keeper/users/{uid} {
  allow read, write: if request.auth.uid == uid;
}
match /kata-keeper/users/{uid}/katas/{kataId} {
  allow read, write: if request.auth.uid == uid;
}
```

---

## Firebase cleanup (part of v2 work)

| Item | Action |
|---|---|
| `firebase-setup/` | Delete — `previewKata` Cloud Function is retired |
| `firestore.rules` | Delete from this repo — rules belong in `firebase-robbchar-config` |
| `firebase.json` | Strip `functions` + `firestore` sections; keep `hosting` only |
| `.firebaserc` | Keep |
| `.github/workflows/firebase-deploy.yml` | Keep |

> **Note:** Firestore rules are managed in `~/Projects/firebase-robbchar-config`. Never add `.rules` files to this repo. Any rule changes for the `kata-keeper` namespace must go there and be deployed from that project.

---

## Data architecture

### Firestore structure (namespaced under `kata-keeper`)

```
/kata-keeper/users/{uid}                ← user config doc
/kata-keeper/users/{uid}/katas/{kataId} ← kata records
```

### User config doc

```ts
{
  aiProvider: 'openai' | 'anthropic'
  aiApiKey: string           // stored as-is; displayed as password input only
  csToken: string            // CodeSandbox API token
  csGitHubConnected: boolean
  tags: string[]             // user's tag set; seeded with defaults on first run
}
```

Default tags on first run: `hooks`, `async`, `state`, `forms`, `routing`, `testing`, `performance`, `a11y`, `arrays`, `strings`, `algorithms`, `api`

### Kata record (v2 schema)

```ts
{
  id: string
  title: string
  languages: ('javascript' | 'typescript' | 'react')[]
  tags: string[]
  sandboxId?: string
  sandboxUpdatedAt?: string   // ISO — fetched from CS API, not user-entered
  notes?: string              // markdown ok
  createdAt: string           // ISO
}
```

**Removed from v1:** `status`, `difficulty`, `description`, `requirements`, `link`, `updatedAt`, `lastWorkedAt`

### KataRepo interface (unchanged externally)

```ts
KataRepo.list()           // ordered by sandboxUpdatedAt ?? createdAt, desc
KataRepo.get(id)
KataRepo.upsert(kata)
KataRepo.update(id, patch)
KataRepo.remove(id)
```

Internals swap from Dexie to Firestore collection calls. Nothing else in the app changes.

### Dexie migration (one-time)

On first authenticated load: if Dexie has records and the user's Firestore `/katas` subcollection is empty, run a migration. Mapping:

| v1 field | v2 field | Notes |
|---|---|---|
| `title` | `title` | direct |
| `languages` | `languages` | filter to bounded set; default `['typescript']` if empty |
| `tags` | `tags` | direct |
| `notes` | `notes` | direct |
| `link` | `sandboxId` | parse sandbox ID from CS URL if present; otherwise discard |
| all others | — | dropped |

After successful Firestore write, Dexie is cleared.

---

## Auth

**Kata Keeper login:** keep existing email/password (Firebase Auth). No change.

**CodeSandbox integration:** separate GitHub OAuth connect flow, triggered from the Config screen via Firebase's GitHub provider. Stores the resulting access token in the user config doc. This is scoped only to enabling CS API features — it is not the app login.

---

## AI provider abstraction

The `previewKata` Firebase Cloud Function is retired. AI calls move client-side, using the user's own API key from their config doc.

### Provider interface

```ts
interface AiProvider {
  generateKata(params: GenerateKataParams): Promise<AiKataCandidate>
  estimateCost(candidate: AiKataCandidate): CostEstimate
}

type GenerateKataParams = {
  influence?: string
  language: Language
  difficulty: 'easy' | 'medium' | 'hard'
  length: 'Snack' | 'Standard' | 'DeepDive'
  existingKataTitles?: string[]  // injected when "take existing katas into account" is checked
}

type CostEstimate = {
  inputTokens: number
  outputTokens: number
  totalUSD: number
}
```

`createAiProvider(config: UserConfig): AiProvider` — factory returning the right implementation.

- **OpenAI:** `gpt-4o-mini`, `response_format: json_schema` for structured output, keep existing prompt + cost behaviour
- **Anthropic:** `claude-sonnet-4-6`, ask for JSON in prompt (no native JSON schema enforcement), report input/output tokens separately

### Trimmed AI response shape (v2)

Tests, solution, hints, and acceptance criteria are removed — the AI no longer generates them:

```ts
type AiKataCandidate = {
  title: string
  summary: string     // one-line description
  steps: string[]     // requirements bullets (3–6 items)
  starterCode: string
}
```

---

## Routing

| Route | Component |
|---|---|
| `/login`, `/signup`, `/logout` | Existing — no change |
| `/` | `KataListPage` — existing list, trimmed |
| `/kata/:id` | `KataDetailPage` — promotes current modal to full route |
| `/config` | `ConfigPage` — new |

The current kata details modal is retired in favour of the `/kata/:id` route. The "New Kata" manual form and "New Kata from AI" dialog remain as overlays on `/`. Export JSON moves to Config. The "Worked" stamp action is removed (no `lastWorkedAt` in v2).

---

## List view changes

- Remove columns: Status, Difficulty
- Remove filter: Status
- Timestamp column: shows `sandboxUpdatedAt` relative time, falling back to `createdAt`
- Default sort: recency (`sandboxUpdatedAt ?? createdAt`)
- Tags column: added
- Sort options: trim to Updated, Created, Title (remove Difficulty, Last Worked)

---

## Config screen (`/config`)

Three sections:

### AI Provider
- Dropdown: Anthropic / OpenAI
- API key input (password field — never shown in plaintext)
- "Test connection" button — minimal API call to verify the key
- Token/cost display adapts per provider

### CodeSandbox
- CS API token input (password field)
- "Connect GitHub" button — Firebase GitHub OAuth, stores access token in config doc; shows connected account once linked

### Tags
- Current tag list as removable chips
- "Add tag" input
- Changes write immediately to Firestore config doc
- Export JSON moved here

---

## New Kata from AI (updated)

### Form inputs
- Influence (optional freeform)
- Language (single select: javascript / typescript / react)
- Difficulty (easy / medium / hard) — generation input only, not stored
- Length (Snack / Standard / DeepDive)
- "Take my existing katas into account" checkbox — sends kata titles to the AI prompt

### Preview card
Shows: title, `language • difficulty • length (~X min)` metadata line, one-line summary, requirements bullets, starter code (collapsible). Removes: Tests, Solution, Hints sections. Tags are not auto-suggested — user manages their own.

### Accept & Save
1. Call CS API to create sandbox with starter code as main file + `README.md` containing kata title and steps
2. If no CS token configured: save kata without `sandboxId`, show nudge to connect CodeSandbox in Config
3. Parse `sandboxId` from CS API response
4. Write kata record to Firestore
5. Navigate to `/kata/:id`

**Retry** regenerates with the same form inputs.

---

## Kata detail page (`/kata/:id`)

### Layout
Two-panel on wide screens: left panel (~65%) CodeSandbox iframe, right panel (~35%) metadata + notes. Stacks on narrow screens (notes above, iframe below).

### Left panel
- `<iframe src="https://codesandbox.io/embed/{sandboxId}?fontsize=14&hidenavigation=0&theme=dark" />`
- "Open in CodeSandbox ↗" link above iframe
- If no `sandboxId`: placeholder with text input to paste a CS URL and link it manually

### Right panel
- Title — inline editable
- Language chips — multi-select toggle (javascript / typescript / react)
- Tag chips — autocomplete from user's config tag list; type to add new
- Notes — markdown textarea, autosaves on 1-second debounce
- Timestamp — `sandboxUpdatedAt` relative time, fallback to `createdAt`

### On page load
If `sandboxId` + CS token are present, fetch sandbox metadata from CS API to refresh `sandboxUpdatedAt`. Fire-and-forget — page does not block on it.

---

## Import from CodeSandbox (nice-to-have)

If CS API supports listing sandboxes: fetch list, let user select which to import, create kata records with `sandboxId` and title from CS. If not: fall back to manual URL paste flow (user pastes URL, app parses ID, fetches metadata). Implement if straightforward during the CS API integration work.
