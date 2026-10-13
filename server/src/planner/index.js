import { randomUUID } from 'node:crypto';
import { Course } from '../models/Course.js';
import { Plan } from '../models/Plan.js';
import { Setup } from '../models/Setup.js';
import { HttpError } from '../middleware/errorHandler.js';
import { InvalidAnswerError, requestSchedule } from '../ai/gemini.js';
import { GENERATE_INSTRUCTIONS, buildGenerateInput, withProblems } from '../ai/prompts.js';
import { addDays, eachDay } from '../lib/dates.js';
import { dayCapacities } from './capacity.js';
import { checkFit, fitOptions } from './fit.js';
import { lighten } from './lighten.js';
import { rankTopics } from './priority.js';
import { topicsToSchedule } from './remaining.js';
import { repairSchedule } from './repair.js';
import { validateSchedule } from './validate.js';

const MAX_ATTEMPTS = 3; // the first answer plus up to two corrected ones
const FRIENDLY_FAILURE = "We couldn't build this just now. Your details are saved, so please try again in a moment.";

// Ask Gemini for a schedule, check it, and try again (showing it what was wrong) if it breaks a rule.
// Nothing is saved here, and a bad answer is never returned.
async function scheduleWithValidation({ instructions, input, context }) {
  let problems = null;
  let previous = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const schedule = await requestSchedule({ instructions, input: problems ? withProblems(input, problems, previous) : input });
      const result = validateSchedule(schedule, context);
      if (result.ok) return schedule;
      // A small slip (a half hour too many on a day, a topic a little short): nudge it locally instead of
      // throwing a good arrangement away. The repaired schedule must pass the full validator.
      const repaired = repairSchedule(schedule, context);
      if (repaired && validateSchedule(repaired, context).ok) {
        console.warn(`Gemini's schedule was repaired locally (attempt ${attempt}):`, result.errors.slice(0, 5));
        return repaired;
      }
      previous = schedule;
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

const FIT_CHOICES = ['daily', 'extra_days', 'keep'];

// The consoling message for a lighter plan: kind, and it names the topics that matter most.
function lighterMessage({ important, dropped }) {
  const names = important.map((t) => `${t.courseName}: ${t.name}`).join(', ');
  const left = dropped.length ? ' A few smaller topics were left out for now.' : '';
  return `You may not cover everything, and that's okay. Start with these, they matter most: ${names}.${left}`;
}

// Generate a fresh plan from the saved setup and courses, starting today. Replaces any existing plan.
//
// Returns { status: 'ready', plan } or, when the hours don't fit and the student hasn't chosen yet,
// { status: 'needs_fit_choice', shortfall, options }. `fitChoice` is one of:
//   'daily'      add x hours to each day            (the server recomputes x; the browser only names the choice)
//   'extra_days' add y hours on one or two days
//   'keep'       keep my hours: build a lighter plan
export async function generatePlan({ userId, today, fitChoice }) {
  if (fitChoice && !FIT_CHOICES.includes(fitChoice)) throw new HttpError(400, 'That option is not available. Please try again.');

  const [setup, courses] = await Promise.all([Setup.findOne({ userId }).lean(), Course.find({ userId }).lean()]);
  if (!setup) throw new HttpError(400, 'Please set your study hours first.');

  let topics = rankTopics(topicsToSchedule(courses, today));
  if (topics.length === 0) {
    throw new HttpError(400, 'Add a course with at least one topic and an exam date that is still ahead to build your plan.');
  }

  const lastExam = topics.reduce((latest, t) => (t.examDate > latest ? t.examDate : latest), today);
  const window = { startDate: today, endDate: addDays(lastExam, -1), setup };
  let adjustment = { extraPerDay: 0, extraDays: [] };
  let days = dayCapacities({ ...window, adjustment });
  let message = '';

  // Plain arithmetic first: if the hours can't fit, don't ask the AI for the impossible.
  const fit = checkFit(days, topics);
  if (!fit.fits) {
    const options = fitOptions(days, topics, fit);
    if (!fitChoice) return { status: 'needs_fit_choice', shortfall: fit.shortfall, options };

    if (fitChoice === 'daily') {
      if (!options.daily) throw new HttpError(400, 'That option is not available any more. Please try again.');
      adjustment = { extraPerDay: options.daily.extraPerDay, extraDays: [] };
    } else if (fitChoice === 'extra_days') {
      if (!options.extraDays) throw new HttpError(400, 'That option is not available any more. Please try again.');
      adjustment = { extraPerDay: 0, extraDays: options.extraDays.days };
    } else {
      const lighter = lighten(days, topics);
      if (lighter.topics.length === 0) {
        throw new HttpError(422, 'There is no study time before your first exam with your current hours. Adding some study hours would let us build a plan.');
      }
      topics = lighter.topics;
      message = lighterMessage(lighter);
    }
    days = dayCapacities({ ...window, adjustment });
  }

  const context = {
    days: new Map(days.map((d) => [d.date, d.capacity])),
    topics: new Map(topics.map((t) => [t.topicId, { lastAllowedDate: t.lastAllowedDate, hoursToSchedule: t.hoursToSchedule }])),
  };
  const schedule = await scheduleWithValidation({
    instructions: GENERATE_INSTRUCTIONS,
    input: buildGenerateInput({ startDate: today, days, topics, lighter: Boolean(message) }),
    context,
  });

  const plan = {
    userId,
    generatedAt: new Date(),
    startDate: today,
    note: schedule.note,
    lighterMessage: message,
    targets: topics.map((t) => ({ topicId: t.topicId, hours: t.hoursToSchedule })),
    capacityAdjustment: adjustment,
    days: buildDays({ schedule, rankedTopics: topics, window: { start: today }, lastExam, courses }),
    pendingReplan: null,
  };
  const saved = await Plan.findOneAndReplace({ userId }, plan, { upsert: true, returnDocument: 'after' });
  return { status: 'ready', plan: saved };
}
