import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Persist sessions across reloads
setPersistence(auth, browserLocalPersistence).catch((e) => {
  // Non-fatal; fallback to in-memory if something odd happens
  console.warn('[auth] setPersistence failed', e);
});
