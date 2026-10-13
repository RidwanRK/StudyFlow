import { Router } from 'express';
import { z } from 'zod';
import { Setup } from '../models/Setup.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

// Hours are kept in half-hour steps: easy to read, exact to add up.
const hours = (label) =>
  z.coerce
    .number({ error: `Please enter ${label} as a number of hours.` })
    .min(0, `${label[0].toUpperCase()}${label.slice(1)} can't be negative.`)
    .max(24, `${label[0].toUpperCase()}${label.slice(1)} can't be more than 24 hours.`)
    .transform((n) => Math.round(n * 2) / 2);

const setupBody = z
  .object({
    weekdayHours: hours('weekday hours'),
    weekendHours: hours('weekend hours'),
    dayOverrides: z
      .array(z.object({ weekday: z.coerce.number().int().min(0).max(6), hours: hours('that day’s hours') }))
      .max(7)
      .default([]),
  })
  .refine((v) => new Set(v.dayOverrides.map((o) => o.weekday)).size === v.dayOverrides.length, {
    message: 'Each day of the week can only be customised once.',
  });

const publicSetup = (s) => ({
  weekdayHours: s.weekdayHours,
  weekendHours: s.weekendHours,
  dayOverrides: s.dayOverrides.map((o) => ({ weekday: o.weekday, hours: o.hours })),
});

router.get('/', async (req, res) => {
  const setup = await Setup.findOne({ userId: req.userId });
  res.json({ setup: setup ? publicSetup(setup) : null });
});

router.put('/', async (req, res) => {
  const body = setupBody.parse(req.body);
  const setup = await Setup.findOneAndUpdate({ userId: req.userId }, body, {
    upsert: true,
    returnDocument: 'after',
    setDefaultsOnInsert: true,
  });
  res.json({ setup: publicSetup(setup) });
});

export default router;
