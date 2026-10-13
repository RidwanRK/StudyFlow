import { Router } from 'express';
import { z } from 'zod';
import { Plan, publicPlan } from '../models/Plan.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { acceptReplan, generatePlan, rejectReplan, replanPlan } from '../planner/index.js';
import { applyCheckin, hasUnfinished } from '../planner/checkin.js';
import { isIsoDate, serverToday } from '../lib/dates.js';

const router = Router();
router.use(requireAuth);

// "today" is the student's own local date, sent by the browser (avoids server time-zone surprises).
const todayField = z.string().refine(isIsoDate, 'Something went wrong with the date. Please refresh and try again.').optional();
const dateField = z.string().refine(isIsoDate, 'Something went wrong with the date. Please refresh and try again.');

async function findPlan(userId) {
  const plan = await Plan.findOne({ userId });
  if (!plan) throw new HttpError(404, 'You do not have a plan yet. Generate one first.');
  return plan;
}

function findDay(plan, date) {
  const day = plan.days.find((d) => d.date === date);
  if (!day) throw new HttpError(404, 'That day is not part of your plan.');
  return day;
}

router.get('/', async (req, res) => {
  const plan = await Plan.findOne({ userId: req.userId });
  res.json({ plan: publicPlan(plan) });
});

router.post('/generate', async (req, res) => {
  const { today, fitChoice } = z
    .object({ today: todayField, fitChoice: z.enum(['daily', 'extra_days', 'keep']).optional() })
    .parse(req.body ?? {});
  const result = await generatePlan({ userId: req.userId, today: today ?? serverToday(), fitChoice });
  if (result.status === 'needs_fit_choice') return res.json(result);
  res.json({ status: 'ready', plan: publicPlan(result.plan) });
});

// End-of-day check-in: saves how each block went. Changing a day's marks reopens the choice for that day.
router.put('/checkin', async (req, res) => {
  const body = z
    .object({
      date: dateField,
      today: todayField,
      items: z.array(
        z.object({
          blockId: z.string(),
          status: z.string(),
          hoursStudied: z.union([z.number(), z.string()]).optional(),
          needsMoreTime: z.boolean().optional(),
        }),
      ),
    })
    .parse(req.body);
  if (body.date > (body.today ?? serverToday())) {
    throw new HttpError(400, "That day hasn't happened yet. You can check in once it has.");
  }

  const plan = await findPlan(req.userId);
  const day = findDay(plan, body.date);
  const result = applyCheckin(day.toObject(), body.items);
  if (!result.ok) throw new HttpError(400, result.error);

  day.blocks = result.blocks;
  day.resolution = null;
  await plan.save();
  res.json({ plan: publicPlan(plan) });
});

// Move forward without replanning: the plan stays as it is and the unfinished work shows as a "remaining" alert.
router.post('/move-forward', async (req, res) => {
  const { date } = z.object({ date: dateField }).parse(req.body);
  const plan = await findPlan(req.userId);
  const day = findDay(plan, date);
  if (!hasUnfinished(day.blocks)) throw new HttpError(400, 'Everything on this day is done, so there is nothing to move forward.');
  day.resolution = 'moved_forward';
  await plan.save();
  res.json({ plan: publicPlan(plan) });
});

// Replan: Gemini proposes a new arrangement of the days still to come. Nothing changes until the student accepts.
router.post('/replan', async (req, res) => {
  const { today, reason, fitChoice } = z
    .object({
      today: todayField,
      reason: z.enum(['fell_behind', 'edit']).optional(),
      fitChoice: z.enum(['daily', 'extra_days', 'keep']).optional(),
    })
    .parse(req.body ?? {});
  const result = await replanPlan({ userId: req.userId, today: today ?? serverToday(), reason, fitChoice });
  res.json(result);
});

router.post('/replan/accept', async (req, res) => {
  const plan = await acceptReplan({ userId: req.userId });
  res.json({ plan: publicPlan(plan) });
});

router.post('/replan/reject', async (req, res) => {
  const plan = await rejectReplan({ userId: req.userId });
  res.json({ plan: publicPlan(plan) });
});

export default router;
