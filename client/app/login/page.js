'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import AuthForm from '@/components/AuthForm';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [user, loading, router]);

  return (
    <main className="page page-narrow">
      <h1 className="hero-title">StudyFlow</h1>
      <p className="lead center">A study plan that bends with you when a day doesn&apos;t go to plan.</p>
      <AuthForm />
    </main>
  );
}
