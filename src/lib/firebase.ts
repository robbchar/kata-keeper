import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  type Auth,
} from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { setupAuthDebug } from '../debug/authDebug';

const REGION = 'us-west1' as const;
const USE_EMU = import.meta.env.VITE_USE_EMULATORS === 'true';
console.log('[firebase] emulators:', USE_EMU ? 'ON' : 'OFF');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY!,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID!,
};

let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _functions: Functions | null = null;

/** Initialize once, return the same instances thereafter. */
export function firebase() {
  if (_auth && _db && _functions) {
    return { auth: _auth, db: _db, functions: _functions };
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  _auth = getAuth(app);
  _db = getFirestore(app);
  _functions = getFunctions(app, REGION);

  if (USE_EMU) {
    connectAuthEmulator(_auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(_db, '127.0.0.1', 8080);
    connectFunctionsEmulator(_functions, '127.0.0.1', 5001);
  }

  // Fire-and-forget; no need to await to use auth.
  setPersistence(_auth, browserLocalPersistence).catch((e) => {
    console.warn('[auth] setPersistence failed', e);
  });

  // Safe to expose after instances exist
  setupAuthDebug(_auth);

  return { auth: _auth, db: _db, functions: _functions };
}
