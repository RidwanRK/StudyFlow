import mongoose from 'mongoose';
import { config } from './config.js';
import { createApp } from './app.js';

try {
  await mongoose.connect(config.MONGODB_URI, { dbName: config.MONGODB_DB, serverSelectionTimeoutMS: 10_000 });
} catch (err) {
  console.error(`\nStudyFlow server cannot reach MongoDB: ${err.message}`);
  console.error('Check MONGODB_URI in server/.env, and that your IP is allowed in Atlas network access.\n');
  process.exit(1);
}

createApp().listen(config.PORT, () => {
  console.log(`StudyFlow server listening on http://localhost:${config.PORT}`);
});
