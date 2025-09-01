import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  signInWithEmailAndPassword,
  type AuthError,
} from 'firebase/auth';
import { auth } from '@/firebase';

/**
 * Creates a new email/password account or upgrades an anonymous user.
 * If the email already exists, falls back to sign-in.
 */
export async function createOrLinkAccount(email: string, password: string) {
  const cred = EmailAuthProvider.credential(email, password);
  const current = auth.currentUser;

  if (current && current.isAnonymous) {
    try {
      await linkWithCredential(current, cred);
      return auth.currentUser;
    } catch (e: AuthError | unknown) {
      const error = e as AuthError;
      // If email is already in use, just sign in instead.
      if (
        error.code === 'auth/email-already-in-use' ||
        error.code === 'auth/credential-already-in-use'
      ) {
        await signInWithEmailAndPassword(auth, email, password);
        return auth.currentUser;
      }
      throw e;
    }
  }

  // Not anonymous → try to create a new account
  await createUserWithEmailAndPassword(auth, email, password);
  return auth.currentUser;
}
