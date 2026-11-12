import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { ImageStorageService } from './image-storage.service';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { Public, Role, SessionGuard } from './session.guard';

@Controller()
@UseGuards(SessionGuard)
export class ApiController {
  constructor(private readonly auth: AuthService, private readonly shop: ShopService, private readonly images: ImageStorageService) {}

  @Public() @Get('products/uploads/:filename')
  async productImage(@Param('filename') filename: string) {
    const stream = await this.images.get(filename);
    const type = filename.endsWith('.png') ? 'image/png' : filename.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
    return new StreamableFile(stream, { type });
  }

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

  @Role(1) @Post('upload-product-image') @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async uploadProductImage(@UploadedFile() file?: { buffer: Buffer }) {
    const bytes = file?.buffer;
    const extension = bytes && (
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png' :
      bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpg' :
      bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null
    );
    if (!extension) throw new BadRequestException('Choose a PNG, JPEG, or WebP image.');
    const filename = `${randomUUID()}.${extension}`;
    await this.images.put(filename, bytes, extension === 'jpg' ? 'image/jpeg' : `image/${extension}`);
    return { success: true, image: `/products/uploads/${filename}` };
  }

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
