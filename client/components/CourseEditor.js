'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { formatLong, localToday, localTomorrow } from '@/lib/dates';
import Notice from './Notice';
import TopicRow from './TopicRow';

const blankTopic = () => ({ name: '', difficulty: 'medium', hoursNeeded: '2' });

function draftFrom(course) {
  if (!course) return { name: '', examDate: '', topics: [blankTopic()] };
  return {
    name: course.name,
    examDate: course.examDate,
    topics: course.topics.map((t) => ({ id: t.id, name: t.name, difficulty: t.difficulty, hoursNeeded: String(t.hoursNeeded) })),
  };
}

// Edits one course (or, with no `course`, creates a new one). Changes stay in the form until "Save course".
// Props: course (saved course or null), onSaved(course), onDeleted(id).
export default function CourseEditor({ course = null, onSaved, onDeleted }) {
  const isNew = !course;
  const [draft, setDraft] = useState(() => draftFrom(course));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function updateTopic(index, patch) {
    setDraft((d) => ({ ...d, topics: d.topics.map((t, i) => (i === index ? { ...t, ...patch } : t)) }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const body = { name: draft.name, examDate: draft.examDate, topics: draft.topics, today: localToday() };
      const { course: saved } = isNew
        ? await api('/courses', { method: 'POST', body })
        : await api(`/courses/${course.id}`, { method: 'PUT', body });
      onSaved(saved);
      if (isNew) setDraft(draftFrom(null));
      else {
        setDraft(draftFrom(saved));
        setMessage('Saved.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove ${course.name} and its topics?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/courses/${course.id}`, { method: 'DELETE' });
      onDeleted(course.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="card stack course-card">
      <h2>{isNew ? 'Add a course' : course.name}</h2>
      {!isNew && <p className="muted">Exam on {formatLong(course.examDate)}</p>}

      <div className="row-2">
        <label className="field">
          <span>Course name</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Biology" required />
        </label>
        <label className="field">
          <span>Exam date</span>
          <input type="date" min={isNew ? localTomorrow() : undefined} value={draft.examDate} onChange={(e) => setDraft({ ...draft, examDate: e.target.value })} required />
        </label>
      </div>

      <div className="stack">
        <h3>Topics to cover</h3>
        {draft.topics.map((topic, i) => (
          <TopicRow
            key={topic.id ?? `new-${i}`}
            topic={topic}
            onChange={(patch) => updateTopic(i, patch)}
            onRemove={() => setDraft((d) => ({ ...d, topics: d.topics.filter((_, idx) => idx !== i) }))}
          />
        ))}
        <button type="button" className="btn btn-quiet align-start" onClick={() => setDraft((d) => ({ ...d, topics: [...d.topics, blankTopic()] }))}>
          + Add a topic
        </button>
      </div>

      <Notice tone="error">{error}</Notice>
      <Notice>{message}</Notice>
      <div className="button-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : isNew ? 'Add course' : 'Save course'}
        </button>
        {!isNew && (
          <button type="button" className="btn btn-quiet" onClick={handleDelete} disabled={busy}>
            Remove course
          </button>
        )}
      </div>
    </form>
  );
}
