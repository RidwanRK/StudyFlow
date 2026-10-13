import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { capacityFor, dayCapacities } from '../src/planner/capacity.js';
import { rankTopics } from '../src/planner/priority.js';
import { topicsToSchedule } from '../src/planner/remaining.js';
import { checkFit } from '../src/planner/fit.js';
import { validateSchedule } from '../src/planner/validate.js';

// 2030-01-07 is a Monday, 2030-01-12 a Saturday, 2030-01-13 a Sunday.
const setup = { weekdayHours: 3, weekendHours: 5, dayOverrides: [{ weekday: 0, hours: 2 }] };

describe('capacity', () => {
  test('weekday, weekend and a per-weekday override', () => {
    assert.equal(capacityFor('2030-01-07', setup), 3); // Monday
    assert.equal(capacityFor('2030-01-12', setup), 5); // Saturday
    assert.equal(capacityFor('2030-01-13', setup), 2); // Sunday override, Saturday untouched
  });

  test('accepted extra hours are added', () => {
    const adjustment = { extraPerDay: 1, extraDays: [{ date: '2030-01-07', hours: 0.5 }] };
    assert.equal(capacityFor('2030-01-07', setup, adjustment), 4.5);
    assert.equal(capacityFor('2030-01-08', setup, adjustment), 4);
  });

  test('dayCapacities lists every date in the range', () => {
    const days = dayCapacities({ startDate: '2030-01-11', endDate: '2030-01-13', setup });
    assert.deepEqual(days, [
      { date: '2030-01-11', capacity: 3 },
      { date: '2030-01-12', capacity: 5 },
      { date: '2030-01-13', capacity: 2 },
    ]);
  });
});

describe('priority', () => {
  test('earlier exam first, then harder, then name', () => {
    const ranked = rankTopics([
      { name: 'B', difficulty: 'easy', examDate: '2030-02-01' },
      { name: 'A', difficulty: 'easy', examDate: '2030-02-01' },
      { name: 'C', difficulty: 'hard', examDate: '2030-02-01' },
      { name: 'Z', difficulty: 'easy', examDate: '2030-01-20' },
    ]);
    assert.deepEqual(
      ranked.map((t) => [t.name, t.priorityRank]),
      [['Z', 1], ['C', 2], ['A', 3], ['B', 4]],
    );
  });
});

describe('topicsToSchedule', () => {
  test('skips courses whose exam is today or past, and sets the last allowed day', () => {
    const courses = [
      { _id: 'c1', name: 'Bio', examDate: '2030-01-10', topics: [{ _id: 't1', name: 'Cells', difficulty: 'hard', hoursNeeded: 2 }] },
      { _id: 'c2', name: 'Old', examDate: '2030-01-07', topics: [{ _id: 't2', name: 'X', difficulty: 'easy', hoursNeeded: 1 }] },
    ];
    const topics = topicsToSchedule(courses, '2030-01-07');
    assert.equal(topics.length, 1);
    assert.equal(topics[0].topicId, 't1');
    assert.equal(topics[0].lastAllowedDate, '2030-01-09');
  });
});

describe('fit check', () => {
  const days = [
    { date: '2030-01-07', capacity: 3 },
    { date: '2030-01-08', capacity: 3 },
    { date: '2030-01-09', capacity: 3 },
  ];

  test('fits when every deadline has enough hours', () => {
    const result = checkFit(days, [{ lastAllowedDate: '2030-01-09', hoursToSchedule: 9 }]);
    assert.equal(result.fits, true);
    assert.equal(result.shortfall, 0);
  });

  test('is short by the right amount when the total is too big', () => {
    const result = checkFit(days, [{ lastAllowedDate: '2030-01-09', hoursToSchedule: 10.5 }]);
    assert.equal(result.fits, false);
    assert.equal(result.shortfall, 1.5);
  });

  test('catches a tight early deadline even when the total fits', () => {
    // 5h are due by Jan 8 but only 6h exist... fine; 7h due by Jan 8 is short by 1h although 9h total fit.
    const topics = [
      { lastAllowedDate: '2030-01-08', hoursToSchedule: 7 },
      { lastAllowedDate: '2030-01-09', hoursToSchedule: 2 },
    ];
    const result = checkFit(days, topics);
    assert.equal(result.fits, false);
    assert.equal(result.shortfall, 1);
    assert.equal(result.worst.deadline, '2030-01-08');
  });

  test('a deadline before the first day has no capacity at all', () => {
    const result = checkFit(days, [{ lastAllowedDate: '2030-01-06', hoursToSchedule: 1 }]);
    assert.equal(result.fits, false);
    assert.equal(result.shortfall, 1);
  });
});

