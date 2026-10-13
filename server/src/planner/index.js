import { randomUUID } from 'node:crypto';
import { Course } from '../models/Course.js';
import { Plan } from '../models/Plan.js';
import { Setup } from '../models/Setup.js';
import { HttpError } from '../middleware/errorHandler.js';
import { InvalidAnswerError, requestSchedule } from '../ai/gemini.js';
import {
  GENERATE_INSTRUCTIONS,
  REPLAN_INSTRUCTIONS,
  buildGenerateInput,
  buildReplanInput,
  withProblems,
} from '../ai/prompts.js';
import { addDays, eachDay } from '../lib/dates.js';
import { dayCapacities } from './capacity.js';
import { diffSchedules, groundReasons } from './diff.js';
import { checkFit, fitOptions } from './fit.js';
import { lighten } from './lighten.js';
import { rankTopics } from './priority.js';
import { remainingPerTopic, topicsToSchedule } from './remaining.js';
import { repairSchedule } from './repair.js';
import { applyProposal, creditedPerTopic, effectiveTargets, mergeAdjustments, replanStart, whatHappened } from './replan.js';
import { validateSchedule } from './validate.js';

const MAX_ATTEMPTS = 3; // the first answer plus up to two corrected ones
const FRIENDLY_FAILURE = "We couldn't build this just now. Your details are saved, so please try again in a moment.";
const FIT_CHOICES = ['daily', 'extra_days', 'keep'];
const NO_ADJUSTMENT = { extraPerDay: 0, extraDays: [] };

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

// The consoling message for a lighter plan: kind, and it names the topics that matter most.
function lighterMessage({ important, dropped }) {
  const names = important.map((t) => `${t.courseName}: ${t.name}`).join(', ');
  const left = dropped.length ? ' A few smaller topics were left out for now.' : '';
  return `You may not cover everything, and that's okay. Start with these, they matter most: ${names}.${left}`;
}

// Plain arithmetic first: if the hours can't fit, don't ask the AI for the impossible.
// Either the topics fit (nothing changes), or the student has to choose (returns needsChoice), or their choice is applied:
//   'daily' / 'extra_days' add hours (returned as `added`), 'keep' shrinks the topics into a lighter plan.
// `daysFor(added)` rebuilds the day capacities with the added hours on top of whatever was already adjusted.
function resolveFit({ days, topics, fitChoice, daysFor }) {
  const fit = checkFit(days, topics);
  if (fit.fits) return { days, topics, added: NO_ADJUSTMENT, message: '' };

  const options = fitOptions(days, topics, fit);
  if (!fitChoice) return { needsChoice: { status: 'needs_fit_choice', shortfall: fit.shortfall, options } };

  if (fitChoice === 'keep') {
    const lighter = lighten(days, topics);
    if (lighter.topics.length === 0) {
      throw new HttpError(422, 'There is no study time before your first exam with your current hours. Adding some study hours would let us build a plan.');
    }
    return { days, topics: lighter.topics, added: NO_ADJUSTMENT, message: lighterMessage(lighter) };
  }

  const option = fitChoice === 'daily' ? options.daily : options.extraDays;
  if (!option) throw new HttpError(400, 'That option is not available any more. Please try again.');
  const added = fitChoice === 'daily' ? { extraPerDay: option.extraPerDay, extraDays: [] } : { extraPerDay: 0, extraDays: option.days };
  return { days: daysFor(added), topics, added, message: '' };
}

function checkFitChoice(fitChoice) {
  if (fitChoice && !FIT_CHOICES.includes(fitChoice)) throw new HttpError(400, 'That option is not available. Please try again.');
}

const scheduleContext = (days, topics) => ({
  days: new Map(days.map((d) => [d.date, d.capacity])),
  topics: new Map(topics.map((t) => [t.topicId, { lastAllowedDate: t.lastAllowedDate, hoursToSchedule: t.hoursToSchedule }])),
});

// ---------------------------------------------------------------------------------------------------------------------
// Generate

