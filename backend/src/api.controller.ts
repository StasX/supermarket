import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { Public, Role, SessionGuard } from './session.guard';

@Controller()
@UseGuards(SessionGuard)
export class ApiController {
  constructor(private readonly auth: AuthService, private readonly shop: ShopService) {}

  @Public() @Post('login') @HttpCode(200)
  login(@Body() body: any, @Res({ passthrough: true }) response: any) { return this.auth.login(body, response); }

  @Public() @Post('sign-up') @HttpCode(200)
  signup(@Body() body: any) { return this.auth.signup(body); }

  @Get('logout')
  logout(@Res({ passthrough: true }) response: any) {
    response.clearCookie('SESSIONID', { path: '/' });
    return { success: true };
  }

  @Get('reconect')
  reconnect(@Req() request: any) {
    const user = request.user_data;
    return { success: true, role: user.role, name: user.name, user: user._id };
  }

  @Get('get-all-products')
  products() { return this.shop.products(); }

  @Post('get-products-by-category') @HttpCode(200)
  category(@Body() body: any) { return this.shop.category(body); }

  @Post('find-product') @HttpCode(200)
  find(@Body() body: any) { return this.shop.find(body); }

  @Role(1) @Post('add-product') @HttpCode(200)
  add(@Body() body: any) { return this.shop.saveProduct(body); }

  @Role(1) @Post('edit-product') @HttpCode(200)
  edit(@Body() body: any) { return this.shop.saveProduct(body, true); }

  @Role(0) @Get('total-orders')
  ordersCount() { return this.shop.count('orders', 'ordersCount'); }

  @Role(0) @Get('total-products')
  productsCount() { return this.shop.count('products', 'productsCount'); }

  @Role(0) @Post('create-cart') @HttpCode(200)
  createCart(@Req() request: any, @Body() body: any) { return this.shop.createCart(request.user_data, body); }

  @Role(0) @Post('update-cart') @HttpCode(200)
  updateCart(@Req() request: any, @Body() body: any) { return this.shop.updateCart(request.user_data, body); }

  @Role(0) @Get('get-cart')
  cart(@Req() request: any) { return this.shop.cart(request.user_data); }

  @Role(0) @Get('get-last-order')
  lastOrder(@Req() request: any) { return this.shop.lastOrder(request.user_data); }
}
