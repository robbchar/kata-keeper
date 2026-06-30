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
