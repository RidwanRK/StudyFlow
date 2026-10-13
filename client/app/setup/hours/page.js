'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import AppHeader from '@/components/AppHeader';
import HoursForm from '@/components/HoursForm';
import SetupNav from '@/components/SetupNav';

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
      <main className="page">
        <SetupNav current="hours" />
        <HoursForm />
      </main>
    </>
  );
}
