import type { Auth, Unsubscribe, User } from 'firebase/auth';

declare global {
  interface Window {
    authDebug?: {
      auth: Auth;
      readonly user: User | null;
      signInAnon: () => Promise<void>;
      signOut: () => Promise<void>;
      token: (forceRefresh?: boolean) => Promise<string | null>;
      onAuthStateChangedUnsub: Unsubscribe;
    };
    authUser?: User | null;
  }
}
export {};
