import mongoose from 'mongoose';

// One per student: how many hours they can study. Weekend = Saturday and Sunday.
// Overrides are by day of the week (0 = Sunday ... 6 = Saturday), so "Sunday" means every Sunday.
const setupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  weekdayHours: { type: Number, required: true },
  weekendHours: { type: Number, required: true },
  dayOverrides: [
    {
      _id: false,
      weekday: { type: Number, min: 0, max: 6, required: true },
      hours: { type: Number, required: true },
    },
  ],
});

export const Setup = mongoose.model('Setup', setupSchema);
