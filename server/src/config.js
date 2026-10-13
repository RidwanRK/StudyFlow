import { z } from 'zod';

// Load server/.env when it exists (Node 20.12+). Real environment variables win.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file: fall back to whatever is already in the environment.
}

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is missing'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is missing'),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET should be a long random string').default('dev-only-change-me-please'),
  MONGODB_DB: z.string().min(1).default('studyflow'),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.string().default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\nStudyFlow server cannot start. Fix server/.env (see server/.env.example):\n${problems}\n`);
  process.exit(1);
}

export const config = parsed.data;
