import { useState } from 'react';
import { createOrLinkAccount } from '@/auth/createOrLinkAccount';
import type { AuthError } from 'firebase/auth';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await createOrLinkAccount(email, password);
      setOk('Account ready! You can close this page or go back.');
    } catch (e: AuthError | unknown) {
      const error = e as AuthError;
      setErr(error?.message ?? 'Failed to create account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold mb-4">Create your account</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-1">
          <span>Email</span>
          <input
            className="border rounded p-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="grid gap-1">
          <span>Password</span>
          <input
            className="border rounded p-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        {ok && <div className="text-green-700 text-sm">{ok}</div>}
        <button className="rounded px-4 py-2 border" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <div className="mt-3 text-sm">
        Already have an account?{' '}
        <a href="/login" className="underline">
          Sign in
        </a>
      </div>
    </div>
  );
}
