import { z } from 'zod';

// The shape Gemini must return for any schedule (generate and replan).
// The server supplies every id, date and hour amount; Gemini only arranges and explains.
export const scheduleSchema = z.object({
  days: z.array(
    z.object({
      date: z.string().describe('YYYY-MM-DD'),
      blocks: z.array(
        z.object({
          topicId: z.string(),
          hours: z.number().min(0.5).multipleOf(0.5),
        }),
      ),
    }),
  ),
  reasons: z.array(z.object({ topicId: z.string(), reason: z.string() })),
  note: z.string(),
});

// JSON Schema version, sent to Gemini as responseJsonSchema.
export const scheduleJsonSchema = (() => {
  const { $schema, ...rest } = z.toJSONSchema(scheduleSchema);
  return rest;
})();
