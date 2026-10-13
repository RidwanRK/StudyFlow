// Applying an end-of-day check-in to a day's blocks. Pure functions: no database, easy to test.

const STATUSES = ['completed', 'partial', 'untouched'];

// day:   { blocks: [{ blockId, hours, topicName, ... }] }
// items: [{ blockId, status, hoursStudied?, needsMoreTime? }]  (blocks not mentioned stay as they are)
// Returns { ok: true, blocks } with updated copies of the day's blocks, or { ok: false, error } with one friendly sentence.
export function applyCheckin(day, items) {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'Please mark at least one item first.' };

  const byId = new Map(day.blocks.map((b) => [b.blockId, b]));
  const updates = new Map();

  for (const item of items) {
    const block = byId.get(item.blockId);
    if (!block) return { ok: false, error: 'One of those items is not part of this day. Please refresh and try again.' };
    if (!STATUSES.includes(item.status)) return { ok: false, error: 'Please choose completed, partial or untouched for each item.' };
    if (updates.has(item.blockId)) return { ok: false, error: 'An item was marked twice. Please refresh and try again.' };

    if (item.status === 'completed') {
      updates.set(item.blockId, { status: 'completed', hoursStudied: block.hours, needsMoreTime: false });
    } else if (item.status === 'untouched') {
      updates.set(item.blockId, { status: 'untouched', hoursStudied: 0, needsMoreTime: false });
    } else {
      const studied = Number(item.hoursStudied);
      if (!Number.isFinite(studied) || studied <= 0) {
        return { ok: false, error: `How many hours did you study for ${block.topicName}? If you didn't start it, mark it untouched.` };
      }
      const rounded = Math.round(studied * 2) / 2;
      if (rounded < 0.5) {
        return { ok: false, error: `Please enter at least half an hour for ${block.topicName}, or mark it untouched.` };
      }
      if (rounded >= block.hours) {
        return { ok: false, error: `That is all ${block.hours} hours of ${block.topicName}. If you finished it, mark it completed.` };
      }
      updates.set(item.blockId, { status: 'partial', hoursStudied: rounded, needsMoreTime: Boolean(item.needsMoreTime) });
    }
  }

  const blocks = day.blocks.map((b) => (updates.has(b.blockId) ? { ...b, ...updates.get(b.blockId) } : b));
  return { ok: true, blocks };
}

// A day "needs a decision" when anything on it was checked in as partial or untouched.
export function hasUnfinished(blocks) {
  return blocks.some((b) => b.status === 'partial' || b.status === 'untouched');
}
