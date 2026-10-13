import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extraTimeBuffer, hoursCredited, hoursLeft, remainingPerTopic } from '../src/planner/remaining.js';
import { applyCheckin, hasUnfinished } from '../src/planner/checkin.js';

describe('remaining work', () => {
  const block = (extra) => ({ blockId: 'x', topicId: 'a', hours: 3, status: 'pending', hoursStudied: 0, needsMoreTime: false, ...extra });

  test('partial credits the hours studied, untouched earns nothing, completed earns the whole block', () => {
    assert.equal(hoursCredited(block({ status: 'completed', hoursStudied: 3 })), 3);
    assert.equal(hoursCredited(block({ status: 'partial', hoursStudied: 1.5 })), 1.5);
    assert.equal(hoursCredited(block({ status: 'untouched' })), 0);
    assert.equal(hoursCredited(block({ status: 'pending' })), 0);
  });

  test('hours left on a block as the student sees them', () => {
    assert.equal(hoursLeft(block({ status: 'partial', hoursStudied: 1 })), 2);
    assert.equal(hoursLeft(block({ status: 'untouched' })), 3);
    assert.equal(hoursLeft(block({ status: 'completed', hoursStudied: 3 })), 0);
    assert.equal(hoursLeft(block({ status: 'pending' })), 0);
    assert.equal(hoursLeft(block({ status: 'partial', hoursStudied: 5 })), 0); // never below zero
  });

  test('the "still need more time" buffer is half the block, rounded up to 0.5h, only on partial blocks', () => {
    assert.equal(extraTimeBuffer(block({ status: 'partial', hoursStudied: 1, needsMoreTime: true, hours: 3 })), 1.5);
    assert.equal(extraTimeBuffer(block({ status: 'partial', hoursStudied: 0.5, needsMoreTime: true, hours: 1 })), 0.5);
    assert.equal(extraTimeBuffer(block({ status: 'partial', hoursStudied: 1, needsMoreTime: true, hours: 2.5 })), 1.5); // 1.25 -> 1.5
    assert.equal(extraTimeBuffer(block({ status: 'partial', hoursStudied: 1, needsMoreTime: false })), 0);
    assert.equal(extraTimeBuffer(block({ status: 'untouched', needsMoreTime: true })), 0);
  });

  test('remaining per topic = target - credited (+ buffer), never below zero, only topics with work left', () => {
    const plan = {
      targets: [{ topicId: 'a', hours: 5 }, { topicId: 'b', hours: 2 }, { topicId: 'c', hours: 1 }],
      days: [
        {
          blocks: [
            block({ topicId: 'a', hours: 3, status: 'partial', hoursStudied: 1, needsMoreTime: true }),
            block({ topicId: 'b', hours: 2, status: 'completed', hoursStudied: 2 }),
          ],
        },
        { blocks: [block({ topicId: 'a', hours: 2, status: 'pending' }), block({ topicId: 'c', hours: 1, status: 'untouched' })] },
      ],
    };
    const remaining = remainingPerTopic(plan);
    assert.equal(remaining.get('a'), 4 + 1.5); // 5 - 1 credited = 4, plus 1.5 buffer
    assert.equal(remaining.has('b'), false); // finished
    assert.equal(remaining.get('c'), 1); // untouched earns nothing
  });

  test("a lighter plan is measured against its smaller target, not the topic's full hours", () => {
    const plan = { targets: [{ topicId: 'a', hours: 2 }], days: [{ blocks: [block({ topicId: 'a', hours: 2, status: 'completed', hoursStudied: 2 })] }] };
    assert.equal(remainingPerTopic(plan).size, 0);
  });
});

describe('check-in', () => {
  const day = () => ({
    blocks: [
      { blockId: 'b1', topicName: 'Cells', hours: 2, status: 'pending', hoursStudied: 0, needsMoreTime: false },
      { blockId: 'b2', topicName: 'Genetics', hours: 1.5, status: 'pending', hoursStudied: 0, needsMoreTime: false },
    ],
  });

  test('completed, partial and untouched are saved with the right hours', () => {
    const result = applyCheckin(day(), [
      { blockId: 'b1', status: 'partial', hoursStudied: 1.25, needsMoreTime: true },
      { blockId: 'b2', status: 'completed' },
    ]);
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.blocks.map((b) => [b.status, b.hoursStudied, b.needsMoreTime]),
      [['partial', 1.5, true], ['completed', 1.5, false]],
    );
  });

  test('untouched resets hours and the extra-time tick, and blocks not mentioned are left alone', () => {
    const result = applyCheckin(day(), [{ blockId: 'b1', status: 'untouched', hoursStudied: 9, needsMoreTime: true }]);
    assert.deepEqual([result.blocks[0].status, result.blocks[0].hoursStudied, result.blocks[0].needsMoreTime], ['untouched', 0, false]);
    assert.equal(result.blocks[1].status, 'pending');
  });

  test('rejects hours that are missing, zero, negative, tiny or the whole block', () => {
    for (const hoursStudied of [undefined, 0, -1, 'abc', 0.1, 2, 3]) {
      const result = applyCheckin(day(), [{ blockId: 'b1', status: 'partial', hoursStudied }]);
      assert.equal(result.ok, false, 'should reject ' + hoursStudied);
    }
  });

  test('rejects unknown blocks, unknown statuses, duplicates and empty check-ins', () => {
    assert.equal(applyCheckin(day(), [{ blockId: 'nope', status: 'completed' }]).ok, false);
    assert.equal(applyCheckin(day(), [{ blockId: 'b1', status: 'done' }]).ok, false);
    assert.equal(applyCheckin(day(), [{ blockId: 'b1', status: 'completed' }, { blockId: 'b1', status: 'untouched' }]).ok, false);
    assert.equal(applyCheckin(day(), []).ok, false);
  });

  test('a day needs a decision only when something is partial or untouched', () => {
    assert.equal(hasUnfinished([{ status: 'completed' }, { status: 'pending' }]), false);
    assert.equal(hasUnfinished([{ status: 'completed' }, { status: 'partial' }]), true);
    assert.equal(hasUnfinished([{ status: 'untouched' }]), true);
  });
});
