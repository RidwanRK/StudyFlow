'use client';

import { useState } from 'react';
import { formatDay, formatHours } from '@/lib/dates';
import CheckInControls from './CheckInControls';
import RemainingAlert from './RemainingAlert';

// One day of the plan: a collapsed row that opens into that day's hour blocks.
export default function DayRow({ day, today, onPlanChange, onReplan, highlight, defaultOpen = false, isToday = false, isPast = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const total = day.blocks.reduce((sum, b) => sum + b.hours, 0);
  const examOnly = day.blocks.length === 0 && day.exams.length > 0;
  const canCheckIn = day.blocks.length > 0 && day.date <= today;
  const movedHere = highlight?.get(day.date);
  const allDone = day.blocks.length > 0 && day.blocks.every((b) => b.status === 'completed');

  return (
    <li className={`day ${open ? 'day-open' : ''} ${isPast ? 'day-past' : ''}`}>
      <button type="button" className="day-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="day-title">
          {formatDay(day.date)}
          {isToday && <span className="chip chip-today">Today</span>}
          {day.exams.length > 0 && <span className="chip chip-exam">Exam: {day.exams.join(', ')}</span>}
          {allDone && <span className="chip chip-done">Done</span>}
          {day.resolution === 'moved_forward' && <span className="chip chip-open">Moved forward</span>}
        </span>
        <span className="day-meta">
          {day.blocks.length > 0 ? formatHours(total) : examOnly ? 'Exam day' : 'Rest'}
          <span className="chevron" aria-hidden="true" />
        </span>
      </button>

      <div className="day-body">
        <div className="day-body-inner">
          {day.blocks.length === 0 ? (
            <p className="muted">{examOnly ? 'Good luck, you have got this.' : 'Nothing planned. A little rest helps too.'}</p>
          ) : (
            <>
              <RemainingAlert day={day} />
              {canCheckIn ? (
                <CheckInControls key={JSON.stringify(day.blocks.map((b) => [b.blockId, b.status, b.hoursStudied, b.needsMoreTime]))} day={day} today={today} onPlanChange={onPlanChange} onReplan={onReplan} moved={movedHere} />
              ) : (
                <ul className="blocks">
                  {day.blocks.map((block) => (
                    <li key={block.blockId} className={`block ${movedHere?.has(block.topicId) ? 'block-moved' : ''}`}>
                      <span>
                        <strong>{block.courseName}</strong>: {block.topicName}
                      </span>
                      <span className="block-hours">{formatHours(block.hours)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
