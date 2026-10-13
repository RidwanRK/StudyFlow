'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Notice from './Notice';

export default function AuthForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const registering = mode === 'register';

  function chooseMode(next) {
    setMode(next);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(mode, username, password);
      router.replace('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card auth-card">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={!registering} className={`tab ${!registering ? 'tab-on' : ''}`} onClick={() => chooseMode('login')}>
          Sign in
        </button>
        <button type="button" role="tab" aria-selected={registering} className={`tab ${registering ? 'tab-on' : ''}`} onClick={() => chooseMode('register')}>
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="stack">
        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} required />
          {registering && <small>At least 6 characters.</small>}
        </label>
        <Notice tone="error">{error}</Notice>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'One moment…' : registering ? 'Create my account' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
