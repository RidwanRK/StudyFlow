import { eachDay, weekdayOf } from '../lib/dates.js';

// How many hours the student can study on one date: their weekday/weekend default, or the override for
// that day of the week, plus any extra hours they accepted from a "can't fit" suggestion.
export function capacityFor(date, setup, adjustment = {}) {
  const weekday = weekdayOf(date);
  const override = setup.dayOverrides?.find((o) => o.weekday === weekday);
  const isWeekend = weekday === 0 || weekday === 6;
  let hours = override ? override.hours : isWeekend ? setup.weekendHours : setup.weekdayHours;
  hours += adjustment.extraPerDay ?? 0;
  const extra = adjustment.extraDays?.find((e) => e.date === date);
  if (extra) hours += extra.hours;
  return hours;
}

// Every date from startDate to endDate (both included) with its capacity.
export function dayCapacities({ startDate, endDate, setup, adjustment }) {
  return eachDay(startDate, endDate).map((date) => ({ date, capacity: capacityFor(date, setup, adjustment) }));
}
