// Checks a schedule from Gemini against the rules. Gemini arranges the work; this code decides if the
// arrangement is acceptable, so a bad answer never reaches the student.
//
// schedule: { days: [{ date, blocks: [{ topicId, hours }] }], ... }  (already shape-checked by zod)
// context:
//   days:   Map  date -> capacity hours   (the schedulable window: every date a block may use)
//   topics: Map  topicId -> { lastAllowedDate, hoursToSchedule }
// Returns { ok, errors } where errors are plain sentences (they are also fed back to Gemini on a retry).
export function validateSchedule(schedule, { days, topics }) {
  const errors = [];
  const perDay = new Map();
  const perTopic = new Map();

  for (const day of schedule.days) {
    if (!days.has(day.date)) {
      errors.push(`Date ${day.date} is outside the days available for studying.`);
      continue;
    }
    for (const block of day.blocks) {
      if (!Number.isInteger(block.hours * 2) || block.hours < 0.5) {
        errors.push(`A block on ${day.date} has ${block.hours} hours; blocks must be at least 0.5 hours and in steps of 0.5.`);
      }
      const topic = topics.get(block.topicId);
      if (!topic) {
        errors.push(`Unknown topicId "${block.topicId}" on ${day.date}.`);
        continue;
      }
      if (day.date > topic.lastAllowedDate) {
        errors.push(`Topic ${block.topicId} is scheduled on ${day.date}, after its last allowed date ${topic.lastAllowedDate}.`);
      }
      perDay.set(day.date, (perDay.get(day.date) ?? 0) + block.hours);
      perTopic.set(block.topicId, (perTopic.get(block.topicId) ?? 0) + block.hours);
    }
  }

  for (const [date, total] of perDay) {
    const capacity = days.get(date);
    if (total > capacity) errors.push(`${date} has ${total} hours scheduled but only ${capacity} are available.`);
  }

  for (const [topicId, topic] of topics) {
    const scheduled = perTopic.get(topicId) ?? 0;
    if (scheduled !== topic.hoursToSchedule) {
      errors.push(`Topic ${topicId} has ${scheduled} hours scheduled but exactly ${topic.hoursToSchedule} are required.`);
    }
  }

  return { ok: errors.length === 0, errors };
}
