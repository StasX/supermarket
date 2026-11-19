import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { CsrfGuard } from '../guards/csrf.guard';
import { Public, Role, SessionGuard } from '../guards/session.guard';
import { ImageStorageService } from '../services/image-storage.service';
import { ProductsService } from '../services/products.service';
import { CategoryInput, ProductInput, SearchInput } from '../types/contracts';

@Controller()
@UseGuards(SessionGuard, CsrfGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly images: ImageStorageService,
  ) {}

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

  @Get('get-all-products')
  products() {
    return this.productsService.products();
  }

  @Post('get-products-by-category')
  @HttpCode(200)
  category(@Body() body: CategoryInput) {
    return this.productsService.category(body);
  }

  @Post('find-product')
  @HttpCode(200)
  find(@Body() body: SearchInput) {
    return this.productsService.find(body);
  }

  @Role(1)
  @Post('add-product')
  @HttpCode(200)
  add(@Body() body: ProductInput) {
    return this.productsService.saveProduct(body);
  }

  @Role(1)
  @Post('edit-product')
  @HttpCode(200)
  edit(@Body() body: ProductInput) {
    return this.productsService.saveProduct(body, true);
  }

  @Role(1)
  @Post('delete-product')
  @HttpCode(200)
  deleteProduct(@Body() body: ProductInput) {
    return this.productsService.deleteProduct(body);
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
  @Get('total-products')
  productsCount() {
    return this.productsService.count();
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
