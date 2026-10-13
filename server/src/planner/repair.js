// Small, deterministic fix-ups for a schedule that is nearly right.
//
// Gemini decides how the work is arranged, but it sometimes slips on arithmetic (3.5 hours on a day with 3 free,
// or one topic a half hour short). Rather than throw a good arrangement away, the server nudges it: blocks that
// can't be used are dropped, each topic is trimmed or topped up to exactly its hours, and any day that is over its
// capacity has half-hours moved to the nearest day with room that is still before the topic's deadline.
// The result is always re-checked by validateSchedule; if it can't be repaired, null is returned.
//
// context is the same as for validateSchedule: { days: Map date -> capacity, topics: Map topicId -> { lastAllowedDate, hoursToSchedule } }

const STEP = 0.5;

export function repairSchedule(schedule, { days, topics }) {
  const dates = [...days.keys()].sort();
  const indexOf = new Map(dates.map((d, i) => [d, i]));
  const grid = new Map(dates.map((d) => [d, new Map()])); // date -> Map(topicId -> hours)

  // 1. Keep only blocks that could be valid: known topic, a study day, not after the topic's deadline.
  for (const day of schedule.days) {
    if (!grid.has(day.date)) continue;
    for (const block of day.blocks) {
      const topic = topics.get(block.topicId);
      const hours = Math.round(block.hours / STEP) * STEP;
      if (!topic || day.date > topic.lastAllowedDate || hours < STEP) continue;
      const cell = grid.get(day.date);
      cell.set(block.topicId, (cell.get(block.topicId) ?? 0) + hours);
    }
  }

  const dayTotal = (date) => [...grid.get(date).values()].reduce((a, b) => a + b, 0);
  const spare = (date) => days.get(date) - dayTotal(date);
  const add = (date, topicId, hours) => grid.get(date).set(topicId, (grid.get(date).get(topicId) ?? 0) + hours);
  const remove = (date, topicId, hours) => {
    const left = grid.get(date).get(topicId) - hours;
    if (left <= 0) grid.get(date).delete(topicId);
    else grid.get(date).set(topicId, left);
  };
  const topicTotal = (topicId) => dates.reduce((sum, d) => sum + (grid.get(d).get(topicId) ?? 0), 0);

  // Frees half an hour on some day on or before `deadline` by moving another topic's block to a day it is allowed to use.
  const makeRoom = (forTopicId, deadline) => {
    for (const date of dates.filter((d) => d <= deadline)) {
      for (const otherId of grid.get(date).keys()) {
        if (otherId === forTopicId) continue;
        const target = dates
          .filter((d) => d !== date && d <= topics.get(otherId).lastAllowedDate && spare(d) >= STEP)
          .sort((a, b) => Math.abs(indexOf.get(a) - indexOf.get(date)) - Math.abs(indexOf.get(b) - indexOf.get(date)) || a.localeCompare(b))[0];
        if (target) {
          remove(date, otherId, STEP);
          add(target, otherId, STEP);
          return true;
        }
      }
    }
    return false;
  };

  // 2. Every topic gets exactly its hours (earliest deadlines first): trim from its latest days, or top up on the
  //    roomiest days before its deadline, making room by moving other topics' blocks when needed.
  const byDeadline = [...topics].sort((a, b) => a[1].lastAllowedDate.localeCompare(b[1].lastAllowedDate));
  for (const [topicId, topic] of byDeadline) {
    let excess = topicTotal(topicId) - topic.hoursToSchedule;
    for (let i = dates.length - 1; i >= 0 && excess > 0; i--) {
      const have = grid.get(dates[i]).get(topicId) ?? 0;
      const cut = Math.min(have, excess);
      if (cut > 0) {
        remove(dates[i], topicId, cut);
        excess -= cut;
      }
    }
    let missing = topic.hoursToSchedule - topicTotal(topicId);
    while (missing > 0) {
      let candidates = dates.filter((d) => d <= topic.lastAllowedDate && spare(d) >= STEP);
      if (candidates.length === 0) {
        if (!makeRoom(topicId, topic.lastAllowedDate)) return null;
        continue;
      }
      candidates.sort((a, b) => spare(b) - spare(a) || a.localeCompare(b));
      add(candidates[0], topicId, STEP);
      missing -= STEP;
    }
  }

  // 3. Days over their capacity: move half-hours to the nearest day with room that the topic is allowed to use.
  for (const date of dates) {
    while (dayTotal(date) > days.get(date)) {
      // Try the topics with the most flexible deadlines first.
      const movable = [...grid.get(date).keys()].sort((a, b) => topics.get(b).lastAllowedDate.localeCompare(topics.get(a).lastAllowedDate));
      let moved = false;
      for (const topicId of movable) {
        const targets = dates
          .filter((d) => d !== date && d <= topics.get(topicId).lastAllowedDate && spare(d) >= STEP)
          .sort((a, b) => Math.abs(indexOf.get(a) - indexOf.get(date)) - Math.abs(indexOf.get(b) - indexOf.get(date)) || a.localeCompare(b));
        if (targets.length > 0) {
          remove(date, topicId, STEP);
          add(targets[0], topicId, STEP);
          moved = true;
          break;
        }
      }
      if (!moved) return null;
    }
  }

  const resultDays = dates
    .map((date) => {
      const blocks = [...grid.get(date)].map(([topicId, hours]) => ({ topicId, hours }));
      return { date, totalHours: blocks.reduce((s, b) => s + b.hours, 0), blocks };
    })
    .filter((d) => d.blocks.length > 0);
  return { ...schedule, days: resultDays };
}
