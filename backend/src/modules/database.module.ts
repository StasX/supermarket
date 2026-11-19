import { Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import mongoose from 'mongoose';
import { connectDatabase, databaseModels, verifyDatabaseIndexes } from '../database/database';

export const MODELS = 'MODELS';
export type { DatabaseModels } from '../database/database';

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await mongoose.disconnect();
  }
}

@Module({
  providers: [
    DatabaseLifecycle,
    {
      provide: MODELS,
      useFactory: async () => {
        await connectDatabase();
        await verifyDatabaseIndexes();
        return databaseModels;
      },
    },
  ],
  exports: [MODELS],
})
export class DatabaseModule {}
