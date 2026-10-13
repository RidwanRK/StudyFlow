'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Notice from '@/components/Notice';

export default function WelcomePage() {
  const { user, loading, markWelcomed } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  async function handleStart() {
    setBusy(true);
    setError('');
    try {
      await markWelcomed();
      router.replace('/setup/hours');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="page">
        <p className="muted center">Loading…</p>
      </main>
    );
  }

  return (
    <main className="page page-narrow">
      <div className="card stack">
        <h1>Welcome, {user.username}</h1>
        <p>
          Exams are easier when you know exactly what to study today. Tell StudyFlow your courses, your exam dates and how
          many hours you can study, and it will build a day-by-day plan for you.
        </p>
        <p>
          And when a day doesn&apos;t go the way you hoped, that&apos;s okay. Tell us what you got done, and StudyFlow will
          suggest a new rhythm, showing you what moved and why, so you stay in charge.
        </p>
        <Notice tone="error">{error}</Notice>
        <button type="button" className="btn btn-primary" onClick={handleStart} disabled={busy}>
          {busy ? 'One moment…' : "Let's start"}
        </button>
      </div>
    </main>
  );
}
