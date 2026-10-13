'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDay, formatHours, localToday } from '@/lib/dates';
import { highlightFrom } from '@/lib/plan';
import AppHeader from '@/components/AppHeader';
import CantFitPanel from '@/components/CantFitPanel';
import DayList from '@/components/DayList';
import Notice from '@/components/Notice';
import ReplanProposal from '@/components/ReplanProposal';

export default function PlanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState(undefined); // undefined = still loading, null = no plan yet
  const [error, setError] = useState('');
  const [working, setWorking] = useState(''); // text shown over the page while the server works ('' = idle)
  const [fit, setFit] = useState(null); // "can't fit" answer to a replan, while the student chooses
  const [info, setInfo] = useState('');
  const [highlight, setHighlight] = useState(null); // blocks a just-accepted replan moved, softly highlighted
  const proposalRef = useRef(null);
  const fitRef = useRef(null);
  const reasonRef = useRef('fell_behind'); // why the current replan was asked for ('edit' when courses or hours changed)
  const reviewedRef = useRef(false);

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

  const pending = plan?.pendingReplan ?? null;
  useEffect(() => {
    if (pending) proposalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pending]);
  useEffect(() => {
    if (fit) fitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [fit]);

  // Arriving from the setup pages after an edit (/plan?review=edit): go straight to reviewing the plan changes.
  useEffect(() => {
    if (!plan || reviewedRef.current) return;
    if (new URLSearchParams(window.location.search).get('review') !== 'edit') return;
    reviewedRef.current = true;
    window.history.replaceState(null, '', '/plan');
    if (plan.stale && !plan.pendingReplan) handleReplan(undefined, 'edit');
  }, [plan]);

  // Ask for a new arrangement of the days still to come. Nothing changes until the student accepts.
  async function handleReplan(fitChoice, reason) {
    if (reason) reasonRef.current = reason;
    setError('');
    setInfo('');
    setHighlight(null);
    setWorking('Working out a new rhythm…');
    try {
      const result = await api('/plan/replan', { method: 'POST', body: { today: localToday(), reason: reasonRef.current, fitChoice } });
      if (result.status === 'needs_fit_choice') {
        setFit(result);
      } else if (result.status === 'up_to_date') {
        setFit(null);
        setInfo("You're all caught up. Your plan already fits everything that's left, so there's nothing to change.");
      } else {
        setFit(null);
        setPlan((p) => ({ ...p, pendingReplan: result.proposal }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking('');
    }
  }

  async function handleAccept() {
    const accepted = plan.pendingReplan;
    setError('');
    setWorking('Updating your plan…');
    try {
      const { plan: updated } = await api('/plan/replan/accept', { method: 'POST' });
      setPlan(updated);
      setHighlight(highlightFrom(accepted));
      setInfo('Your plan has been updated. The days that changed are softly highlighted.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking('');
    }
  }

  async function handleReject() {
    const rejected = plan.pendingReplan;
    setError('');
    setWorking('One moment…');
    try {
      const { plan: updated } = await api('/plan/replan/reject', { method: 'POST' });
      setPlan(updated);
      setInfo(
        rejected?.reason === 'edit'
          ? 'No problem. Your plan stays exactly as it is. You can review the changes again whenever you like.'
          : 'No problem. Your plan is exactly as it was, and the unfinished work is still open.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking('');
    }
  }

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
  const extraNote =
    adj?.extraPerDay > 0
      ? `Includes the extra ${formatHours(adj.extraPerDay)} a day you chose.`
      : adj?.extraDays?.length > 0
        ? `Includes the extra time you chose: ${adj.extraDays.map((d) => `${formatHours(d.hours)} on ${formatDay(d.date)}`).join(' and ')}.`
        : '';

  return (
    <>
      {working && (
        <div className="build-overlay" role="status" aria-live="polite">
          <div className="card stack build-card">
            <span className="spinner" aria-hidden="true" />
            <h2>{working}</h2>
            <p className="muted">This can take a few seconds.</p>
          </div>
        </div>
      )}
      <AppHeader />
      <main className="page">
        <div className="stack">
          <h1>Your plan</h1>
          <Notice tone="error">{error}</Notice>
          <Notice>{info}</Notice>
          {plan === undefined && !error && <p className="muted center">Loading…</p>}

          {plan?.stale && !pending && !fit && (
            <div className="card update-card" role="status">
              <p>
                <strong>Your courses or study hours have changed since this plan was made.</strong> We can suggest how your plan could
                adjust. You choose whether to accept it.
              </p>
              <button type="button" className="btn btn-primary" disabled={Boolean(working)} onClick={() => handleReplan(undefined, 'edit')}>
                Review plan changes
              </button>
            </div>
          )}

          {fit && (
            <div ref={fitRef}>
              <CantFitPanel data={fit} busy={Boolean(working)} onChoose={handleReplan} />
            </div>
          )}

          {pending && (
            <div ref={proposalRef}>
              <ReplanProposal proposal={pending} onAccept={handleAccept} onReject={handleReject} busy={Boolean(working)} />
            </div>
          )}

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
              <DayList days={plan.days} onPlanChange={setPlan} onReplan={() => handleReplan()} highlight={highlight} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
