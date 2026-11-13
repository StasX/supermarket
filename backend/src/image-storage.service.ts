import { Injectable, NotFoundException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

export function createStorageClient() {
  return new S3Client({
    region: process.env['AWS_REGION'] || 'us-east-1',
    endpoint: process.env['S3_ENDPOINT'] || undefined,
    forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] === 'true',
    // The default credential chain supports both MinIO keys and AWS IAM roles.
  });
}

@Injectable()
export class ImageStorageService implements OnModuleInit, OnModuleDestroy {
  private readonly bucket = process.env['S3_BUCKET'] || 'product-images';
  private readonly client = createStorageClient();

  async onModuleInit() {
    if (process.env['S3_CREATE_BUCKET'] !== 'true') return;
    try { await this.client.send(new HeadBucketCommand({ Bucket: this.bucket })); }
    catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
      try { await this.client.send(new CreateBucketCommand({ Bucket: this.bucket })); }
      catch (creationError) {
        if ((creationError as Error).name !== 'BucketAlreadyOwnedByYou') throw creationError;
      }
    }
  }

  onModuleDestroy() { this.client.destroy(); }

  async put(filename: string, bytes: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: filename, Body: bytes, ContentType: contentType,
    }));
  }

  async get(filename: string) {
    if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(filename)) throw new NotFoundException();
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: filename }));
      if (!(result.Body instanceof Readable)) throw new Error('Object storage returned no readable image body');
      return result.Body;
    } catch (error) {
      if (['NoSuchKey', 'NoSuchBucket', 'NotFound'].includes((error as Error).name)) throw new NotFoundException();
      throw error;
    }
  }
}
