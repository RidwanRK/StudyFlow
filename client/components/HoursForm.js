'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { WEEKDAYS } from '@/lib/dates';
import Notice from './Notice';

// Weekday hours (X), weekend hours (Y), and optional overrides for single days of the week.
export default function HoursForm() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [weekday, setWeekday] = useState('3');
  const [weekend, setWeekend] = useState('5');
  const [overrides, setOverrides] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/setup')
      .then(({ setup }) => {
        if (setup) {
          setWeekday(String(setup.weekdayHours));
          setWeekend(String(setup.weekendHours));
          setOverrides(setup.dayOverrides.map((o) => ({ weekday: o.weekday, hours: String(o.hours) })));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const usedDays = new Set(overrides.map((o) => o.weekday));
  const nextFreeDay = [0, 1, 2, 3, 4, 5, 6].find((d) => !usedDays.has(d));

  function updateOverride(index, patch) {
    setOverrides((list) => list.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/setup', {
        method: 'PUT',
        body: {
          weekdayHours: weekday,
          weekendHours: weekend,
          dayOverrides: overrides.map((o) => ({ weekday: Number(o.weekday), hours: o.hours })),
        },
      });
      router.push('/setup/courses');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!loaded) return <p className="muted center">Loading…</p>;

  return (
    <form onSubmit={handleSubmit} className="card stack">
      <div>
        <h1>How much can you study?</h1>
        <p className="muted">Tell us your usual hours. A realistic number beats an ambitious one.</p>
      </div>

      <div className="row-2">
        <label className="field">
          <span>Weekdays (hours per day)</span>
          <input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={weekday} onChange={(e) => setWeekday(e.target.value)} required />
        </label>
        <label className="field">
          <span>Weekends (hours per day)</span>
          <input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={weekend} onChange={(e) => setWeekend(e.target.value)} required />
        </label>
      </div>

      <div className="stack">
        <div>
          <h2>Different on a particular day?</h2>
          <p className="muted">For example, a lighter Sunday. It applies to every Sunday, and the rest of the weekend stays as it is.</p>
        </div>
        {overrides.map((o, i) => (
          <div className="override-row" key={i}>
            <select aria-label="Day of the week" value={o.weekday} onChange={(e) => updateOverride(i, { weekday: Number(e.target.value) })}>
              {WEEKDAYS.map((name, d) => (
                <option key={d} value={d} disabled={d !== Number(o.weekday) && usedDays.has(d)}>
                  {name}
                </option>
              ))}
            </select>
            <input aria-label="Hours on that day" type="number" inputMode="decimal" min="0" max="24" step="0.5" value={o.hours} onChange={(e) => updateOverride(i, { hours: e.target.value })} required />
            <button type="button" className="btn btn-quiet" onClick={() => setOverrides((list) => list.filter((_, idx) => idx !== i))} aria-label="Remove this day">
              Remove
            </button>
          </div>
        ))}
        {nextFreeDay !== undefined && (
          <button type="button" className="btn btn-quiet align-start" onClick={() => setOverrides((list) => [...list, { weekday: nextFreeDay, hours: weekend }])}>
            + Customise a day
          </button>
        )}
      </div>

      <Notice tone="error">{error}</Notice>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save and continue'}
      </button>
    </form>
  );
}
