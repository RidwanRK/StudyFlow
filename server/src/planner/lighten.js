import { checkFit } from './fit.js';

// The lighter plan, for a student who keeps their hours: every topic's hours are scaled by one ratio so every
// deadline fits (rounded down to half hours). Topics that shrink to nothing are left out. Because `topics` carry a
// priorityRank (earlier exams, then harder topics), the first few are named as the ones to start with.
export function lighten(days, topics) {
  const fit = checkFit(days, topics);
  const ratio = Math.min(1, ...fit.perDeadline.map((p) => (p.needed > 0 ? p.available / p.needed : 1)));

  const scaled = topics.map((t) => ({ ...t, hoursToSchedule: Math.floor(t.hoursToSchedule * ratio * 2) / 2 }));
  const kept = scaled.filter((t) => t.hoursToSchedule > 0);
  const dropped = scaled.filter((t) => t.hoursToSchedule === 0);
  const important = [...kept].sort((a, b) => a.priorityRank - b.priorityRank).slice(0, 3);

  return { ratio, topics: kept, dropped, important };
}
