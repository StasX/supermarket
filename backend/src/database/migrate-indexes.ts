import '../config/load-env';
import mongoose from 'mongoose';
import { connectDatabase, provisionDatabaseIndexes } from './database';

async function migrateIndexes() {
  try {
    await connectDatabase();
    await provisionDatabaseIndexes();
    console.info('MongoDB indexes are ready.');
  } finally {
    await mongoose.disconnect();
  }
}

migrateIndexes().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