describe('validateSchedule: the check that stands between Gemini and the student', () => {
  const context = () => ({
    days: new Map([
      ['2030-01-07', 3],
      ['2030-01-08', 3],
      ['2030-01-09', 3],
    ]),
    topics: new Map([
      ['a', { lastAllowedDate: '2030-01-09', hoursToSchedule: 4 }],
      ['b', { lastAllowedDate: '2030-01-08', hoursToSchedule: 2 }],
    ]),
  });

  const good = () => ({
    days: [
      { date: '2030-01-07', blocks: [{ topicId: 'b', hours: 2 }, { topicId: 'a', hours: 1 }] },
      { date: '2030-01-08', blocks: [{ topicId: 'a', hours: 3 }] },
    ],
    reasons: [],
    note: '',
  });

  test('accepts a good schedule', () => {
    const result = validateSchedule(good(), context());
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  });

  test('rejects a day that goes over the available hours', () => {
    const schedule = good();
    schedule.days[0].blocks[1].hours = 2; // Jan 7 now has 4h, capacity 3 (and topic a totals 5h)
    const result = validateSchedule(schedule, context());
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('2030-01-07') && e.includes('only 3')));
  });

  test('rejects a topic scheduled after its own exam deadline', () => {
    const schedule = good();
    schedule.days.push({ date: '2030-01-09', blocks: [{ topicId: 'b', hours: 1 }] });
    schedule.days[0].blocks[0].hours = 1; // keep b's total at 2h so only the deadline rule is broken
    const result = validateSchedule(schedule, context());
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('after its last allowed date')));
  });

  test('rejects wrong total hours for a topic (too few and too many)', () => {
    const few = good();
    few.days[1].blocks[0].hours = 2; // a: 3h instead of 4h
    assert.ok(validateSchedule(few, context()).errors.some((e) => e.includes('exactly 4')));

    const many = good();
    many.days.push({ date: '2030-01-09', blocks: [{ topicId: 'a', hours: 1 }] }); // a: 5h
    assert.ok(validateSchedule(many, context()).errors.some((e) => e.includes('exactly 4')));
  });

  test('rejects a topic that was left out entirely', () => {
    const schedule = good();
    schedule.days[0].blocks = schedule.days[0].blocks.filter((b) => b.topicId !== 'b');
    const result = validateSchedule(schedule, context());
    assert.ok(result.errors.some((e) => e.includes('Topic b has 0 hours')));
  });

  test('rejects an unknown topic id', () => {
    const schedule = good();
    schedule.days[1].blocks.push({ topicId: 'made-up', hours: 0.5 });
    assert.ok(validateSchedule(schedule, context()).errors.some((e) => e.includes('Unknown topicId "made-up"')));
  });

  test('rejects a date outside the study window', () => {
    const schedule = good();
    schedule.days.push({ date: '2030-02-01', blocks: [{ topicId: 'a', hours: 1 }] });
    assert.ok(validateSchedule(schedule, context()).errors.some((e) => e.includes('outside the days available')));
  });

  test('rejects blocks that are not whole half-hours', () => {
    const schedule = good();
    schedule.days[0].blocks[1].hours = 0.75;
    assert.ok(validateSchedule(schedule, context()).errors.some((e) => e.includes('steps of 0.5')));
  });
});
