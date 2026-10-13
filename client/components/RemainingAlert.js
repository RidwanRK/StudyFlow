import { formatHours } from '@/lib/dates';
import { hoursLeft, unfinishedBlocks } from '@/lib/plan';

// A gentle banner on a day that was moved forward without replanning. Nothing in the plan changes.
export default function RemainingAlert({ day }) {
  const open = unfinishedBlocks(day);
  if (day.resolution !== 'moved_forward' || open.length === 0) return null;

  return (
    <div className="remaining-alert" role="status">
      <strong>Still open from this day</strong>
      <ul>
        {open.map((b) => (
          <li key={b.blockId}>
            {b.courseName}: {b.topicName}, {formatHours(hoursLeft(b))} still open.
          </li>
        ))}
      </ul>
      <p className="muted">Your plan hasn&apos;t changed. You can replan whenever you like.</p>
    </div>
  );
}
