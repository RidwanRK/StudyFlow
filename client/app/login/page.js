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
    <main className="auth-layout">
      <section className="auth-hero">
        <h1 className="hero-title">StudyFlow</h1>
        <p className="lead">A study plan that bends with you when a day doesn&apos;t go to plan.</p>
        <ul className="auth-points">
          <li>Tell us your courses, topics and exam dates.</li>
          <li>Get a calm, day-by-day plan built around the hours you really have.</li>
          <li>Fell behind? Replan, and see exactly what moved and why.</li>
        </ul>
      </section>
      <section className="auth-panel">
        <AuthForm />
      </section>
    </main>
  );
}
