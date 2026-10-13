'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// Decides where the student belongs: login, welcome, hours, courses (later slices add the plan).
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.hasSeenWelcome) {
      router.replace('/welcome');
      return;
    }
    let cancelled = false;
    Promise.all([api('/setup'), api('/courses')])
      .then(([{ setup }, { courses }]) => {
        if (cancelled) return;
        if (!setup) router.replace('/setup/hours');
        else router.replace('/setup/courses');
      })
      .catch(() => !cancelled && router.replace('/setup/hours'));
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  return (
    <main className="page">
      <p className="muted center">Loading…</p>
    </main>
  );
}
