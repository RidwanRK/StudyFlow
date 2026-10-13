import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { capacityFor, dayCapacities } from '../src/planner/capacity.js';
import { rankTopics } from '../src/planner/priority.js';
import { topicsToSchedule } from '../src/planner/remaining.js';
import { adjustDays, checkFit, fitOptions } from '../src/planner/fit.js';
import { lighten } from '../src/planner/lighten.js';
import { repairSchedule } from '../src/planner/repair.js';
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

describe("can't-fit options", () => {
  // 5 days x 3h = 15h available before Jan 11.
  const days = ['2030-01-07', '2030-01-08', '2030-01-09', '2030-01-10', '2030-01-11'].map((date) => ({ date, capacity: 3 }));
  const topic = (hours, extra = {}) => ({ lastAllowedDate: '2030-01-11', hoursToSchedule: hours, priorityRank: 1, ...extra });

  test('nothing to suggest when it already fits', () => {
    assert.deepEqual(fitOptions(days, [topic(15)]), { daily: null, extraDays: null });
  });

  test('daily option: shortfall spread over the window, rounded up to half hours, and it really fits', () => {
    const topics = [topic(17)]; // short by 2h over 5 days -> 0.4 -> 0.5h a day
    const { daily } = fitOptions(days, topics);
    assert.deepEqual(daily, { extraPerDay: 0.5 });
    assert.equal(checkFit(adjustDays(days, daily), topics).fits, true);
  });

  test('one-day option for a small shortfall goes on a single day and really fits', () => {
    const topics = [topic(17)];
    const { extraDays } = fitOptions(days, topics);
    assert.equal(extraDays.days.length, 1);
    assert.equal(extraDays.days[0].hours, 2);
    assert.equal(checkFit(adjustDays(days, { extraDays: extraDays.days }), topics).fits, true);
  });

  test('two-day option splits a bigger (but still small) shortfall', () => {
    const topics = [topic(20)]; // short by 5h -> two days of 2.5h
    const { extraDays } = fitOptions(days, topics);
    assert.deepEqual(extraDays.days.map((d) => d.hours), [2.5, 2.5]);
    assert.equal(checkFit(adjustDays(days, { extraDays: extraDays.days }), topics).fits, true);
  });

  test('the extra-days option is not offered for a large shortfall, the daily one may be', () => {
    const topics = [topic(23)]; // short by 8h: more than 2 days x 3h
    const options = fitOptions(days, topics);
    assert.equal(options.extraDays, null);
    assert.deepEqual(options.daily, { extraPerDay: 2 }); // 8h / 5 days = 1.6 -> 2h
  });

  test('neither option when far too much is needed', () => {
    const options = fitOptions(days, [topic(60)]);
    assert.equal(options.daily, null);
    assert.equal(options.extraDays, null);
  });

  test('extra hours go on the roomiest days (weekends) in the tight window', () => {
    // Jan 12 Saturday = 5h, Jan 13 Sunday = 5h, the rest 3h
    const week = [['2030-01-10', 3], ['2030-01-11', 3], ['2030-01-12', 5], ['2030-01-13', 5]].map(([date, capacity]) => ({ date, capacity }));
    const topics = [{ lastAllowedDate: '2030-01-13', hoursToSchedule: 17, priorityRank: 1 }]; // 16h available, short by 1h
    const { extraDays } = fitOptions(week, topics);
    assert.equal(extraDays.days.length, 1);
    assert.equal(extraDays.days[0].date, '2030-01-12');
  });
});

