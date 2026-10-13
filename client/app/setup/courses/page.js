'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { localToday } from '@/lib/dates';
import AppHeader from '@/components/AppHeader';
import CantFitPanel from '@/components/CantFitPanel';
import CourseEditor from '@/components/CourseEditor';
import Notice from '@/components/Notice';
import SetupNav from '@/components/SetupNav';

export default function CoursesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState('');
  const [hasPlan, setHasPlan] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState('');
  const [fit, setFit] = useState(null); // the server's "can't fit" answer, while the student chooses
  const fitRef = useRef(null);
  // Every course card registers here so Generate can save anything still pending first.
  const registry = useRef(new Map());
  const [newHasContent, setNewHasContent] = useState(false);
  const [addingNew, setAddingNew] = useState(false); // the new-course form is always open until the first course exists
  const handlePendingChange = useCallback((key, isPending) => {
    if (key === 'new') setNewHasContent(isPending);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api('/courses')
      .then(({ courses: list }) => setCourses(list))
      .catch((err) => setError(err.message));
    api('/plan')
      .then(({ plan }) => setHasPlan(Boolean(plan)))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (fit) fitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [fit]);

  if (loading || !user) {
    return (
      <main className="page">
        <p className="muted center">Loading…</p>
      </main>
    );
  }

  const ready = (courses ?? []).some((c) => c.topics.length > 0) || newHasContent;
  // Save anything still in a form (a new course you haven't saved yet, or edits you haven't saved).
  // Returns false when a course was turned down; its card shows why.
  async function savePending() {
    for (const card of [...registry.current.values()].filter((c) => c.pending)) {
      if (!(await card.save())) return false;
    }
    return true;
  }

  // Ask for a plan. If the hours don't fit the server answers with options instead; the student picks one
  // and we ask again with fitChoice.
  async function requestPlan(fitChoice) {
    setBuildError('');
    setBuilding(true);
    try {
      if (!fitChoice && !(await savePending())) {
        setBuildError('One of your courses needs a little more information first. Please check the message on that course. Anything that was complete has been saved.');
        setBuilding(false);
        return;
      }
      const result = await api('/plan/generate', { method: 'POST', body: { today: localToday(), fitChoice } });
      if (result.status === 'needs_fit_choice') {
        setFit(result);
        setBuilding(false);
        return;
      }
      router.push('/plan');
    } catch (err) {
      setBuildError(err.message);
      setBuilding(false);
    }
  }

  function handleGenerate() {
    if (hasPlan && !window.confirm('This builds a fresh plan and replaces your current one, including any check-ins. Continue?')) return;
    setFit(null);
    requestPlan();
  }

  const sortByExam = (list) => [...list].sort((a, b) => a.examDate.localeCompare(b.examDate));

  return (
    <>
      <AppHeader />
      {building && (
        <div className="build-overlay" role="status" aria-live="polite">
          <div className="card stack build-card">
            <span className="spinner" aria-hidden="true" />
            <h2>Building your plan…</h2>
            <p className="muted">We&apos;re saving your courses and laying out your days. This can take a few seconds.</p>
          </div>
        </div>
      )}
      <main className="page">
        <SetupNav current="courses" />
        <div className="stack">
          <div>
            <h1>What are you studying for?</h1>
            <p className="muted">Add each course with its exam date, then the topics to cover. We&apos;ll use difficulty and exam dates to decide what comes first.</p>
          </div>

          <Notice tone="error">{error}</Notice>
          {courses === null && !error && <p className="muted center">Loading…</p>}

          <div className="course-grid">
          {(courses ?? []).map((course) => (
            <CourseEditor
              key={course.id}
              course={course}
              registry={registry.current}
              regKey={course.id}
              onPendingChange={handlePendingChange}
              onSaved={(saved) => setCourses((list) => sortByExam(list.map((c) => (c.id === saved.id ? saved : c))))}
              onDeleted={(id) => setCourses((list) => list.filter((c) => c.id !== id))}
            />
          ))}

          {courses !== null && (courses.length === 0 || addingNew) && (
            <CourseEditor
              key={`new-${courses.length}`}
              registry={registry.current}
              regKey="new"
              onPendingChange={handlePendingChange}
              onCancel={courses.length > 0 ? () => setAddingNew(false) : undefined}
              onSaved={(saved) => {
                setCourses((list) => sortByExam([...list, saved]));
                setAddingNew(false);
              }}
            />
          )}
          {courses !== null && courses.length > 0 && !addingNew && (
            <button type="button" className="add-course-tile" onClick={() => setAddingNew(true)}>
              + Add another course
            </button>
          )}
          </div>

          {fit && (
            <div ref={fitRef}>
              <CantFitPanel data={fit} busy={building} onChoose={requestPlan} />
            </div>
          )}

          <div className="card stack generate-card">
            <button type="button" className="btn btn-primary" disabled={!ready || building} onClick={handleGenerate}>
              {hasPlan ? 'Rebuild my plan' : 'Generate plan'}
            </button>
            {!ready && <p className="muted">Add a course with at least one topic to build your plan.</p>}
            {hasPlan && !building && (
              <Link href="/plan" className="muted center">
                Back to my current plan
              </Link>
            )}
            <Notice tone="error">{buildError}</Notice>
          </div>
        </div>
      </main>
    </>
  );
}
