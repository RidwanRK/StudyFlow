import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { diffSchedules } from '../src/planner/diff.js';
import { applyProposal, creditedPerTopic, effectiveTargets, mergeAdjustments, replanStart, whatHappened } from '../src/planner/replan.js';

const block = (extra) => ({ blockId: 'x', topicId: 'a', courseName: 'Bio', topicName: 'Cells', hours: 2, status: 'pending', hoursStudied: 0, needsMoreTime: false, ...extra });

describe('diff: what actually moved', () => {
  const labels = new Map([['a', 'Bio: Cells'], ['b', 'Bio: Genetics']]);
  const day = (date, ...blocks) => ({ date, blocks: blocks.map(([topicId, hours]) => ({ topicId, hours })) });

  test('a topic that changed day shows where it left and where it landed, with Gemini\'s reason', () => {
    const before = [day('2030-01-08', ['a', 2]), day('2030-01-09', ['b', 1])];
    const after = [day('2030-01-08', ['b', 1]), day('2030-01-10', ['a', 2])];
    const moves = diffSchedules(before, after, { labels, reasons: [{ topicId: 'a', reason: 'Tuesday was only half done.' }] });
    const a = moves.find((m) => m.topicId === 'a');
    assert.deepEqual([a.from, a.to, a.reason, a.label], [['2030-01-08'], ['2030-01-10'], 'Tuesday was only half done.', 'Bio: Cells']);
    const b = moves.find((m) => m.topicId === 'b');
    assert.deepEqual([b.from, b.to], [['2030-01-09'], ['2030-01-08']]);
    assert.equal(b.reason, 'Moved to fit the time you have left.'); // no reason given -> gentle fallback
  });

  test('a reason for something that did not move is dropped', () => {
    const same = [day('2030-01-08', ['a', 2])];
    const moves = diffSchedules(same, same, { labels, reasons: [{ topicId: 'a', reason: 'I moved this!' }] });
    assert.deepEqual(moves, []);
  });

  test('extra hours on a new day count as a move to that day (nothing left)', () => {
    const moves = diffSchedules([day('2030-01-08', ['a', 1])], [day('2030-01-08', ['a', 1]), day('2030-01-09', ['a', 1])], { labels });
    assert.deepEqual([moves[0].from, moves[0].to], [[], ['2030-01-09']]);
  });

  test('a topic that disappeared is reported as no longer needed', () => {
    const moves = diffSchedules([day('2030-01-08', ['a', 1])], [], { labels });
    assert.deepEqual([moves[0].from, moves[0].to, moves[0].reason], [['2030-01-08'], [], "You don't need this any more."]);
  });

  test('block order and splitting within a day do not count as moves', () => {
    const moves = diffSchedules(
      [day('2030-01-08', ['a', 1], ['a', 1], ['b', 1])],
      [day('2030-01-08', ['b', 1], ['a', 2])],
      { labels },
    );
    assert.deepEqual(moves, []);
  });
});

describe('replan start', () => {
  const plan = (todayStatus) => ({ days: [{ date: '2030-01-07', blocks: [block({ status: todayStatus })] }, { date: '2030-01-08', blocks: [block()] }] });

  test('starts tomorrow when today has already been checked in', () => {
    assert.equal(replanStart(plan('partial'), '2030-01-07'), '2030-01-08');
  });
  test('starts today when today has no marks yet', () => {
    assert.equal(replanStart(plan('pending'), '2030-01-07'), '2030-01-07');
  });
});

describe('effective targets', () => {
  const courses = [{ topics: [{ _id: 'a', hoursNeeded: 4 }, { _id: 'b', hoursNeeded: 3 }, { _id: 'c', hoursNeeded: 2 }] }];

  test('keeps a plan\'s own target (a lighter plan), adopts edited hours, and adds new topics', () => {
    const plan = { targets: [{ topicId: 'a', hours: 2, needed: 4 }, { topicId: 'b', hours: 5, needed: 5 }] };
    const targets = effectiveTargets(plan, courses);
    assert.deepEqual(targets.find((t) => t.topicId === 'a'), { topicId: 'a', hours: 2, needed: 4 }); // unchanged -> lighter target stays
    assert.deepEqual(targets.find((t) => t.topicId === 'b'), { topicId: 'b', hours: 3, needed: 3 }); // student edited 5 -> 3
    assert.deepEqual(targets.find((t) => t.topicId === 'c'), { topicId: 'c', hours: 2, needed: 2 }); // new topic
  });
});

