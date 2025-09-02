import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  connectAuthEmulator,
  type User,
} from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';

export function setupAuthDebug(
  app: FirebaseApp,
  { useEmulator = false }: { useEmulator?: boolean } = {},
) {
  if (!import.meta.env.DEV) return; // never expose in prod

  const auth = getAuth(app);
  if (useEmulator && location.hostname === 'localhost') {
    // Optional: only if you're running the Auth emulator locally (firebase emulators:start)
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    } catch {
      // ignore
    }
  }

  const state = {
    get user() {
      return auth.currentUser as User | null;
    },
    auth,
    async signInAnon() {
      await signInAnonymously(auth);
    },
    async signOut() {
      await signOut(auth);
    },
    async token(forceRefresh = false) {
      const u = auth.currentUser;
      return u ? u.getIdToken(forceRefresh) : null;
    },
    // subscribe so you can see changes live
    onAuthStateChangedUnsub: (() => {
      return onAuthStateChanged(auth, (user) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).authUser = user;
        console.log(
          '[authDebug] auth state:',
          user ? { uid: user.uid, isAnon: user.isAnonymous } : null,
        );
      });
    })(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).authDebug = state;
  console.log(
    '[authDebug] attached. Try: authDebug.user, authDebug.signInAnon(), await authDebug.token(true)',
  );
}
