import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CsrfGuard } from '../guards/csrf.guard';
import { Public, Role, SessionGuard } from '../guards/session.guard';
import { ProductsService } from '../services/products.service';
import { CatalogInput, CategoryInput, ProductInput, SearchInput } from '../types/contracts';
import { productImageExtension } from '../validators/product.validator';

const ProductImageUpload = FileInterceptor('image', {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

@Controller()
@UseGuards(SessionGuard, CsrfGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get('products/uploads/:filename')
  async productImage(@Param('filename') filename: string) {
    const stream = await this.productsService.productImage(filename);
    const type = filename.endsWith('.png')
      ? 'image/png'
      : filename.endsWith('.jpg')
        ? 'image/jpeg'
        : 'image/webp';
    return new StreamableFile(stream, { type });
  }

  @Get('api/products')
  products(@Query() query: CatalogInput) {
    return this.productsService.products(query);
  }

  @Post('api/products/by-category')
  @HttpCode(200)
  category(@Body() body: CategoryInput) {
    return this.productsService.category(body);
  }

  @Post('api/products/search')
  @HttpCode(200)
  find(@Body() body: SearchInput) {
    return this.productsService.find(body);
  }

  @Role(1)
  @Post('api/products/create')
  @HttpCode(200)
  @UseInterceptors(ProductImageUpload)
  add(@Body() body: ProductInput, @UploadedFile() file?: { buffer: Buffer }) {
    return this.productsService.saveProduct(body, false, validateImage(file));
  }

  @Role(1)
  @Post('api/products/update')
  @HttpCode(200)
  @UseInterceptors(ProductImageUpload)
  edit(@Body() body: ProductInput, @UploadedFile() file?: { buffer: Buffer }) {
    return this.productsService.saveProduct(body, true, validateImage(file));
  }

  @Role(1)
  @Post('api/products/delete')
  @HttpCode(200)
  deleteProduct(@Body() body: ProductInput) {
    return this.productsService.deleteProduct(body);
  }

  @Role(0)
  @Get('api/products/count')
  productsCount() {
    return this.productsService.count();
  }
}

function validateImage(file?: { buffer: Buffer }) {
  if (!file) return undefined;
  const extension = productImageExtension(file.buffer);
  if (!extension) throw new BadRequestException('Choose a PNG, JPEG, or WebP image.');
  return { bytes: file.buffer, extension };
}
