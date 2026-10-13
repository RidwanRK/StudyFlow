'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

// Decides where the student belongs: login, welcome, or setup (later slices add more rules).
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!user.hasSeenWelcome) router.replace('/welcome');
    else router.replace('/setup/hours');
  }, [user, loading, router]);

  return (
    <main className="page">
      <p className="muted center">Loading…</p>
    </main>
  );
}
