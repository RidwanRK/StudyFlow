// What actually moved between the old schedule and Gemini's new one. Gemini's reasons are attached to REAL moves
// only: a move with no reason gets a gentle generic one, and a reason for something that did not move is dropped.
//
// oldDays / newDays: [{ date, blocks: [{ topicId, hours }] }]  (only the part that is being re-planned)
// options.reasons:   [{ topicId, reason }] from Gemini
// options.labels:    Map topicId -> "Course: Topic"
// Returns [{ topicId, label, from: [dates], to: [dates], reason }]
//   from = dates where the topic had more hours before, to = dates where it has more hours now.

const FALLBACK_MOVED = 'Moved to fit the time you have left.';
const FALLBACK_REMOVED = "You don't need this any more.";

function hoursByTopicAndDate(days) {
  const result = new Map();
  for (const day of days) {
    for (const block of day.blocks) {
      const perDate = result.get(block.topicId) ?? new Map();
      perDate.set(day.date, (perDate.get(day.date) ?? 0) + block.hours);
      result.set(block.topicId, perDate);
    }
  }
  return result;
}

export function diffSchedules(oldDays, newDays, { reasons = [], labels = new Map() } = {}) {
  const before = hoursByTopicAndDate(oldDays);
  const after = hoursByTopicAndDate(newDays);
  const moves = [];

  for (const topicId of new Set([...before.keys(), ...after.keys()])) {
    const was = before.get(topicId) ?? new Map();
    const now = after.get(topicId) ?? new Map();
    const dates = [...new Set([...was.keys(), ...now.keys()])].sort();
    const from = dates.filter((d) => (was.get(d) ?? 0) > (now.get(d) ?? 0));
    const to = dates.filter((d) => (now.get(d) ?? 0) > (was.get(d) ?? 0));
    if (from.length === 0 && to.length === 0) continue;

    const given = reasons.find((r) => r.topicId === topicId)?.reason?.trim();
    moves.push({
      topicId,
      label: labels.get(topicId) ?? topicId,
      from,
      to,
      reason: given || (to.length > 0 ? FALLBACK_MOVED : FALLBACK_REMOVED),
    });
  }

  return moves.sort((a, b) => (a.to[0] ?? a.from[0]).localeCompare(b.to[0] ?? b.from[0]) || a.label.localeCompare(b.label));
}

// Gemini's reasons are friendly but not always accurate about days. A reason that names a weekday which is neither where the
// topic moved from/to nor a day that went wrong is replaced by a plain sentence built from the facts.
// facts: [{ date, topicId, hoursLeft, outcome }]  (see replan.js whatHappened)
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayName = (isoDate) => WEEKDAY_NAMES[new Date(isoDate + 'T00:00:00Z').getUTCDay()];
const hoursText = (h) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);

export function groundReasons(moves, facts = []) {
  return moves.map((move) => {
    const own = facts.filter((f) => f.topicId === move.topicId);
    const allowed = new Set([...move.from, ...move.to, ...own.map((f) => f.date)].map(weekdayName));
    const mentioned = WEEKDAY_NAMES.filter((name) => new RegExp(`\\b${name}\\b`, 'i').test(move.reason));
    if (mentioned.every((name) => allowed.has(name))) return move;

    const fact = own[0];
    const reason = fact
      ? `${hoursText(fact.hoursLeft)} was still open from ${weekdayName(fact.date)} (${fact.outcome}), so it has been placed again.`
      : FALLBACK_MOVED;
    return { ...move, reason };
  });
}
