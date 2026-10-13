import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const COOKIE_NAME = 'studyflow_token';

// Attaches req.userId from the login cookie, or answers 401 so the website sends the student to /login.
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
  }
}
