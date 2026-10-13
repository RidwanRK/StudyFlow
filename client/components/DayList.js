'use client';

import { localToday } from '@/lib/dates';
import DayRow from './DayRow';

// The day-by-day list. Today is open and every other day is closed (or, if today isn't in the plan,
// the first upcoming day is open).
export default function DayList({ days }) {
  const today = localToday();
  const openDate = days.find((d) => d.date === today)?.date ?? days.find((d) => d.date > today)?.date;

  return (
    <ul className="day-list">
      {days.map((day) => (
        <DayRow key={day.date} day={day} defaultOpen={day.date === openDate} isToday={day.date === today} isPast={day.date < today} />
      ))}
    </ul>
  );
}
