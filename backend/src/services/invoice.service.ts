import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { isObjectId } from '../validators/object-id';
import { MODELS, DatabaseModels } from '../modules/database.module';
import { ImageStorageService } from './image-storage.service';
import { createInvoice } from '../utils/invoice';

@Injectable()
export class InvoiceService {
  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly storage: ImageStorageService,
  ) {}

  async download(user: { id: number }, id: string) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }
    const order = await this.models.orders.findOne({
      _id: id,
      user_id: user.id,
      'payment.mode': 'demo',
    });
    if (!order) {
      throw new NotFoundException();
    }
    const invoiceId = String(order._id);
    try {
      return await this.storage.getInvoice(invoiceId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    // Concurrent downloads must all serve the PDF that won the conditional upload.
    await this.storage.putInvoice(invoiceId, createInvoice(order));
    return this.storage.getInvoice(invoiceId);
  }
}
