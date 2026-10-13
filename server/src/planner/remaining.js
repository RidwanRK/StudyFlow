import { addDays } from '../lib/dates.js';

// Turns saved courses into the list of topics that need scheduling.
// Courses whose exam is today or already past are left out. A topic must finish the day before its exam.
// `hoursToSchedule` is the full requirement here; later slices subtract work already done.
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
