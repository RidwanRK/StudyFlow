// The fit check and the "can't fit" suggestions: plain arithmetic, no AI.
// A topic must finish before its exam, so for every exam date we compare the hours of all topics due by then
// with the study capacity of the days available before it. If every deadline has enough capacity, a valid
// schedule exists. The worst shortfall tells us how much more time the student would need.
//
// days:   [{ date, capacity }] — the schedulable days, in date order
// topics: [{ lastAllowedDate, hoursToSchedule, ... }]

const MAX_DAY_HOURS = 24;
const MAX_EXTRA_PER_DAY = 4; // "add x hours to each day" beyond this is not a kind suggestion
const MAX_EXTRA_ON_ONE_DAY = 3; // "add y hours on one or two days": at most 3 extra hours on each
const roundUpHalf = (n) => Math.ceil(n * 2) / 2;

export function checkFit(days, topics) {
  const deadlines = [...new Set(topics.map((t) => t.lastAllowedDate))].sort();
  const perDeadline = deadlines.map((deadline) => {
    const needed = topics.filter((t) => t.lastAllowedDate <= deadline).reduce((sum, t) => sum + t.hoursToSchedule, 0);
    const window = days.filter((d) => d.date <= deadline);
    const available = window.reduce((sum, d) => sum + d.capacity, 0);
    return { deadline, needed, available, shortfall: Math.max(0, needed - available), windowDays: window.length };
  });
  const worst = perDeadline.reduce((a, b) => (b.shortfall > a.shortfall ? b : a), { shortfall: 0 });
  return { fits: worst.shortfall === 0, shortfall: worst.shortfall, worst, perDeadline };
}

// Adds an accepted adjustment ({ extraPerDay, extraDays: [{ date, hours }] }) to the day capacities.
export function adjustDays(days, { extraPerDay = 0, extraDays = [] } = {}) {
  return days.map((d) => ({
    date: d.date,
    capacity: d.capacity + extraPerDay + (extraDays.find((e) => e.date === d.date)?.hours ?? 0),
  }));
}

// "Add x hours to each day": x is the shortfall spread over the tight window, rounded up to half hours,
// then re-checked against every deadline (raised in half-hour steps until it really fits).
function dailyOption(days, topics, fit) {
  if (fit.worst.windowDays === 0) return null;
  for (let x = roundUpHalf(fit.shortfall / fit.worst.windowDays); x <= MAX_EXTRA_PER_DAY; x += 0.5) {
    const adjusted = adjustDays(days, { extraPerDay: x });
    if (adjusted.some((d) => d.capacity > MAX_DAY_HOURS)) return null;
    if (checkFit(adjusted, topics).fits) return { extraPerDay: x };
  }
  return null;
}

// "Add y hours on one or two days": only when the shortfall is small (at most 2 days x 3 extra hours).
// The extra hours go on the roomiest days inside the tight window (weekends first), and the result is re-checked.
function extraDaysOption(days, topics, fit) {
  if (fit.shortfall > 2 * MAX_EXTRA_ON_ONE_DAY) return null;
  const window = days.filter((d) => d.date <= fit.worst.deadline).sort((a, b) => b.capacity - a.capacity || a.date.localeCompare(b.date));
  const count = Math.min(fit.shortfall <= MAX_EXTRA_ON_ONE_DAY ? 1 : 2, window.length);
  if (count === 0) return null;
  const hours = roundUpHalf(fit.shortfall / count);
  if (hours > MAX_EXTRA_ON_ONE_DAY) return null;
  const chosen = window.slice(0, count).sort((a, b) => a.date.localeCompare(b.date));
  if (chosen.some((d) => d.capacity + hours > MAX_DAY_HOURS)) return null;
  const extraDays = chosen.map((d) => ({ date: d.date, hours }));
  return checkFit(adjustDays(days, { extraDays }), topics).fits ? { days: extraDays } : null;
}

// Suggestions to offer when the plan doesn't fit. Either may be null (not possible or not sensible).
export function fitOptions(days, topics, fit = checkFit(days, topics)) {
  if (fit.fits) return { daily: null, extraDays: null };
  return { daily: dailyOption(days, topics, fit), extraDays: extraDaysOption(days, topics, fit) };
}
