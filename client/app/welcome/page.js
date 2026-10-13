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
    <main className="auth-layout">
      <section className="auth-hero">
        <h1 className="hero-title">Welcome, {user.username}</h1>
        <p className="lead">
          Exams are easier when you know exactly what to study today. Tell StudyFlow your courses, your exam dates and how
          many hours you can study, and it will build a day-by-day plan for you.
        </p>
      </section>
      <section className="auth-panel">
        <div className="card stack">
          <h2>How it works</h2>
          <ul className="auth-points">
            <li>You tell us your hours and your courses.</li>
            <li>We build a plan that fits your exams.</li>
            <li>
              When a day doesn&apos;t go the way you hoped, that&apos;s okay. Tell us what you got done, and StudyFlow suggests a
              new rhythm, showing you what moved and why, so you stay in charge.
            </li>
          </ul>
          <Notice tone="error">{error}</Notice>
          <button type="button" className="btn btn-primary" onClick={handleStart} disabled={busy}>
            {busy ? 'One moment…' : "Let's start"}
          </button>
        </div>
      </section>
    </main>
  );
}
