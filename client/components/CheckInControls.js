'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { formatHours } from '@/lib/dates';
import { hoursLeft, unfinishedBlocks } from '@/lib/plan';
import Notice from './Notice';

const OPTIONS = [
  ['completed', 'Completed'],
  ['partial', 'Partly done'],
  ['untouched', 'Untouched'],
];

// Marks stored for a block, as the form edits them.
function marksFrom(day) {
  const marks = {};
  for (const b of day.blocks) {
    if (b.status !== 'pending') {
      marks[b.blockId] = { status: b.status, hoursStudied: b.status === 'partial' ? String(b.hoursStudied) : '', needsMoreTime: b.needsMoreTime };
    }
  }
  return marks;
}

// End-of-day check-in for one day: mark each block, save, then choose Replan or Move forward when something is unfinished.
// Props: day, today (local date), onPlanChange(plan).
export default function CheckInControls({ day, today, onPlanChange }) {
  const [marks, setMarks] = useState(() => marksFrom(day));
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const saved = marksFrom(day);
  const dirty = JSON.stringify(marks) !== JSON.stringify(saved);
  const markedCount = Object.keys(marks).length;
  const unfinished = unfinishedBlocks(day);

  function setMark(blockId, patch) {
    setNote('');
    setMarks((m) => ({ ...m, [blockId]: { status: 'completed', hoursStudied: '', needsMoreTime: false, ...m[blockId], ...patch } }));
  }

  async function handleSave() {
    setError('');
    setNote('');
    setBusy(true);
    try {
      const items = Object.entries(marks).map(([blockId, m]) => ({
        blockId,
        status: m.status,
        hoursStudied: m.status === 'partial' ? m.hoursStudied : undefined,
        needsMoreTime: m.status === 'partial' ? m.needsMoreTime : undefined,
      }));
      const { plan } = await api('/plan/checkin', { method: 'PUT', body: { date: day.date, today, items } });
      onPlanChange(plan);
      // Show what the server actually stored (hours are rounded to half hours).
      setMarks(marksFrom(plan.days.find((d) => d.date === day.date)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveForward() {
    setError('');
    setBusy(true);
    try {
      const { plan } = await api('/plan/move-forward', { method: 'POST', body: { date: day.date } });
      onPlanChange(plan);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="checkin" aria-label={`Check-in for ${day.date}`}>
      <h3>How did this day go?</h3>

      <ul className="checkin-list">
        {day.blocks.map((block) => {
          const mark = marks[block.blockId];
          const studied = Number(mark?.hoursStudied);
          const left =
            mark?.status === 'partial' && Number.isFinite(studied) && studied > 0
              ? Math.max(0, block.hours - Math.round(studied * 2) / 2)
              : mark?.status === 'untouched'
                ? block.hours
                : null;
          return (
            <li key={block.blockId} className="checkin-item">
              <div className="checkin-title">
                <strong>{block.courseName}</strong>: {block.topicName} <span className="muted">({formatHours(block.hours)})</span>
              </div>
              <div className="segmented" role="group" aria-label={`How did ${block.topicName} go?`}>
                {OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`seg ${mark?.status === value ? 'seg-on' : ''}`}
                    aria-pressed={mark?.status === value}
                    onClick={() => setMark(block.blockId, { status: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mark?.status === 'partial' && (
                <div className="partial-row">
                  <label className="field">
                    <span>Hours you studied</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.5"
                      max={block.hours}
                      step="0.5"
                      value={mark.hoursStudied}
                      onChange={(e) => setMark(block.blockId, { hoursStudied: e.target.value })}
                    />
                  </label>
                  <label className="tick">
                    <input type="checkbox" checked={mark.needsMoreTime} onChange={(e) => setMark(block.blockId, { needsMoreTime: e.target.checked })} />
                    <span>I still need more time on this</span>
                  </label>
                </div>
              )}

              {left !== null && left > 0 && <p className="hours-left">{formatHours(left)} left</p>}
            </li>
          );
        })}
      </ul>

      <Notice tone="error">{error}</Notice>
      <Notice>{note}</Notice>

      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy || markedCount === 0 || !dirty}>
          {busy ? 'Saving…' : 'Save check-in'}
        </button>
        {!dirty && markedCount > 0 && <span className="saved-note">✓ Check-in saved</span>}
      </div>

      {!dirty && markedCount > 0 && unfinished.length === 0 && day.blocks.every((b) => b.status === 'completed') && (
        <p className="all-done">Lovely work. Everything on this day is done.</p>
      )}

      {!dirty && unfinished.length > 0 && day.resolution === null && (
        <div className="decision">
          <p>
            <strong>No worries, it happens.</strong> What would you like to do about the {formatHours(unfinished.reduce((s, b) => s + hoursLeft(b), 0))} that is still open?
          </p>
          <div className="button-row">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setNote('Replanning arrives in the next step of the build.')}>
              Replan
            </button>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={handleMoveForward}>
              Move forward
            </button>
          </div>
          <p className="muted">Replan suggests a new rhythm for you to accept or not. Move forward keeps your plan exactly as it is.</p>
        </div>
      )}
    </section>
  );
}
