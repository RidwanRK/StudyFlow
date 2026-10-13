'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDay, formatHours } from '@/lib/dates';
import AppHeader from '@/components/AppHeader';
import DayList from '@/components/DayList';
import Notice from '@/components/Notice';

export default function PlanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState(undefined); // undefined = still loading, null = no plan yet
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api('/plan')
      .then(({ plan: saved }) => {
        if (!saved) router.replace('/setup/courses');
        else setPlan(saved);
      })
      .catch((err) => setError(err.message));
  }, [user, router]);

  if (loading || !user) {
    return (
      <main className="page">
        <p className="muted center">Loading…</p>
      </main>
    );
  }

  const studyDays = plan ? plan.days.filter((d) => d.blocks.length > 0).length : 0;
  const totalHours = plan ? plan.days.reduce((sum, d) => sum + d.blocks.reduce((s, b) => s + b.hours, 0), 0) : 0;

  const adj = plan?.capacityAdjustment;
  const extraNote = adj?.extraPerDay > 0
    ? `Includes the extra ${formatHours(adj.extraPerDay)} a day you chose.`
    : adj?.extraDays?.length > 0
      ? `Includes the extra time you chose: ${adj.extraDays.map((d) => `${formatHours(d.hours)} on ${formatDay(d.date)}`).join(' and ')}.`
      : '';

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="stack">
          <h1>Your plan</h1>
          <Notice tone="error">{error}</Notice>
          {plan === undefined && !error && <p className="muted center">Loading…</p>}

          {plan && (
            <div className="plan-layout">
              <aside className="plan-side">
                <div className="card stack plan-summary">
                  <p>{plan.note}</p>
                  <p className="muted">
                    {formatHours(totalHours)} of studying across {studyDays} {studyDays === 1 ? 'day' : 'days'}. Tap a day to open it.
                  </p>
                </div>
                {plan.lighterMessage && (
                  <div className="card lighter-card">
                    <p>{plan.lighterMessage}</p>
                  </div>
                )}
                {extraNote && (
                  <div className="card">
                    <p className="muted">{extraNote}</p>
                  </div>
                )}
                <Link href="/setup/courses" className="btn btn-quiet align-start link-btn">
                  Edit courses or rebuild the plan
                </Link>
              </aside>
              <DayList days={plan.days} onPlanChange={setPlan} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
