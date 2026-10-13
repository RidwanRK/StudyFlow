// Dates in StudyFlow are plain "YYYY-MM-DD" text. "Today" normally comes from the student's browser
// (so time zones never cause surprises); the server's own date is only a fallback.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function serverToday() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Day of the week for an ISO date: 0 = Sunday ... 6 = Saturday.
export function weekdayOf(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  const pad = (x) => String(x).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// ISO dates compare correctly as plain strings.
export const isBefore = (a, b) => a < b;

// Every date from start to end, both included.
export function eachDay(startIso, endIso) {
  const days = [];
  for (let d = startIso; d <= endIso; d = addDays(d, 1)) days.push(d);
  return days;
}
