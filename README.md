# Kata Keeper v2

A personal kata library with AI-powered problem generation and CodeSandbox integration.

## Overview

Kata Keeper is a web app that lets you build and practice a personal library of coding challenges. v2 adds:

- **AI-powered kata generation** — generate new katas with OpenAI or Anthropic
- **CodeSandbox integration** — one-click sandbox creation from AI suggestions
- **Client-side AI calls** — use your own API key (never stored on the server)
- **Configuration panel** — manage AI provider settings, CodeSandbox token, and kata tags
- **Firestore backend** — persistent storage with user-isolated data

## Tech Stack

- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS, React Router
- **Backend:** Firebase (Auth, Firestore)
- **AI:** OpenAI or Anthropic (client-side via user's own API key)
- **Sandbox:** CodeSandbox API for on-demand IDE environments
- **Testing:** Vitest + React Testing Library

## Features

### Authentication
- Email/password sign-up and login via Firebase Auth
- User data isolated per `uid`

### Kata Management
- **List view** — browse all katas with quick info (title, language, tags, last updated)
- **Detail view** — view kata spec, embedded CodeSandbox iframe, notes, and tags
- **Edit** — update kata notes, tags, and language

### AI Kata Generation
- Describe what kind of kata you want (text influence)
- Pick language, difficulty, and length
- Option to avoid topics from existing katas
- Generate a preview with spec, starter code, and test structure
- Accept and save directly to Firestore + create a CodeSandbox

### Config Screen
- **AI Provider**: choose OpenAI or Anthropic, enter API key
- **CodeSandbox Token**: save your CS token for sandbox creation
- **Kata Tags**: manage custom tags for organization

## Routes

| Path | Purpose |
|------|---------|
| `/login` | Sign in with email/password |
| `/signup` | Create a new account |
| `/` | Kata list view |
| `/kata/:id` | View, edit, and practice a kata |
| `/config` | Manage AI provider, CS token, tags |

## Getting Started

### Prerequisites
- Node.js 18+ and Yarn
- Firebase project (for auth and Firestore)
- (Optional) OpenAI or Anthropic API key for AI generation
- (Optional) CodeSandbox API token for sandbox creation

### Install & Run
```bash
yarn install
yarn dev
```

The app will open at http://localhost:5173.

### Build
```bash
yarn build
```

### Test
```bash
yarn test              # Run all tests once
yarn test:ui          # Open test UI dashboard
```

## Environment Variables

Create a `.env.local` file:

```
VITE_FIREBASE_API_KEY=<your-firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=robbchar-3db11

# Optional: for local Firebase emulators
VITE_USE_EMULATORS=false
```

## Firebase

This app uses Firebase project `robbchar-3db11` for Auth and Firestore hosting.

### Firestore Rules ⚠️

**Firestore rules are NOT stored in this repository.** They are managed centrally in `~/Projects/firebase-robbchar-config` to keep all Firebase configuration in one place and prevent accidental overwrites.

To update Firestore rules for the `kata-keeper` namespace:

1. Navigate to `~/Projects/firebase-robbchar-config`
2. Edit `firestore.rules` and add or update these rules (inside the `match /databases/{database}/documents` block):

```
match /kata-keeper/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /kata-keeper/{uid}/katas/{kataId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

3. Deploy rules from that project (do not run `firebase deploy` from kata-keeper)

### Firestore Paths

Katas are stored under the `kata-keeper` namespace, isolated by user:

```
kata-keeper/
  {uid}/                    # User config document
  {uid}/katas/{kataId}/     # Individual kata documents
```

### Hosting

The app is deployed to Firebase Hosting via GitHub Actions on push to `main`.

## Development

### Project Structure
```
src/
  auth/           # Firebase Auth context and guards
  components/     # Reusable UI components
  data/           # Data providers and hooks (user, config)
  db/             # Repository layer for Firestore operations
  lib/            # Utilities: AI providers, CodeSandbox, user config
  pages/          # Route pages
  types/          # TypeScript types (Kata, Language, etc.)
  ui/             # Constants and shared UI helpers
  test/           # Test setup and shared utilities
```

### Code Style
- TypeScript strict mode
- Component tests colocated (`Component.test.tsx` next to `Component.tsx`)
- Tailwind CSS for styling
- Functional components with hooks

## Logging & Debugging

- Firebase logs: https://console.cloud.google.com/logs?project=robbchar-3db11
- Check browser DevTools Console for client errors
- Auth debug info available in dev mode
