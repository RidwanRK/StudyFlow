import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { COOKIE_NAME, requireAuth } from '../middleware/requireAuth.js';
import { HttpError } from '../middleware/errorHandler.js';

const router = Router();

const credentials = z.object({
  username: z
    .string({ error: 'Please choose a username.' })
    .trim()
    .toLowerCase()
    .min(3, 'Usernames need at least 3 characters.')
    .max(30, 'Usernames can be up to 30 characters.')
    .regex(/^[a-z0-9_.-]+$/, 'Usernames can use letters, numbers, dots, dashes and underscores.'),
  password: z
    .string({ error: 'Please enter a password.' })
    .min(6, 'Passwords need at least 6 characters.')
    .max(100, 'That password is a bit too long.'),
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function startSession(res, user) {
  const token = jwt.sign({ sub: String(user._id) }, config.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: SEVEN_DAYS_MS,
  });
}

const publicUser = (user) => ({ id: String(user._id), username: user.username, hasSeenWelcome: user.hasSeenWelcome });

router.post('/register', async (req, res) => {
  const { username, password } = credentials.parse(req.body);
  if (await User.exists({ username })) {
    throw new HttpError(409, 'That username is already taken. Could you try another one?');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await User.create({ username, passwordHash });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'That username is already taken. Could you try another one?');
    throw err;
  }
  startSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { username, password } = credentials.parse(req.body);
  const user = await User.findOne({ username });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, "That username and password don't match. Please check them and try again.");
  startSession(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    res.clearCookie(COOKIE_NAME);
    throw new HttpError(401, 'Your session has ended. Please sign in again.');
  }
  res.json({ user: publicUser(user) });
});

router.post('/welcome-seen', requireAuth, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.userId, { hasSeenWelcome: true }, { returnDocument: 'after' });
  res.json({ user: publicUser(user) });
});

export default router;
