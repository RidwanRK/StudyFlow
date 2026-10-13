import { addDays } from '../lib/dates.js';

const roundUpHalf = (n) => Math.ceil(n * 2) / 2;

// Turns saved courses into the list of topics that need scheduling.
// Courses whose exam is today or already past are left out. A topic must finish the day before its exam.
// `hoursToSchedule` is the full requirement here; replans subtract work already done (see remainingPerTopic).
export function topicsToSchedule(courses, today) {
  const topics = [];
  for (const course of courses) {
    if (course.examDate <= today) continue;
    for (const topic of course.topics) {
      topics.push({
        topicId: String(topic._id),
        courseId: String(course._id),
        courseName: course.name,
        name: topic.name,
        difficulty: topic.difficulty,
        examDate: course.examDate,
        lastAllowedDate: addDays(course.examDate, -1),
        hoursToSchedule: topic.hoursNeeded,
      });
    }
  }
  return topics;
}

// Hours still open on one block, as the student sees them: partial = hours minus hours studied, untouched = all of it,
// completed or not yet checked in = nothing (a block that hasn't been checked in has not been "left unfinished").
export function hoursLeft(block) {
  if (block.status === 'partial') return Math.max(0, block.hours - block.hoursStudied);
  if (block.status === 'untouched') return block.hours;
  return 0;
}

// Hours of that block that still count as study done.
export function hoursCredited(block) {
  if (block.status === 'completed') return block.hours;
  if (block.status === 'partial') return Math.min(block.hours, Math.max(0, block.hoursStudied));
  return 0;
}

// The "still need more time on this" tick adds a buffer of half the block's planned hours, rounded up to 0.5h.
export function extraTimeBuffer(block) {
  return block.status === 'partial' && block.needsMoreTime ? roundUpHalf(block.hours * 0.5) : 0;
}

// What is left to study for each topic: its target hours (what the plan was built for) minus the study that really
// happened (completed blocks, and hours studied on partial ones), plus a buffer for blocks marked "still need more
// time". Never below zero. Returns a Map topicId -> hours (only topics that still have work left).
export function remainingPerTopic(plan) {
  const credited = new Map();
  const buffer = new Map();
  for (const day of plan.days) {
    for (const block of day.blocks) {
      credited.set(block.topicId, (credited.get(block.topicId) ?? 0) + hoursCredited(block));
      buffer.set(block.topicId, (buffer.get(block.topicId) ?? 0) + extraTimeBuffer(block));
    }
  }
  const remaining = new Map();
  for (const { topicId, hours } of plan.targets) {
    const left = Math.max(0, hours - (credited.get(topicId) ?? 0)) + (buffer.get(topicId) ?? 0);
    if (left > 0) remaining.set(topicId, left);
  }
  return remaining;
}
