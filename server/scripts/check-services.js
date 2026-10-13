// Proves the two risky connections work: MongoDB and Gemini (structured JSON reply).
// Run with: npm run check:services
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { requestSchedule } from '../src/ai/gemini.js';

let failed = false;

async function checkMongo() {
  await mongoose.connect(config.MONGODB_URI, { dbName: config.MONGODB_DB, serverSelectionTimeoutMS: 10_000 });
  const name = mongoose.connection.name;
  await mongoose.disconnect();
  console.log(`OK   MongoDB connected (database "${name}")`);
}

async function checkGemini() {
  const input = {
    startDate: '2030-01-07',
    days: [
      { date: '2030-01-07', capacityHours: 2 },
      { date: '2030-01-08', capacityHours: 2 },
    ],
    topics: [
      { topicId: 'a', name: 'Cells', hoursToSchedule: 2, lastAllowedDate: '2030-01-08' },
      { topicId: 'b', name: 'Genetics', hoursToSchedule: 2, lastAllowedDate: '2030-01-08' },
    ],
  };
  const instructions =
    'You are a study planner. Schedule exactly the requested hours for each topic, in 0.5 hour blocks, ' +
    "never exceeding a day's capacityHours and never after lastAllowedDate. Use the given topicId and date values exactly. " +
    'Give one short reason per topic. Reply with JSON only.';

  const schedule = await requestSchedule({ instructions, input });
  const total = schedule.days.reduce((sum, d) => sum + d.blocks.reduce((s, b) => s + b.hours, 0), 0);
  console.log(`OK   Gemini replied with valid JSON in the expected shape (model "${config.GEMINI_MODEL}")`);
  console.log(`     ${schedule.days.length} day(s), ${total} hours scheduled (asked for 4)`);
  console.log(`     note: ${schedule.note}`);
}

for (const [label, check] of [['MongoDB', checkMongo], ['Gemini', checkGemini]]) {
  try {
    await check();
  } catch (err) {
    failed = true;
    console.error(`FAIL ${label}: ${err.message}`);
  }
}

// Set the exit code instead of calling process.exit(): on Windows, exiting while network handles
// are still closing can crash with a libuv assertion.
process.exitCode = failed ? 1 : 0;
