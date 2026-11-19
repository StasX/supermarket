import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../guards/csrf.guard';
import { Role, SessionGuard } from '../guards/session.guard';
import { CheckoutService } from '../services/checkout.service';
import { InvoiceService } from '../services/invoice.service';
import { CheckoutInput, CookieResponse, SessionRequest } from '../types/contracts';

@Controller()
@UseGuards(SessionGuard, CsrfGuard)
export class OrdersController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly invoices: InvoiceService,
  ) {}

  @Role(0)
  @Get('orders/:id/invoice')
  async invoice(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const stream = await this.invoices.download(request.user_data, id);
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: `attachment; filename="invoice-${id}.pdf"`,
    });
  }

  @Role(0)
  @Get('api/orders/count')
  ordersCount() {
    return this.checkoutService.count();
  }

  @Role(0)
  @Get('api/orders/latest')
  lastOrder(@Req() request: SessionRequest) {
    return this.checkoutService.lastOrder(request.user_data);
  }

  @Role(0)
  @Post('api/orders/checkout')
  @HttpCode(200)
  checkout(@Req() request: SessionRequest, @Body() body: CheckoutInput) {
    return this.checkoutService.checkout(request.user_data, body);
  }
}