// Generate a fresh plan from the saved setup and courses, starting today. Replaces any existing plan.
//
// Returns { status: 'ready', plan } or, when the hours don't fit and the student hasn't chosen yet,
// { status: 'needs_fit_choice', shortfall, options }. `fitChoice` is one of:
//   'daily'      add x hours to each day            (the server recomputes x; the browser only names the choice)
//   'extra_days' add y hours on one or two days
//   'keep'       keep my hours: build a lighter plan
export async function generatePlan({ userId, today, fitChoice }) {
  checkFitChoice(fitChoice);

  const [setup, courses] = await Promise.all([Setup.findOne({ userId }).lean(), Course.find({ userId }).lean()]);
  if (!setup) throw new HttpError(400, 'Please set your study hours first.');

  const allTopics = rankTopics(topicsToSchedule(courses, today));
  if (allTopics.length === 0) {
    throw new HttpError(400, 'Add a course with at least one topic and an exam date that is still ahead to build your plan.');
  }

  const lastExam = allTopics.reduce((latest, t) => (t.examDate > latest ? t.examDate : latest), today);
  const daysFor = (adjustment) => dayCapacities({ startDate: today, endDate: addDays(lastExam, -1), setup, adjustment });

  const fit = resolveFit({ days: daysFor(NO_ADJUSTMENT), topics: allTopics, fitChoice, daysFor });
  if (fit.needsChoice) return fit.needsChoice;
  const { days, topics, added, message } = fit;

  const schedule = await scheduleWithValidation({
    instructions: GENERATE_INSTRUCTIONS,
    input: buildGenerateInput({ startDate: today, days, topics, lighter: Boolean(message) }),
    context: scheduleContext(days, topics),
  });

  // `hours` is what each topic was scheduled for (less than `needed` in a lighter plan, 0 for a topic left out).
  const scheduledHours = new Map(topics.map((t) => [t.topicId, t.hoursToSchedule]));
  const plan = {
    userId,
    generatedAt: new Date(),
    startDate: today,
    note: schedule.note,
    lighterMessage: message,
    targets: allTopics.map((t) => ({ topicId: t.topicId, hours: scheduledHours.get(t.topicId) ?? 0, needed: t.hoursToSchedule })),
    capacityAdjustment: added,
    days: buildDays({ schedule, rankedTopics: topics, window: { start: today }, lastExam, courses }),
    pendingReplan: null,
  };
  const saved = await Plan.findOneAndReplace({ userId }, plan, { upsert: true, returnDocument: 'after' });
  return { status: 'ready', plan: saved };
}

// ---------------------------------------------------------------------------------------------------------------------
// Replan

