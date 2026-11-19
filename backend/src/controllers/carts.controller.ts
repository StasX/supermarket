import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../guards/csrf.guard';
import { Role, SessionGuard } from '../guards/session.guard';
import { CartsService } from '../services/carts.service';
import { CartInput, SessionRequest } from '../types/contracts';

@Controller()
@UseGuards(SessionGuard, CsrfGuard)
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Role(0)
  @Post('create-cart')
  @HttpCode(200)
  createCart(@Req() request: SessionRequest, @Body() body: CartInput) {
    return this.cartsService.createCart(request.user_data, body);
  }

  @Role(0)
  @Post('update-cart')
  @HttpCode(200)
  updateCart(@Req() request: SessionRequest, @Body() body: CartInput) {
    return this.cartsService.updateCart(request.user_data, body);
  }

  @Role(0)
  @Get('get-cart')
  cart(@Req() request: SessionRequest) {
    return this.cartsService.cart(request.user_data);
  }
}
