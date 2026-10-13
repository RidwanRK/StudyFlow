import mongoose from 'mongoose';

// A course has one exam date; each topic has its own difficulty and hours needed.
// Topic ids are kept stable across edits, because saved plan blocks refer to them.
const topicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  hoursNeeded: { type: Number, required: true },
});

const courseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  examDate: { type: String, required: true }, // "YYYY-MM-DD"
  topics: [topicSchema],
});

export const Course = mongoose.model('Course', courseSchema);