describe('what happened and credited hours', () => {
  const plan = {
    days: [
      { date: '2030-01-07', blocks: [block({ topicId: 'a', hours: 3, status: 'partial', hoursStudied: 1, needsMoreTime: true }), block({ topicId: 'b', topicName: 'Genetics', status: 'completed', hoursStudied: 2 })] },
      { date: '2030-01-08', blocks: [block({ topicId: 'b', topicName: 'Genetics', status: 'untouched' })] },
      { date: '2030-01-09', blocks: [block({ topicId: 'a', status: 'pending' })] },
    ],
  };

  test('lists unfinished blocks before the start date in plain facts', () => {
    const facts = whatHappened(plan, '2030-01-09');
    assert.deepEqual(facts.map((f) => [f.date, f.outcome, f.hoursLeft, f.studentSaysNeedsMoreTime]), [
      ['2030-01-07', 'only partly done', 2, true],
      ['2030-01-08', 'not started', 2, false],
    ]);
  });

  test('credits completed and partial hours only', () => {
    const credited = creditedPerTopic(plan);
    assert.equal(credited.get('a'), 1);
    assert.equal(credited.get('b'), 2);
  });
});

describe('merging capacity adjustments', () => {
  test('adds per-day hours, and sums extra hours that land on the same date', () => {
    const merged = mergeAdjustments(
      { extraPerDay: 0.5, extraDays: [{ date: '2030-01-10', hours: 1 }] },
      { extraPerDay: 1, extraDays: [{ date: '2030-01-10', hours: 1.5 }, { date: '2030-01-09', hours: 1 }] },
    );
    assert.deepEqual(merged, { extraPerDay: 1.5, extraDays: [{ date: '2030-01-09', hours: 1 }, { date: '2030-01-10', hours: 2.5 }] });
  });
});

describe('accepting a proposal', () => {
  const plan = {
    note: 'old',
    days: [
      { date: '2030-01-07', resolution: null, blocks: [block({ status: 'partial', hoursStudied: 1, needsMoreTime: true })] },
      { date: '2030-01-08', resolution: null, blocks: [block({ status: 'completed', hoursStudied: 2 })] },
      { date: '2030-01-09', resolution: null, blocks: [block()] },
    ],
  };
  const proposal = {
    startDate: '2030-01-08',
    days: [{ date: '2030-01-08', resolution: null, exams: [], blocks: [block({ blockId: 'new1' })] }],
    capacityAdjustment: { extraPerDay: 0.5, extraDays: [] },
    targets: [{ topicId: 'a', hours: 3, needed: 3 }],
    lighterMessage: '',
    note: 'new',
  };

  test('days before the start are kept (marks unchanged); unfinished ones become "replanned" and use up their extra-time tick', () => {
    const result = applyProposal(plan, proposal);
    assert.equal(result.days[0].date, '2030-01-07');
    assert.equal(result.days[0].resolution, 'replanned');
    assert.equal(result.days[0].blocks[0].status, 'partial');
    assert.equal(result.days[0].blocks[0].hoursStudied, 1);
    assert.equal(result.days[0].blocks[0].needsMoreTime, false);
  });

  test('everything from the start onward is replaced by the proposal', () => {
    const result = applyProposal(plan, proposal);
    assert.deepEqual(result.days.map((d) => d.date), ['2030-01-07', '2030-01-08']);
    assert.equal(result.days[1].blocks[0].blockId, 'new1');
    assert.deepEqual(result.capacityAdjustment, { extraPerDay: 0.5, extraDays: [] });
    assert.equal(result.note, 'new');
  });

  test('a fully completed past day is not marked replanned', () => {
    const done = { ...plan, days: [{ date: '2030-01-07', resolution: null, blocks: [block({ status: 'completed', hoursStudied: 2 })] }] };
    assert.equal(applyProposal(done, { ...proposal, startDate: '2030-01-08' }).days[0].resolution, null);
  });
});
