import { Router } from 'express';
import { z } from 'zod';
import { Plan, publicPlan } from '../models/Plan.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { generatePlan } from '../planner/index.js';
import { isIsoDate, serverToday } from '../lib/dates.js';

const router = Router();
router.use(requireAuth);

// "today" is the student's own local date, sent by the browser (avoids server time-zone surprises).
const todayField = z.string().refine(isIsoDate, 'Something went wrong with the date. Please refresh and try again.').optional();

router.get('/', async (req, res) => {
  const plan = await Plan.findOne({ userId: req.userId });
  res.json({ plan: publicPlan(plan) });
});

router.post('/generate', async (req, res) => {
  const { today } = z.object({ today: todayField }).parse(req.body ?? {});
  const plan = await generatePlan({ userId: req.userId, today: today ?? serverToday() });
  res.json({ status: 'ready', plan: publicPlan(plan) });
});

export default router;
