import { firebase } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useEffect } from 'react';

const { auth } = firebase();

export default function Logout() {
  useEffect(() => {
    (async () => {
      try {
        await signOut(auth);
      } finally {
        location.replace('/');
      }
    })();
  }, []);
  return <p className="p-4 text-sm">Signing out…</p>;
}
