'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppHeader from '@/components/AppHeader';
import CourseEditor from '@/components/CourseEditor';
import Notice from '@/components/Notice';
import SetupNav from '@/components/SetupNav';

export default function CoursesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api('/courses')
      .then(({ courses: list }) => setCourses(list))
      .catch((err) => setError(err.message));
  }, [user]);

  if (loading || !user) {
    return (
      <main className="page">
        <p className="muted center">Loading…</p>
      </main>
    );
  }

  const ready = (courses ?? []).some((c) => c.topics.length > 0);
  const sortByExam = (list) => [...list].sort((a, b) => a.examDate.localeCompare(b.examDate));

  return (
    <>
      <AppHeader />
      <main className="page">
        <SetupNav current="courses" />
        <div className="stack">
          <div>
            <h1>What are you studying for?</h1>
            <p className="muted">Add each course with its exam date, then the topics to cover. We&apos;ll use difficulty and exam dates to decide what comes first.</p>
          </div>

          <Notice tone="error">{error}</Notice>
          {courses === null && !error && <p className="muted center">Loading…</p>}

          {(courses ?? []).map((course) => (
            <CourseEditor
              key={course.id}
              course={course}
              onSaved={(saved) => setCourses((list) => sortByExam(list.map((c) => (c.id === saved.id ? saved : c))))}
              onDeleted={(id) => setCourses((list) => list.filter((c) => c.id !== id))}
            />
          ))}

          {courses !== null && <CourseEditor key={`new-${courses.length}`} onSaved={(saved) => setCourses((list) => sortByExam([...list, saved]))} />}

          <div className="card stack generate-card">
            <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => setNote('Plan building arrives in the next step of the build.')}>
              Generate plan
            </button>
            {!ready && <p className="muted">Add a course with at least one topic to build your plan.</p>}
            <Notice>{note}</Notice>
          </div>
        </div>
      </main>
    </>
  );
}
