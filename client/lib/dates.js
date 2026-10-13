// Dates in StudyFlow are plain "YYYY-MM-DD" text. "Today" always comes from the student's own browser.

const pad = (n) => String(n).padStart(2, '0');

export function toIso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localToday() {
  return toIso(new Date());
}

export function localTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toIso(d);
}

function parse(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "Tue, 5 Mar"
export function formatDay(iso) {
  return parse(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// "5 March 2030"
export function formatLong(iso) {
  return parse(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

// Show hours without a pointless ".0": 2 -> "2h", 2.5 -> "2.5h"
export function formatHours(h) {
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}
