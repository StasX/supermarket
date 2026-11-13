import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import mongoose from 'mongoose';
import { MODELS, DatabaseModels } from './database.module';
import { ImageStorageService } from './image-storage.service';
import { createInvoice, InvoiceOrder } from './invoice';

@Injectable()
export class InvoiceService {
  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly storage: ImageStorageService,
  ) {}

  async ensure(order: InvoiceOrder & { invoiceKey?: string }) {
    const id = String(order._id);
    const key = `invoices/${id}.pdf`;
    if (!order.invoiceKey) {
      // Conditional creation preserves the first PDF during retries and concurrent checkouts.
      await this.storage.putInvoice(id, createInvoice(order));
      await this.models.orders.findOneAndUpdate({ _id: order._id }, { $set: { invoiceKey: key } });
    }
    return `/orders/${id}/invoice`;
  }

  async download(user: { id: number }, id: string) {
    if (!mongoose.isObjectIdOrHexString(id)) {
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
    await this.ensure(order);
    return this.storage.getInvoice(String(order._id));
  }
}
