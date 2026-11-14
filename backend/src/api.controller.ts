import {
  LoginInput,
  SignupInput,
  CategoryInput,
  SearchInput,
  ProductInput,
  CartInput,
  CheckoutInput,
  SessionRequest,
  CookieResponse,
} from './contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { ImageStorageService } from './image-storage.service';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { InvoiceService } from './invoice.service';
import { Public, Role, SessionGuard } from './session.guard';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { CsrfGuard, CsrfService } from './csrf.service';

@Controller()
@UseGuards(SessionGuard, CsrfGuard)
export class ApiController {
  constructor(
    private readonly auth: AuthService,
    private readonly shop: ShopService,
    private readonly images: ImageStorageService,
    private readonly invoices: InvoiceService,
    private readonly csrf: CsrfService,
  ) {}

  @Public()
  @Get('csrf-token')
  csrfToken(@Req() request: SessionRequest, @Res({ passthrough: true }) response: CookieResponse) {
    response.setHeader('Cache-Control', 'no-store');
    const session = request.cookies?.SESSIONID;
    this.csrf.issue(response, typeof session === 'string' ? session : '');
    return { success: true };
  }

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

  @Public()
  @Get('products/uploads/:filename')
  async productImage(@Param('filename') filename: string) {
    const stream = await this.images.get(filename);
    const type = filename.endsWith('.png')
      ? 'image/png'
      : filename.endsWith('.jpg')
        ? 'image/jpeg'
        : 'image/webp';
    return new StreamableFile(stream, { type });
  }

  @Public()
  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  login(@Body() body: LoginInput, @Res({ passthrough: true }) response: CookieResponse) {
    return this.auth.login(body, response);
  }

  @Public()
  @Post('sign-up')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  signup(@Body() body: SignupInput) {
    return this.auth.signup(body);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: CookieResponse) {
    response.clearCookie('SESSIONID', { path: '/' });
    this.csrf.issue(response);
    return { success: true };
  }

  @Get('reconect')
  reconnect(@Req() request: SessionRequest) {
    const user = request.user_data;
    return {
      success: true,
      role: user.role,
      name: user.name,
      user: user._id,
      address: user.address,
      isReturning: user.isReturning,
    };
  }

  @Get('get-all-products')
  products() {
    return this.shop.products();
  }

  @Post('get-products-by-category')
  @HttpCode(200)
  category(@Body() body: CategoryInput) {
    return this.shop.category(body);
  }

  @Post('find-product')
  @HttpCode(200)
  find(@Body() body: SearchInput) {
    return this.shop.find(body);
  }

  @Role(1)
  @Post('add-product')
  @HttpCode(200)
  add(@Body() body: ProductInput) {
    return this.shop.saveProduct(body);
  }

  @Role(1)
  @Post('edit-product')
  @HttpCode(200)
  edit(@Body() body: ProductInput) {
    return this.shop.saveProduct(body, true);
  }

  @Role(1)
  @Post('upload-product-image')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async uploadProductImage(@UploadedFile() file?: { buffer: Buffer }) {
    const bytes = file?.buffer;
    if (!bytes) {
      throw new BadRequestException('Choose a PNG, JPEG, or WebP image.');
    }
    const extension = imageExtension(bytes);
    if (!extension) {
      throw new BadRequestException('Choose a PNG, JPEG, or WebP image.');
    }
    const filename = `${randomUUID()}.${extension}`;
    await this.images.put(
      filename,
      bytes,
      extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
    );
    return { success: true, image: `/products/uploads/${filename}` };
  }

  @Role(0)
  @Get('total-orders')
  ordersCount() {
    return this.shop.count('orders', 'ordersCount');
  }

  @Role(0)
  @Get('total-products')
  productsCount() {
    return this.shop.count('products', 'productsCount');
  }

  @Role(0)
  @Post('create-cart')
  @HttpCode(200)
  createCart(@Req() request: SessionRequest, @Body() body: CartInput) {
    return this.shop.createCart(request.user_data, body);
  }

  @Role(0)
  @Post('update-cart')
  @HttpCode(200)
  updateCart(@Req() request: SessionRequest, @Body() body: CartInput) {
    return this.shop.updateCart(request.user_data, body);
  }

  @Role(0)
  @Get('get-cart')
  cart(@Req() request: SessionRequest) {
    return this.shop.cart(request.user_data);
  }

  @Role(0)
  @Get('get-last-order')
  lastOrder(@Req() request: SessionRequest) {
    return this.shop.lastOrder(request.user_data);
  }

  @Role(0)
  @Post('checkout')
  @HttpCode(200)
  checkout(@Req() request: SessionRequest, @Body() body: CheckoutInput) {
    return this.shop.checkout(request.user_data, body);
  }
}

/** Identify the supported image formats from their file signatures. */
function imageExtension(bytes: Buffer): 'png' | 'jpg' | 'webp' | null {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.subarray(0, 8).equals(pngSignature)) {
    return 'png';
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return 'jpg';
  }
  const isWebp =
    bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return isWebp ? 'webp' : null;
}
