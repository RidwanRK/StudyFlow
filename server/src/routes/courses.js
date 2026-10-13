import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Course } from '../models/Course.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { isIsoDate, serverToday } from '../lib/dates.js';

const router = Router();
router.use(requireAuth);

const topicBody = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/).optional(), // present when editing an existing topic
  name: z.string({ error: 'Each topic needs a name.' }).trim().min(1, 'Each topic needs a name.').max(100, 'Topic names can be up to 100 characters.'),
  difficulty: z.enum(['easy', 'medium', 'hard'], { error: 'Please pick a difficulty for each topic.' }),
  hoursNeeded: z.coerce
    .number({ error: 'Please enter the hours each topic needs. If you are not sure, take a safe guess.' })
    .positive('Each topic needs more than 0 hours. If you are not sure, take a safe guess.')
    .max(200, 'That is a lot of hours for one topic. Could you split it into smaller topics?')
    .transform((n) => Math.max(0.5, Math.round(n * 2) / 2)),
});

const courseBody = z.object({
  name: z.string({ error: 'Your course needs a name.' }).trim().min(1, 'Your course needs a name.').max(100, 'Course names can be up to 100 characters.'),
  examDate: z.string({ error: 'Please pick the exam date.' }).refine(isIsoDate, 'Please pick a valid exam date.'),
  topics: z.array(topicBody).max(50, 'A course can have up to 50 topics.').default([]),
  today: z.string().refine(isIsoDate).optional(), // the student's local date, sent by the browser
});

const publicCourse = (c) => ({
  id: String(c._id),
  name: c.name,
  examDate: c.examDate,
  topics: c.topics.map((t) => ({ id: String(t._id), name: t.name, difficulty: t.difficulty, hoursNeeded: t.hoursNeeded })),
});

// Keep the id of topics that already exist so saved plans still point at them; new topics get fresh ids.
const topicDocs = (topics) =>
  topics.map(({ id, ...rest }) => (id ? { _id: new mongoose.Types.ObjectId(id), ...rest } : rest));

function requireFutureExam(examDate, today) {
  if (examDate <= (today ?? serverToday())) {
    throw new HttpError(400, 'The exam date needs to be a day that is still ahead of us. Could you check it?');
  }
}

async function findOwnCourse(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'We could not find that course.');
  const course = await Course.findOne({ _id: req.params.id, userId: req.userId });
  if (!course) throw new HttpError(404, 'We could not find that course.');
  return course;
}

router.get('/', async (req, res) => {
  const courses = await Course.find({ userId: req.userId }).sort({ examDate: 1, _id: 1 });
  res.json({ courses: courses.map(publicCourse) });
});

router.post('/', async (req, res) => {
  const { today, ...body } = courseBody.parse(req.body);
  requireFutureExam(body.examDate, today);
  const course = await Course.create({ userId: req.userId, name: body.name, examDate: body.examDate, topics: topicDocs(body.topics) });
  res.status(201).json({ course: publicCourse(course) });
});

// Saving a course replaces its topic list (topics sent with an id keep that id).
router.put('/:id', async (req, res) => {
  const course = await findOwnCourse(req);
  const { today, ...body } = courseBody.parse(req.body);
  if (body.examDate !== course.examDate) requireFutureExam(body.examDate, today);
  course.name = body.name;
  course.examDate = body.examDate;
  course.topics = topicDocs(body.topics);
  await course.save();
  res.json({ course: publicCourse(course) });
});

router.delete('/:id', async (req, res) => {
  const course = await findOwnCourse(req);
  await course.deleteOne();
  res.json({ ok: true });
});

export default router;
