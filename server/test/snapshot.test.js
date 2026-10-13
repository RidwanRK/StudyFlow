import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { describeEdits, isStale, planSignature } from '../src/planner/snapshot.js';

const setup = () => ({ weekdayHours: 3, weekendHours: 5, dayOverrides: [{ weekday: 0, hours: 2 }] });
const courses = () => [
  { _id: 'c1', name: 'Bio', examDate: '2030-01-20', topics: [{ _id: 't1', name: 'Cells', difficulty: 'hard', hoursNeeded: 3 }, { _id: 't2', name: 'Genetics', difficulty: 'easy', hoursNeeded: 2 }] },
  { _id: 'c2', name: 'Chem', examDate: '2030-01-25', topics: [{ _id: 't3', name: 'Organic', difficulty: 'medium', hoursNeeded: 4 }] },
];
const plan = () => ({ snapshot: planSignature(courses(), setup()) });

describe('is the plan out of date?', () => {
  test('not when nothing changed (even if things are listed in a different order)', () => {
    assert.equal(isStale(plan(), courses(), setup()), false);
    assert.equal(isStale(plan(), [...courses()].reverse(), { ...setup(), dayOverrides: [...setup().dayOverrides].reverse() }), false);
  });

  test('not when only a name changed', () => {
    const renamed = courses();
    renamed[0].name = 'Biology';
    renamed[0].topics[0].name = 'Chapter 1';
    assert.equal(isStale(plan(), renamed, setup()), false);
  });

  test('yes when an exam date, topic hours or difficulty changed', () => {
    const date = courses(); date[0].examDate = '2030-01-18';
    const hours = courses(); hours[0].topics[0].hoursNeeded = 4;
    const level = courses(); level[1].topics[0].difficulty = 'hard';
    for (const changed of [date, hours, level]) assert.equal(isStale(plan(), changed, setup()), true);
  });

  test('yes when a topic or course was added or removed', () => {
    const added = courses(); added[0].topics.push({ _id: 't9', name: 'New', difficulty: 'easy', hoursNeeded: 1 });
    const removedTopic = courses(); removedTopic[0].topics.pop();
    const removedCourse = courses().slice(0, 1);
    for (const changed of [added, removedTopic, removedCourse]) assert.equal(isStale(plan(), changed, setup()), true);
  });

  test('yes when the study hours changed', () => {
    for (const changed of [{ ...setup(), weekdayHours: 4 }, { ...setup(), weekendHours: 6 }, { ...setup(), dayOverrides: [] }, { ...setup(), dayOverrides: [{ weekday: 0, hours: 3 }] }]) {
      assert.equal(isStale(plan(), courses(), changed), true);
    }
  });

  test('a plan from before signatures existed is never reported as out of date', () => {
    assert.equal(isStale({}, courses(), setup()), false);
  });
});

describe('describing what the student edited', () => {
  const before = () => planSignature(courses(), setup());

  test('says nothing when nothing changed', () => {
    assert.deepEqual(describeEdits(before(), courses(), setup()), []);
  });

  test('reports an earlier exam, changed hours, a new topic and a removed topic in plain facts', () => {
    const now = courses();
    now[0].examDate = '2030-01-18';
    now[0].topics[0].hoursNeeded = 5;
    now[0].topics.pop(); // Genetics (t2) removed
    now[1].topics.push({ _id: 't9', name: 'Bonding', difficulty: 'easy', hoursNeeded: 2 });
    const facts = describeEdits(before(), now, setup(), (id) => (id === 't2' ? 'Genetics' : 'a topic'));
    assert.deepEqual(facts, [
      { change: 'exam date changed', course: 'Bio', from: '2030-01-20', to: '2030-01-18' },
      { change: 'hours needed changed', course: 'Bio', topic: 'Cells', from: 3, to: 5 },
      { change: 'topic removed', course: 'Bio', topic: 'Genetics' },
      { change: 'topic added', course: 'Chem', topic: 'Bonding', hours: 2 },
    ]);
  });

  test('reports changed study hours', () => {
    const facts = describeEdits(before(), courses(), { ...setup(), weekdayHours: 2 });
    assert.deepEqual(facts, [{ change: 'study hours changed', from: { weekdays: 3, weekends: 5 }, to: { weekdays: 2, weekends: 5 } }]);
  });

  test('a plan with no saved signature has nothing to compare', () => {
    assert.deepEqual(describeEdits('', courses(), setup()), []);
  });
});
