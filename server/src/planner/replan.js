// The rules around a replan, as plain functions (no database, no AI).
import { addDays } from '../lib/dates.js';
import { hasUnfinished } from './checkin.js';
import { hoursCredited, hoursLeft } from './remaining.js';

// A replan reshuffles the days that have not been lived yet. If today already has check-in marks it is over, so the new
// schedule starts tomorrow; otherwise it starts today (this covers replanning the morning after a check-in, and edits).
export function replanStart(plan, today) {
  const todayDay = plan.days.find((d) => d.date === today);
  const todayIsDone = todayDay?.blocks.some((b) => b.status !== 'pending');
  return todayIsDone ? addDays(today, 1) : today;
}

// The hours each topic is being planned for. Normally what the plan was built with (a lighter plan keeps its smaller
// number). A topic added since, or whose hours the student edited, is planned for its current hours instead.
export function effectiveTargets(plan, courses) {
  const targets = [];
  for (const course of courses) {
    for (const topic of course.topics) {
      const topicId = String(topic._id);
      const known = plan.targets.find((t) => t.topicId === topicId);
      const unchanged = known && (known.needed === undefined || known.needed === topic.hoursNeeded);
      targets.push({ topicId, hours: unchanged ? known.hours : topic.hoursNeeded, needed: topic.hoursNeeded });
    }
  }
  return targets;
}

// Credited study hours per topic across the whole plan.
export function creditedPerTopic(plan) {
  const credited = new Map();
  for (const day of plan.days) {
    for (const block of day.blocks) credited.set(block.topicId, (credited.get(block.topicId) ?? 0) + hoursCredited(block));
  }
  return credited;
}

// What went wrong before `start`, in plain facts for Gemini to explain (and for its "what moved and why" reasons).
export function whatHappened(plan, start) {
  const facts = [];
  for (const day of plan.days) {
    if (day.date >= start || day.resolution === 'replanned') continue; // a replanned day has already been dealt with
    for (const block of day.blocks) {
      if (block.status !== 'partial' && block.status !== 'untouched') continue;
      facts.push({
        date: day.date,
        topicId: block.topicId,
        topic: `${block.courseName}: ${block.topicName}`,
        plannedHours: block.hours,
        studiedHours: block.status === 'partial' ? block.hoursStudied : 0,
        hoursLeft: hoursLeft(block),
        outcome: block.status === 'partial' ? 'only partly done' : 'not started',
        studentSaysNeedsMoreTime: Boolean(block.needsMoreTime),
      });
    }
  }
  return facts;
}

// Combine two capacity adjustments ({ extraPerDay, extraDays }) into one, adding hours that land on the same date.
export function mergeAdjustments(a = {}, b = {}) {
  const byDate = new Map();
  for (const e of [...(a.extraDays ?? []), ...(b.extraDays ?? [])]) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.hours);
  return {
    extraPerDay: (a.extraPerDay ?? 0) + (b.extraPerDay ?? 0),
    extraDays: [...byDate].map(([date, hours]) => ({ date, hours })).sort((x, y) => x.date.localeCompare(y.date)),
  };
}

// Applies an accepted proposal to a plan (plain objects in, plain fields out):
//  - days before the proposal's start stay exactly as they were (past marks are never changed); any of them that were
//    left unfinished are now "replanned", and their "still need more time" ticks are used up (the buffer is now in the plan)
//  - the proposal's days replace everything from its start onward
export function applyProposal(plan, proposal) {
  const frozen = plan.days
    .filter((d) => d.date < proposal.startDate)
    .map((d) => ({
      ...d,
      resolution: hasUnfinished(d.blocks) ? 'replanned' : d.resolution,
      blocks: d.blocks.map((b) => ({ ...b, needsMoreTime: false })),
    }));
  return {
    days: [...frozen, ...proposal.days],
    capacityAdjustment: proposal.capacityAdjustment,
    targets: proposal.targets,
    lighterMessage: proposal.lighterMessage ?? '',
    snapshot: proposal.snapshot ?? plan.snapshot,
    note: proposal.note ?? plan.note,
  };
}
