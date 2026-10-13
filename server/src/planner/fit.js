// The fit check: plain arithmetic, no AI.
// A topic must finish before its exam, so for every exam date we compare the hours of all topics due by then
// with the study capacity of the days available before it. If every deadline has enough capacity, a valid
// schedule exists. The worst shortfall tells us how much more time the student would need.
//
// days:   [{ date, capacity }] — the schedulable days, in date order
// topics: [{ lastAllowedDate, hoursToSchedule, ... }]
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
