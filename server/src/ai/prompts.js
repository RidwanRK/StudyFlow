// What we tell Gemini. The server supplies every id, date and hour amount, so Gemini only has to arrange
// the work across days and explain itself; the server then verifies the arrangement (planner/validate.js).

export const GENERATE_INSTRUCTIONS = [
  'You are the planner inside StudyFlow, a calm and encouraging study-planning app for university students.',
  'You receive JSON describing the days a student can study (with capacityHours) and the topics to schedule.',
  'Build a day-by-day timetable with these rules, all of which are checked by code afterwards:',
  '1. For every topic, schedule EXACTLY hoursToSchedule hours in total, no more and no less.',
  "2. Never put more hours on a day than that day's capacityHours. Each day has its own capacityHours (they differ between days), so check every day against its own number.",
  '3. Every block of a topic must be on a date on or before that topic\'s lastAllowedDate.',
  '4. Use blocks of 0.5 hours or more, in steps of 0.5. Several blocks of different topics may share a day.',
  '5. Topics with a lower priorityRank matter more: schedule earlier exams and harder topics earlier, and spread a long topic over several days rather than one huge block.',
  '6. Use only the topicId and date values you were given. Only include days that have at least one block.',
  "7. For each day, set totalHours to the sum of its blocks. Before answering, check that every day's totalHours is at most its capacityHours and that every topic's hours add up to exactly hoursToSchedule. When the days are almost full, never go over a day's capacityHours: move work to a day with room instead.",
  'In "reasons", give one short, kind sentence per topic about why you placed it where you did. In "note", write one or two reassuring sentences summarising the plan.',
  'Reply with JSON only, matching the requested schema.',
].join('\n');

// Everything Gemini needs to know, as one JSON message.
export function buildGenerateInput({ startDate, days, topics, lighter = false }) {
  return {
    task: 'generate',
    ...(lighter && {
      lighterPlan: true,
      lighterPlanNote: "The student's hours were too few for everything, so hoursToSchedule were reduced on purpose. In your note, do not say everything will be covered or that there is plenty of time; be warm and encouraging about making steady progress on what matters most.",
    }),
    startDate,
    days: days.filter((d) => d.capacity > 0).map((d) => ({ date: d.date, capacityHours: d.capacity })),
    topics: topics.map((t) => ({
      topicId: t.topicId,
      course: t.courseName,
      name: t.name,
      difficulty: t.difficulty,
      lastAllowedDate: t.lastAllowedDate,
      hoursToSchedule: t.hoursToSchedule,
      priorityRank: t.priorityRank,
    })),
  };
}

// On a retry the same input is sent again with the previous answer and the problems found in it.
export function withProblems(input, problems, previousSchedule) {
  return {
    ...input,
    previousAnswer: previousSchedule?.days?.map((d) => ({ date: d.date, totalHours: d.totalHours, blocks: d.blocks })),
    previousAnswerProblems: problems,
    retryNote: 'Your previous answer broke the rules above. Fix every listed problem, changing as little else as possible, then answer again.',
  };
}
