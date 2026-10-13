import { randomUUID } from 'node:crypto';
import { Course } from '../models/Course.js';
import { Plan } from '../models/Plan.js';
import { Setup } from '../models/Setup.js';
import { HttpError } from '../middleware/errorHandler.js';
import { InvalidAnswerError, requestSchedule } from '../ai/gemini.js';
import { GENERATE_INSTRUCTIONS, buildGenerateInput, withProblems } from '../ai/prompts.js';
import { addDays, eachDay } from '../lib/dates.js';
import { dayCapacities } from './capacity.js';
import { checkFit } from './fit.js';
import { rankTopics } from './priority.js';
import { topicsToSchedule } from './remaining.js';
import { validateSchedule } from './validate.js';

const FRIENDLY_FAILURE = "We couldn't build this just now. Your details are saved, so please try again in a moment.";

// Ask Gemini for a schedule, check it, and try once more (telling it what was wrong) if it breaks a rule.
// Nothing is saved here, and a bad answer is never returned.
async function scheduleWithValidation({ instructions, input, context }) {
  let problems = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const schedule = await requestSchedule({ instructions, input: problems ? withProblems(input, problems) : input });
      const result = validateSchedule(schedule, context);
      if (result.ok) return schedule;
      problems = result.errors.slice(0, 10);
      console.warn(`Gemini's schedule broke ${result.errors.length} rule(s) (attempt ${attempt}):`, problems);
    } catch (err) {
      if (!(err instanceof InvalidAnswerError)) {
        // Bad key, no access to the model, rate limit, timeout...: the student gets the friendly message, we get the real error.
        console.error('Gemini call failed:', err.message ?? err);
        throw new HttpError(502, FRIENDLY_FAILURE);
      }
      problems = [err.message];
      console.warn(`Gemini's answer was unusable (attempt ${attempt}): ${err.message}`);
    }
  }
  throw new HttpError(502, FRIENDLY_FAILURE);
}

// Merge repeated blocks of one topic on one day and order each day by priority.
function buildDays({ schedule, rankedTopics, window, lastExam, courses }) {
  const byId = new Map(rankedTopics.map((t) => [t.topicId, t]));
  const scheduledByDate = new Map();
  for (const day of schedule.days) {
    const merged = scheduledByDate.get(day.date) ?? new Map();
    for (const block of day.blocks) merged.set(block.topicId, (merged.get(block.topicId) ?? 0) + block.hours);
    scheduledByDate.set(day.date, merged);
  }

  return eachDay(window.start, lastExam).map((date) => {
    const merged = scheduledByDate.get(date) ?? new Map();
    const blocks = [...merged]
      .map(([topicId, hours]) => ({ topic: byId.get(topicId), hours }))
      .sort((a, b) => a.topic.priorityRank - b.topic.priorityRank)
      .map(({ topic, hours }) => ({
        blockId: randomUUID(),
        topicId: topic.topicId,
        courseName: topic.courseName,
        topicName: topic.name,
        hours,
        status: 'pending',
        hoursStudied: 0,
        needsMoreTime: false,
      }));
    return { date, exams: courses.filter((c) => c.examDate === date).map((c) => c.name), resolution: null, blocks };
  });
}

// Generate a fresh plan from the saved setup and courses, starting today. Replaces any existing plan.
export async function generatePlan({ userId, today }) {
  const [setup, courses] = await Promise.all([Setup.findOne({ userId }).lean(), Course.find({ userId }).lean()]);
  if (!setup) throw new HttpError(400, 'Please set your study hours first.');

  const rankedTopics = rankTopics(topicsToSchedule(courses, today));
  if (rankedTopics.length === 0) {
    throw new HttpError(400, 'Add a course with at least one topic and an exam date that is still ahead to build your plan.');
  }

  const lastExam = rankedTopics.reduce((latest, t) => (t.examDate > latest ? t.examDate : latest), today);
  const days = dayCapacities({ startDate: today, endDate: addDays(lastExam, -1), setup, adjustment: {} });

  // Plain arithmetic first: if the hours can't fit, don't ask the AI for the impossible.
  // (A later build step replaces this message with the "can't fit" options.)
  const fit = checkFit(days, rankedTopics);
  if (!fit.fits) {
    throw new HttpError(
      422,
      `These topics need about ${fit.shortfall} more hours than you have before your exams. Options for this are coming in the next build step. For now, you could add study hours or trim a topic.`,
    );
  }

  const context = {
    days: new Map(days.map((d) => [d.date, d.capacity])),
    topics: new Map(rankedTopics.map((t) => [t.topicId, { lastAllowedDate: t.lastAllowedDate, hoursToSchedule: t.hoursToSchedule }])),
  };
  const schedule = await scheduleWithValidation({
    instructions: GENERATE_INSTRUCTIONS,
    input: buildGenerateInput({ startDate: today, days, topics: rankedTopics }),
    context,
  });

  const plan = {
    userId,
    generatedAt: new Date(),
    startDate: today,
    note: schedule.note,
    capacityAdjustment: { extraPerDay: 0, extraDays: [] },
    days: buildDays({ schedule, rankedTopics, window: { start: today }, lastExam, courses }),
    pendingReplan: null,
  };
  return Plan.findOneAndReplace({ userId }, plan, { upsert: true, returnDocument: 'after' });
}
