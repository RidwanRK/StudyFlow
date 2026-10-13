import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { groundReasons } from '../src/planner/diff.js';
import { whatHappened } from '../src/planner/replan.js';

describe('grounding reasons in facts', () => {
  // 2030-01-07 is a Monday, 01-08 Tuesday, 01-09 Wednesday, 01-10 Thursday
  const move = (reason, extra) => ({ topicId: 'a', label: 'Bio: Cells', from: [], to: ['2030-01-10'], reason, ...extra });
  const facts = [{ date: '2030-01-08', topicId: 'a', hoursLeft: 1.5, outcome: 'only partly done' }];

  test('keeps a reason that only names days involved in the move or in what happened', () => {
    const text = "Cells moved to Thursday because Tuesday's session was only half done.";
    assert.equal(groundReasons([move(text)], facts)[0].reason, text);
  });

  test('replaces a reason that names a day that has nothing to do with the move', () => {
    const fixed = groundReasons([move('Cells was given extra time on Wednesday.')], facts);
    assert.equal(fixed[0].reason, '1.5h was still open from Tuesday (only partly done), so it has been placed again.');
  });

  test('a reason with no weekday at all is kept', () => {
    assert.equal(groundReasons([move('To make room for the earlier exam.')], facts)[0].reason, 'To make room for the earlier exam.');
  });

  test('with no facts for that topic, a wrong-day reason becomes the gentle generic one', () => {
    assert.equal(groundReasons([move('Moved to Friday.')], [])[0].reason, 'Moved to fit the time you have left.');
  });
});

describe('what happened skips days that were already replanned', () => {
  const block = (extra) => ({ blockId: 'x', topicId: 'a', courseName: 'Bio', topicName: 'Cells', hours: 2, status: 'pending', hoursStudied: 0, needsMoreTime: false, ...extra });

  test('only unresolved unfinished days count', () => {
    const plan = {
      days: [
        { date: '2030-01-07', resolution: 'replanned', blocks: [block({ status: 'partial', hoursStudied: 1 })] },
        { date: '2030-01-08', resolution: 'moved_forward', blocks: [block({ status: 'untouched' })] },
      ],
    };
    assert.deepEqual(whatHappened(plan, '2030-01-09').map((f) => f.date), ['2030-01-08']);
  });
});
