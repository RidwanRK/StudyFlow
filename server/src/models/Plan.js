import mongoose from 'mongoose';

// One active plan per student. "Remaining work" is never stored: it is worked out from the blocks.
const blockSchema = new mongoose.Schema(
  {
    blockId: { type: String, required: true },
    topicId: { type: String, required: true },
    // Names are copied in so a past day still reads correctly after the course or topic is edited.
    courseName: { type: String, required: true },
    topicName: { type: String, required: true },
    hours: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'partial', 'untouched'], default: 'pending' },
    hoursStudied: { type: Number, default: 0 },
    needsMoreTime: { type: Boolean, default: false },
  },
  { _id: false },
);

const daySchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    exams: [String], // names of courses whose exam falls on this date (display only)
    resolution: { type: String, enum: ['moved_forward', 'replanned'], default: null },
    blocks: [blockSchema],
  },
  { _id: false },
);

const planSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  generatedAt: { type: Date, default: Date.now },
  startDate: { type: String, required: true },
  note: { type: String, default: '' }, // Gemini's short summary of the plan
  // Set when the student kept their hours and got a lighter plan: the consoling message naming what to start with.
  lighterMessage: { type: String, default: '' },
  // Hours each topic was scheduled for. Normally a topic's full hours; less in a lighter plan. Later replans
  // measure remaining work against these targets.
  targets: [{ _id: false, topicId: String, hours: Number }],
  capacityAdjustment: {
    extraPerDay: { type: Number, default: 0 },
    extraDays: [{ _id: false, date: String, hours: Number }],
  },
  days: [daySchema],
  pendingReplan: { type: mongoose.Schema.Types.Mixed, default: null },
});

export const Plan = mongoose.model('Plan', planSchema);

export function publicPlan(plan) {
  if (!plan) return null;
  const obj = typeof plan.toObject === 'function' ? plan.toObject() : plan;
  return {
    generatedAt: obj.generatedAt,
    startDate: obj.startDate,
    note: obj.note,
    lighterMessage: obj.lighterMessage ?? '',
    capacityAdjustment: obj.capacityAdjustment,
    days: obj.days.map((d) => ({ date: d.date, exams: d.exams, resolution: d.resolution ?? null, blocks: d.blocks })),
    pendingReplan: obj.pendingReplan ?? null,
  };
}
