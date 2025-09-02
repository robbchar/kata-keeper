/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Auth } from 'firebase/auth';

export function setupAuthDebug(auth: Auth) {
  (window as any).auth = auth;
  (window as any).user = () => auth.currentUser;
}
