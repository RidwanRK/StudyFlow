import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { scheduleJsonSchema, scheduleSchema } from './schema.js';

// Gemini answered, but not with usable JSON in the expected shape. The planner may try once more.
export class InvalidAnswerError extends Error {}

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

// Busy (503), rate-limited (429) and server errors (500) are usually temporary, so wait and try again.
const RETRYABLE_STATUS = new Set([429, 500, 503]);
const MAX_ATTEMPTS = 4;

async function generateWithRetry(params) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await ai.models.generateContent({
        ...params,
        config: { ...params.config, abortSignal: AbortSignal.timeout(60_000) },
      });
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !RETRYABLE_STATUS.has(err.status)) throw err;
      const waitMs = 2000 * attempt;
      console.warn(`Gemini returned ${err.status}; retrying in ${waitMs / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

/**
 * Ask Gemini for a schedule and return it as parsed, shape-checked data.
 * Throws if the call fails or the reply is not valid JSON in the expected shape.
 * (Whether the schedule obeys the hour/exam rules is checked separately by planner/validate.js.)
 */
export async function requestSchedule({ instructions, input }) {
  const response = await generateWithRetry({
    model: config.GEMINI_MODEL,
    contents: JSON.stringify(input),
    config: {
      systemInstruction: instructions,
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseJsonSchema: scheduleJsonSchema,
    },
  });

  let json;
  try {
    json = JSON.parse(response.text);
  } catch {
    throw new InvalidAnswerError(`Gemini did not return valid JSON: ${String(response.text).slice(0, 200)}`);
  }
  const parsed = scheduleSchema.safeParse(json);
  if (!parsed.success) {
    throw new InvalidAnswerError(`Gemini's JSON did not match the expected shape: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}
