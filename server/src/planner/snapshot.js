// A plan is "out of date" when the courses or study hours it was built from have changed.
// The signature captures everything that affects the schedule: study hours, each course's exam date, and each topic's
// difficulty and hours. Names are left out on purpose: renaming something doesn't change how days are arranged.
// Saved with the plan when it is generated or when a replan is accepted, and compared with the current data.

export function planSignature(courses, setup) {
  return JSON.stringify({
    hours: setup
      ? {
          weekday: setup.weekdayHours,
          weekend: setup.weekendHours,
          overrides: [...(setup.dayOverrides ?? [])].map((o) => [o.weekday, o.hours]).sort((a, b) => a[0] - b[0]),
        }
      : null,
    courses: [...courses]
      .map((c) => ({
        id: String(c._id),
        exam: c.examDate,
        topics: [...c.topics].map((t) => [String(t._id), t.difficulty, t.hoursNeeded]).sort((a, b) => a[0].localeCompare(b[0])),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}

// Plans made before signatures existed have none; they are never reported as out of date.
export function isStale(plan, courses, setup) {
  return Boolean(plan.snapshot) && plan.snapshot !== planSignature(courses, setup);
}

// Plain facts about what the student changed since the plan was made, for Gemini to explain moves with
// ("Cells moved because the Biology exam is now two days earlier"). Compares the plan's saved signature with now.
// nameOfTopic(topicId) is used for topics that no longer exist.
export function describeEdits(oldSignature, courses, setup, nameOfTopic = () => 'a topic') {
  if (!oldSignature) return [];
  const old = JSON.parse(oldSignature);
  const facts = [];
  const oldCourses = new Map(old.courses.map((c) => [c.id, c]));

  for (const course of courses) {
    const before = oldCourses.get(String(course._id));
    if (!before) {
      facts.push({ change: 'course added', course: course.name, examDate: course.examDate });
      continue;
    }
    if (before.exam !== course.examDate) {
      facts.push({ change: 'exam date changed', course: course.name, from: before.exam, to: course.examDate });
    }
    const oldTopics = new Map(before.topics.map((t) => [t[0], t]));
    for (const topic of course.topics) {
      const was = oldTopics.get(String(topic._id));
      if (!was) facts.push({ change: 'topic added', course: course.name, topic: topic.name, hours: topic.hoursNeeded });
      else {
        if (was[2] !== topic.hoursNeeded) facts.push({ change: 'hours needed changed', course: course.name, topic: topic.name, from: was[2], to: topic.hoursNeeded });
        if (was[1] !== topic.difficulty) facts.push({ change: 'difficulty changed', course: course.name, topic: topic.name, from: was[1], to: topic.difficulty });
      }
    }
    for (const [topicId] of oldTopics) {
      if (!course.topics.some((t) => String(t._id) === topicId)) facts.push({ change: 'topic removed', course: course.name, topic: nameOfTopic(topicId) });
    }
  }
  for (const [courseId] of oldCourses) {
    if (!courses.some((c) => String(c._id) === courseId)) facts.push({ change: 'course removed', course: nameOfTopic(courseId, true) });
  }

  if (setup && old.hours && JSON.stringify(old.hours) !== JSON.stringify(JSON.parse(planSignature([], setup)).hours)) {
    facts.push({
      change: 'study hours changed',
      from: { weekdays: old.hours.weekday, weekends: old.hours.weekend },
      to: { weekdays: setup.weekdayHours, weekends: setup.weekendHours },
    });
  }
  return facts;
}
