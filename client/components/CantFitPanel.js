'use client';

import { formatDay, formatHours } from '@/lib/dates';

// Shown when the topics can't fit into the student's hours before the exams. Kind, never alarming.
// Props: data = { shortfall, options: { daily, extraDays } } from the server, onChoose('daily' | 'extra_days' | 'keep'), busy.
export default function CantFitPanel({ data, onChoose, busy }) {
  const { shortfall, options } = data;
  const extraDays = options.extraDays?.days ?? [];

  return (
    <section className="card stack fit-panel" aria-labelledby="fit-title">
      <div>
        <h2 id="fit-title">Your hours are a little tight</h2>
        <p>
          Your topics need about <strong>{formatHours(shortfall)}</strong> more than your study time allows before your exams. That&apos;s
          okay. It happens to almost everyone, and there are a few easy ways forward. You choose.
        </p>
      </div>

      <div className="fit-options">
        {options.daily && (
          <div className="fit-option">
            <h3>Add {formatHours(options.daily.extraPerDay)} to each day</h3>
            <p className="muted">A little extra every day until your last exam. Nothing gets left out.</p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onChoose('daily')}>
              Add hours every day
            </button>
          </div>
        )}

        {options.extraDays && (
          <div className="fit-option">
            <h3>
              Add extra time on {extraDays.length === 1 ? 'one day' : 'two days'}
            </h3>
            <p className="muted">
              {extraDays.map((d) => `${formatHours(d.hours)} on ${formatDay(d.date)}`).join(' and ')}. A bit more effort on just{' '}
              {extraDays.length === 1 ? 'that day' : 'those days'}, and nothing gets left out.
            </p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onChoose('extra_days')}>
              Add extra {extraDays.length === 1 ? 'day' : 'days'}
            </button>
          </div>
        )}

        <div className="fit-option">
          <h3>Keep my hours</h3>
          <p className="muted">
            We&apos;ll build a lighter plan that fits your hours, starting with the topics that matter most. You may not cover everything,
            and that&apos;s okay.
          </p>
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => onChoose('keep')}>
            Build a lighter plan
          </button>
        </div>
      </div>
    </section>
  );
}
