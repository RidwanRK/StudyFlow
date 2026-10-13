'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import AppHeader from '@/components/AppHeader';

// Placeholder: the real hours form arrives in the next slice.
export default function HoursPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="page">
        <p className="muted center">Loading…</p>
      </main>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="page page-narrow">
        <div className="card stack">
          <h1>Your study hours</h1>
          <p className="muted">You&apos;re signed in. Setting your hours comes next.</p>
        </div>
      </main>
    </>
  );
}