describe('lighter plan', () => {
  const days = ['2030-01-07', '2030-01-08'].map((date) => ({ date, capacity: 3 })); // 6h available
  const topics = [
    { topicId: 'a', name: 'A', lastAllowedDate: '2030-01-08', hoursToSchedule: 6, priorityRank: 1 },
    { topicId: 'b', name: 'B', lastAllowedDate: '2030-01-08', hoursToSchedule: 4, priorityRank: 2 },
    { topicId: 'c', name: 'C', lastAllowedDate: '2030-01-08', hoursToSchedule: 2, priorityRank: 3 },
  ]; // 12h needed for 6h available -> ratio 0.5

  test('scales every topic by one ratio and the result fits', () => {
    const result = lighten(days, topics);
    assert.equal(result.ratio, 0.5);
    assert.deepEqual(result.topics.map((t) => [t.topicId, t.hoursToSchedule]), [['a', 3], ['b', 2], ['c', 1]]);
    assert.equal(checkFit(days, result.topics).fits, true);
  });

  test('names the highest-priority topics as the ones to start with', () => {
    const result = lighten(days, topics);
    assert.deepEqual(result.important.map((t) => t.topicId), ['a', 'b', 'c']);
  });

  test('rounds down to half hours and drops topics that shrink to nothing', () => {
    const small = [
      { topicId: 'a', name: 'A', lastAllowedDate: '2030-01-08', hoursToSchedule: 10, priorityRank: 1 },
      { topicId: 'b', name: 'B', lastAllowedDate: '2030-01-08', hoursToSchedule: 0.5, priorityRank: 2 },
    ]; // 10.5h for 6h: ratio ~0.571 -> A 5.5 (5.71 rounded down), B 0.285 -> 0
    const result = lighten(days, small);
    assert.deepEqual(result.topics.map((t) => [t.topicId, t.hoursToSchedule]), [['a', 5.5]]);
    assert.deepEqual(result.dropped.map((t) => t.topicId), ['b']);
    assert.equal(checkFit(days, result.topics).fits, true);
  });

  test('changes nothing when everything already fits', () => {
    const fits = [{ topicId: 'a', name: 'A', lastAllowedDate: '2030-01-08', hoursToSchedule: 4, priorityRank: 1 }];
    const result = lighten(days, fits);
    assert.equal(result.ratio, 1);
    assert.equal(result.topics[0].hoursToSchedule, 4);
  });
});

describe('repairSchedule: nudging a nearly-right schedule from Gemini', () => {
  const context = () => ({
    days: new Map([['2030-01-07', 3], ['2030-01-08', 3], ['2030-01-09', 3]]),
    topics: new Map([
      ['a', { lastAllowedDate: '2030-01-09', hoursToSchedule: 5 }],
      ['b', { lastAllowedDate: '2030-01-08', hoursToSchedule: 3 }],
    ]),
  });
  const schedule = (days) => ({ days, reasons: [{ topicId: 'a', reason: 'kept' }], note: 'n' });

  test('leaves a valid schedule valid (and its reasons and note alone)', () => {
    const good = schedule([
      { date: '2030-01-07', blocks: [{ topicId: 'b', hours: 3 }] },
      { date: '2030-01-08', blocks: [{ topicId: 'a', hours: 3 }] },
      { date: '2030-01-09', blocks: [{ topicId: 'a', hours: 2 }] },
    ]);
    const fixed = repairSchedule(good, context());
    assert.equal(validateSchedule(fixed, context()).ok, true);
    assert.equal(fixed.note, 'n');
    assert.deepEqual(fixed.reasons, good.reasons);
  });

  test('moves hours off a day that is over capacity (the slip seen with Gemini)', () => {
    const over = schedule([
      { date: '2030-01-07', blocks: [{ topicId: 'b', hours: 3 }, { topicId: 'a', hours: 1 }] }, // 4h on a 3h day
      { date: '2030-01-08', blocks: [{ topicId: 'a', hours: 2 }] },
      { date: '2030-01-09', blocks: [{ topicId: 'a', hours: 2 }] },
    ]);
    assert.equal(validateSchedule(over, context()).ok, false);
    const fixed = repairSchedule(over, context());
    assert.equal(validateSchedule(fixed, context()).ok, true);
  });

  test('drops a block after its topic deadline and places the hours earlier', () => {
    const late = schedule([
      { date: '2030-01-07', blocks: [{ topicId: 'a', hours: 3 }] },
      { date: '2030-01-08', blocks: [{ topicId: 'a', hours: 2 }] },
      { date: '2030-01-09', blocks: [{ topicId: 'b', hours: 3 }] }, // b is due by Jan 8
    ]);
    const fixed = repairSchedule(late, context());
    assert.equal(validateSchedule(fixed, context()).ok, true);
    assert.ok(fixed.days.every((d) => d.blocks.every((b) => b.topicId !== 'b' || d.date <= '2030-01-08')));
  });

  test('tops up a missing topic, trims an excess one, and ignores unknown topics', () => {
    const messy = schedule([
      { date: '2030-01-07', blocks: [{ topicId: 'a', hours: 2 }, { topicId: 'ghost', hours: 1 }] }, // a short, ghost unknown
      { date: '2030-01-08', blocks: [{ topicId: 'b', hours: 2 }] }, // b short by 1
      { date: '2030-01-09', blocks: [{ topicId: 'a', hours: 3 }, { topicId: 'a', hours: 2 }] }, // a way over
    ]);
    const fixed = repairSchedule(messy, context());
    assert.equal(validateSchedule(fixed, context()).ok, true);
  });

  test('gives up (null) when there is simply not enough room', () => {
    const tight = context();
    tight.topics.set('c', { lastAllowedDate: '2030-01-09', hoursToSchedule: 5 }); // 13h needed, 9h exist
    assert.equal(repairSchedule(schedule([]), tight), null);
  });
});
