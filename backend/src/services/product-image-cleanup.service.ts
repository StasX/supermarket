import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DatabaseModels, MODELS } from '../modules/database.module';
import { ImageStorageService } from './image-storage.service';

export const uploadedImagePrefix = '/products/uploads/';
export const uploadedFilenamePattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:png|jpg|webp)$/;

@Injectable()
export class ProductImageCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ProductImageCleanupService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly storage: ImageStorageService,
  ) {}

  onApplicationBootstrap() {
    const retry = () => {
      this.running ??= this.retryPending()
        .catch(() => this.logger.error('Could not process pending product image deletions'))
        .finally(() => {
          this.running = undefined;
        });
    };
    retry();
    this.timer = setInterval(retry, 30_000).unref();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }

  async remove(image?: string | null) {
    if (!image?.startsWith(uploadedImagePrefix)) return;
    const filename = image.slice(uploadedImagePrefix.length);
    if (!uploadedFilenamePattern.test(filename)) return;
    try {
      await this.deleteIfUnreferenced(filename);
    } catch {
      try {
        await this.models.productImageDeletions.updateOne(
          { _id: filename },
          { $setOnInsert: { nextAttemptAt: new Date() } },
          { upsert: true, runValidators: true },
        );
        this.logger.warn(`Queued product image deletion for ${filename}`);
      } catch {
        this.logger.error(`Could not queue product image deletion for ${filename}`);
      }
    }
  }

  async retryPending() {
    const queue = this.models.productImageDeletions;
    for (let processed = 0; processed < 25; processed++) {
      const now = Date.now();
      // Move the retry time forward atomically so another replica cannot claim this job.
      const job = await queue.findOneAndUpdate(
        { nextAttemptAt: { $lte: new Date(now) } },
        { $set: { nextAttemptAt: new Date(now + 60_000) }, $inc: { attempts: 1 } },
        { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
      );
      if (!job) return;
      const claim = { _id: job._id, attempts: job.attempts };
      try {
        if (await this.deleteIfUnreferenced(job._id)) {
          await queue.deleteOne(claim);
          continue;
        }
      } catch {
        this.logger.warn(`Retry failed for product image ${job._id}`);
      }
      const delay = Math.min(30_000 * 2 ** Math.min(job.attempts - 1, 7), 3_600_000);
      await queue.updateOne(claim, { $set: { nextAttemptAt: new Date(Date.now() + delay) } });
    }
  }

  private async deleteIfUnreferenced(filename: string): Promise<boolean> {
    if (!uploadedFilenamePattern.test(filename)) return true;
    if (await this.models.products.exists({ image: uploadedImagePrefix + filename })) return false;
    await this.storage.deleteProductImage(filename);
    return true;
  }
}