// Work out what is left, ask Gemini to reshuffle the days that have not been lived yet, check its answer, work out what
// really moved, and store the result as a PENDING proposal. Nothing about the plan changes until the student accepts.
//
// reason: 'fell_behind' (the student checked in and chose Replan) or 'edit' (they changed their courses or hours).
// Returns { status: 'proposal', proposal } | { status: 'needs_fit_choice', ... } | { status: 'up_to_date' }.
export async function replanPlan({ userId, today, reason = 'fell_behind', fitChoice }) {
  checkFitChoice(fitChoice);

  const [planDoc, setup, courses] = await Promise.all([Plan.findOne({ userId }), Setup.findOne({ userId }).lean(), Course.find({ userId }).lean()]);
  if (!planDoc) throw new HttpError(404, 'You do not have a plan yet. Generate one first.');
  if (!setup) throw new HttpError(400, 'Please set your study hours first.');
  const plan = planDoc.toObject();

  const start = replanStart(plan, today);
  const targets = effectiveTargets(plan, courses);
  const remaining = remainingPerTopic({ ...plan, targets });

  const allTopics = rankTopics(
    topicsToSchedule(courses, start)
      .filter((t) => remaining.has(t.topicId))
      .map((t) => ({ ...t, hoursToSchedule: remaining.get(t.topicId) })),
  );
  if (allTopics.length === 0) return { status: 'up_to_date' };

  const lastExam = allTopics.reduce((latest, t) => (t.examDate > latest ? t.examDate : latest), start);
  const base = plan.capacityAdjustment ?? NO_ADJUSTMENT;
  const daysFor = (added) => dayCapacities({ startDate: start, endDate: addDays(lastExam, -1), setup, adjustment: mergeAdjustments(base, added) });

  const fit = resolveFit({ days: daysFor(NO_ADJUSTMENT), topics: allTopics, fitChoice, daysFor });
  if (fit.needsChoice) return fit.needsChoice;
  const { days, topics, added, message } = fit;

  // The old schedule from `start` onward, as the starting point Gemini should disturb as little as possible.
  const oldDays = plan.days
    .filter((d) => d.date >= start)
    .map((d) => ({ date: d.date, blocks: d.blocks.map((b) => ({ topicId: b.topicId, hours: b.hours })) }));
  const labels = new Map(allTopics.map((t) => [t.topicId, `${t.courseName}: ${t.name}`]));
  for (const day of plan.days) for (const b of day.blocks) if (!labels.has(b.topicId)) labels.set(b.topicId, `${b.courseName}: ${b.topicName}`);

  const facts = whatHappened(plan, start);
  const context = scheduleContext(days, topics);

  // Nothing new went wrong and the schedule already covers exactly what is left: there is nothing to suggest.
  if (reason !== 'edit' && facts.length === 0 && validateSchedule({ days: oldDays.filter((d) => d.blocks.length > 0) }, context).ok) {
    return { status: 'up_to_date' };
  }

  const schedule = await scheduleWithValidation({
    instructions: REPLAN_INSTRUCTIONS,
    input: buildReplanInput({
      startDate: start,
      days,
      topics,
      previousSchedule: oldDays.filter((d) => d.blocks.length > 0),
      whatHappened: facts,
      reason: reason === 'edit' ? 'edited_setup' : 'fell_behind',
      lighter: Boolean(message),
    }),
    context,
  });

  const newDays = buildDays({ schedule, rankedTopics: topics, window: { start }, lastExam, courses });
  const moves = groundReasons(
    diffSchedules(
      oldDays,
      newDays.map((d) => ({ date: d.date, blocks: d.blocks.map((b) => ({ topicId: b.topicId, hours: b.hours })) })),
      { reasons: schedule.reasons, labels },
    ),
    facts,
  );

  // New targets: what has been studied so far plus what is now scheduled, so "remaining" stays right after accepting.
  const credited = creditedPerTopic(plan);
  const scheduledNow = new Map(topics.map((t) => [t.topicId, t.hoursToSchedule]));
  const newTargets = targets.map((t) =>
    scheduledNow.has(t.topicId) || remaining.has(t.topicId)
      ? { ...t, hours: (credited.get(t.topicId) ?? 0) + (scheduledNow.get(t.topicId) ?? 0) }
      : t,
  );

  const proposal = {
    reason,
    createdAt: new Date(),
    startDate: start,
    days: newDays,
    capacityAdjustment: mergeAdjustments(base, added),
    targets: newTargets,
    lighterMessage: message,
    moves,
    note: schedule.note,
  };
  planDoc.pendingReplan = proposal;
  planDoc.markModified('pendingReplan');
  await planDoc.save();
  return { status: 'proposal', proposal };
}

// Accept the stored proposal: swap it into the plan.
export async function acceptReplan({ userId }) {
  const planDoc = await Plan.findOne({ userId });
  if (!planDoc) throw new HttpError(404, 'You do not have a plan yet. Generate one first.');
  if (!planDoc.pendingReplan) throw new HttpError(400, 'There is no suggested change waiting. Please try replanning again.');

  const applied = applyProposal(planDoc.toObject(), planDoc.pendingReplan);
  planDoc.days = applied.days;
  planDoc.capacityAdjustment = applied.capacityAdjustment;
  planDoc.targets = applied.targets;
  planDoc.lighterMessage = applied.lighterMessage;
  planDoc.note = applied.note;
  planDoc.pendingReplan = null;
  planDoc.markModified('pendingReplan');
  await planDoc.save();
  return planDoc;
}

// Reject: throw the proposal away. The plan and the unresolved day stay exactly as they were.
export async function rejectReplan({ userId }) {
  const planDoc = await Plan.findOne({ userId });
  if (!planDoc) throw new HttpError(404, 'You do not have a plan yet. Generate one first.');
  planDoc.pendingReplan = null;
  planDoc.markModified('pendingReplan');
  await planDoc.save();
  return planDoc;
}
