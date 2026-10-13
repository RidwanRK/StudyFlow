'use client';

import { formatDay, formatHours } from '@/lib/dates';
import { movedKeys } from '@/lib/plan';

const list = (dates) => dates.map(formatDay).join(', ');

// The replan proposal: what would move and why, the proposed days with moved blocks softly highlighted, and Accept / Reject.
// Nothing in the saved plan has changed yet. Props: proposal, onAccept(), onReject(), busy.
export default function ReplanProposal({ proposal, onAccept, onReject, busy }) {
  const moved = movedKeys(proposal);
  const days = proposal.days.filter((d) => d.blocks.length > 0);

  return (
    <section className="card stack proposal" aria-labelledby="proposal-title">
      <div>
        <h2 id="proposal-title">{proposal.reason === 'edit' ? 'Here is how your plan could adjust' : "No worries, let's find a new rhythm"}</h2>
        <p>{proposal.note}</p>
      </div>

      {proposal.lighterMessage && <p className="proposal-lighter">{proposal.lighterMessage}</p>}

      {proposal.moves.length === 0 ? (
        <p className="muted">Everything already fits what is left, so nothing needs to move.</p>
      ) : (
        <div className="stack">
          <h3>What would move, and why</h3>
          <ul className="moves">
            {proposal.moves.map((move) => (
              <li key={move.topicId} className="move">
                <strong>{move.label}</strong>
                <span className="move-dates">
                  {move.from.length > 0 && <span className="move-from">{list(move.from)}</span>}
                  {move.from.length > 0 && move.to.length > 0 && <span aria-label="moves to"> → </span>}
                  {move.from.length === 0 && move.to.length > 0 && <span className="muted">Added on </span>}
                  {move.to.length > 0 && <span className="move-to">{list(move.to)}</span>}
                  {move.to.length === 0 && <span className="muted"> no longer needed</span>}
                </span>
                <span className="move-reason">{move.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="proposed-days">
        <summary>See the proposed days</summary>
        <ul className="proposed-list">
          {days.map((day) => (
            <li key={day.date} className="proposed-day">
              <strong>{formatDay(day.date)}</strong>
              <ul className="blocks">
                {day.blocks.map((block) => (
                  <li key={block.blockId} className={`block ${moved.has(`${day.date}|${block.topicId}`) ? 'block-moved' : ''}`}>
                    <span>
                      <strong>{block.courseName}</strong>: {block.topicName}
                    </span>
                    <span className="block-hours">{formatHours(block.hours)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>

      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={onAccept} disabled={busy}>
          Accept these changes
        </button>
        <button type="button" className="btn btn-quiet" onClick={onReject} disabled={busy}>
          Keep my plan as it is
        </button>
      </div>
      <p className="muted">Nothing changes until you accept. If you keep your plan, the unfinished work stays open so you can choose again.</p>
    </section>
  );
}
