import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, categories, Product } from './api.service';
import { CartService } from './cart.service';
import { priceValidator } from './validators';

@Component({
  selector: 'app-cart',
  imports: [CurrencyPipe, FormsModule, RouterLink],
  template: `
    <section class="panel cart">
      <div class="cart-heading">
        <div>
          <span class="eyebrow">THE GOOD STUFF</span>
          <h2>My cart</h2>
        </div>
        <span class="cart-count">{{ cart.items().length }}</span>
      </div>
      @if (cart.busy()) {
        <p role="status">Saving or loading cart…</p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (cart.lines().length) {
        @for (item of cart.lines(); track item.id) {
          <div class="cart-line">
            <strong>{{ item.name }}</strong><span>{{ item.price | currency: 'USD' }}</span>
            <label
              >Quantity<input
                type="number"
                min="1"
                step="1"
                [ngModel]="item.count"
                (ngModelChange)="quantity(item.id, $event)"
                [disabled]="cart.busy()"
            /></label>
            <span>{{ item.price * item.count | currency: 'USD' }}</span>
            <button
              class="secondary"
              type="button"
              (click)="remove(item.id)"
              [disabled]="cart.busy()"
              [attr.aria-label]="'Remove ' + item.name"
            >
              Remove
            </button>
          </div>
        }
        <p class="total">
          Total: <span>{{ cart.total() | currency: 'USD' }}</span>
        </p>
        <a class="button" routerLink="/order/cart"
          >Review order <span aria-hidden="true">→</span></a
        >
      } @else {
        <div class="empty-cart">
          <span class="basket-symbol" aria-hidden="true"
            ><svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              focusable="false"
            >
              <path d="m5 9 4-6m10 6-4-6M3 9h18l-2 11H5L3 9Z" />
              <path d="M9 13v3m6-3v3M2 9h20" /></svg
          ></span>
          <p>Your cart is empty.</p>
          <small
            >Something delicious is waiting.<br />Add your first favourite to get started.</small
          >
        </div>
      }
      <p class="cart-note">A little of what you love, all in one basket.</p>
    </section>
  `,
})
export class CartComponent {
  readonly cart = inject(CartService);
  readonly error = signal('');

  async quantity(id: string, count: number) {
    this.error.set('');
    try {
      await this.cart.quantity(id, count);
    } catch (error) {
      this.error.set(message(error));
    }
  }

  async remove(id: string) {
    this.error.set('');
    try {
      await this.cart.remove(id);
    } catch (error) {
      this.error.set(message(error));
    }
  }
}

@Component({
  selector: 'app-store',
  imports: [FormsModule, CurrencyPipe, CartComponent],
  template: `
    <section class="store-hero">
      <div>
        <span class="eyebrow">YOUR EVERYDAY MARKET</span>
        <h1>Store</h1>
        <h2>A basket full of<br /><em>good things.</em></h2>
        <p>Everyday essentials. New favourites. A little inspiration for your next meal.</p>
        <a href="#products" class="hero-link" (click)="$event.preventDefault(); browse()"
          >Explore the shelves <span aria-hidden="true">↓</span></a
        >
      </div>
      <img
        src="assets/img/market-basket.svg"
        alt="A basket filled with fresh market favourites"
      /><span class="hero-stamp" aria-hidden="true">GOOD FOOD<br />GOOD MOOD</span>
    </section>
    <div class="shop-layout store-layout" id="products">
      <app-cart />
      <section class="shelves">
        <div class="section-heading">
          <div>
            <span class="eyebrow">FIND YOUR FAVOURITES</span>
            <h2>The market shelves</h2>
          </div>
          <span class="result-count">{{ products().length }} products</span>
        </div>
        <form class="search" (ngSubmit)="loadProducts()">
          <label
            >Find a product<input
              type="search"
              name="search"
              [(ngModel)]="search"
              placeholder="Find product" /></label
          ><button type="submit" [disabled]="loading()">Search</button>
        </form>
        <nav class="categories" aria-label="Product categories">
          <button type="button" [class.selected]="!category" (click)="filter('')">
            All products
          </button>
          @for (name of categories; track name) {
            <button type="button" [class.selected]="category === name" (click)="filter(name)">
              {{ name }}
            </button>
          }
        </nav>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        @if (loading()) {
          <p role="status">Loading products…</p>
        }
        <div class="products">
          @for (product of products(); track product.id) {
            <article class="panel product">
              <div class="product-media">
                <img
                  [src]="product.image"
                  [alt]="product.name"
                  loading="lazy"
                  (error)="imageError($event)"
                />
              </div>
              <div class="product-body">
                <span class="product-category">{{ product.category }}</span>
                <h2>{{ product.name }}</h2>
                <div class="product-bottom">
                  <p>{{ product.price | currency: 'USD' }}</p>
                  <button
                    type="button"
                    (click)="add(product)"
                    [disabled]="cart.busy() || loading()"
                  >
                    Add to cart <span aria-hidden="true">+</span>
                  </button>
                </div>
              </div>
            </article>
          } @empty {
            @if (!loading()) {
              <p>No products found.</p>
            }
          }
        </div>
      </section>
    </div>
  `,
})
export class StorePage implements OnInit {
  private readonly api = inject(ApiService);
  readonly cart = inject(CartService);
  readonly categories = categories;
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  search = '';
  category = '';
  private latestRequestId = 0;
  readonly imageError = imageError;

  browse() {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async ngOnInit() {
    await Promise.all([
      this.loadProducts(),
      this.cart.load().catch((error) => this.error.set(message(error))),
    ]);
  }

  filter(category: string) {
    this.category = category;
    this.search = '';
    void this.loadProducts();
  }

  async loadProducts() {
    const requestId = ++this.latestRequestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const products = await this.api.products(this.category, this.search);
      if (requestId === this.latestRequestId) {
        this.products.set(products);
      }
    } catch (error) {
      if (requestId === this.latestRequestId) {
        this.error.set(message(error));
      }
    } finally {
      if (requestId === this.latestRequestId) {
        this.loading.set(false);
      }
    }
  }

  async add(product: Product) {
    this.error.set('');
    try {
      await this.cart.add(product);
    } catch (error) {
      this.error.set(message(error));
    }
  }
}

@Component({
  selector: 'app-management',
  imports: [FormsModule, ReactiveFormsModule, CurrencyPipe],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">BEHIND THE COUNTER</span>
        <h1>Product manager</h1>
        <p>Keep the shelves full of good things.</p>
      </div>
      <span class="workspace-badge">MARKET WORKSPACE</span>
    </div>
    <div class="shop-layout management-layout">
      <section class="panel editor-panel">
        <h2>{{ editing ? 'Edit product' : 'Add product' }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <label>Product name<input formControlName="name" required /></label>
          <label
            >Category<select formControlName="category">
              @for (name of categories; track name) {
                <option [value]="name">{{ name }}</option>
              }
            </select></label
          >
          <label
            >Price<input formControlName="price" inputmode="decimal" placeholder="0.00" required
          /></label>
          <div class="image-upload-field">
            <label for="product-image">Product image</label>
            <div class="image-upload-control" [class.disabled]="saving()">
              <input
                id="product-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-describedby="product-image-hint"
                (change)="selectImage($event)"
                [disabled]="saving()"
              />
              <div class="image-upload-content">
                @if (preview() || form.controls.image.value) {
                  <img [src]="preview() || form.controls.image.value" alt="Product image preview" />
                } @else {
                  <span class="image-upload-placeholder" aria-hidden="true">+</span>
                }
                <span class="image-upload-description"
                  ><span class="image-upload-name">{{
                    fileName() ||
                      (form.controls.image.value ? 'Current image' : 'No image selected')
                  }}</span
                  ><span class="image-upload-action">{{
                    preview() || form.controls.image.value ? 'Change image' : 'Choose image'
                  }}</span></span
                >
              </div>
            </div>
          </div>
          <p class="hint" id="product-image-hint">PNG, JPEG, or WebP, up to 5 MB.</p>
          <p class="hint">Enter a price with two decimal places, such as 10.00.</p>
          <div class="actions">
            <button type="submit" [disabled]="saving()">Save product</button
            ><button type="button" class="secondary" (click)="reset()" [disabled]="saving()">
              New product
            </button>
          </div>
        </form>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        @if (saved()) {
          <p role="status">Product saved.</p>
        }
      </section>
      <section>
        <form class="search" (ngSubmit)="load()">
          <label>Find a product<input type="search" name="search" [(ngModel)]="search" /></label
          ><button type="submit" [disabled]="loading()">Search</button>
        </form>
        <label
          >Category<select [(ngModel)]="category" (ngModelChange)="load()">
            <option value="">All products</option>
            @for (name of categories; track name) {
              <option [value]="name">{{ name }}</option>
            }
          </select></label
        >
        @if (loading()) {
          <p role="status">Loading products…</p>
        }
        <div class="products">
          @for (product of products(); track product.id) {
            <article class="panel product">
              <div class="product-media">
                <img
                  [src]="product.image"
                  [alt]="product.name"
                  loading="lazy"
                  (error)="imageError($event)"
                />
              </div>
              <div class="product-body">
                <span class="product-category">{{ product.category }}</span>
                <h2>{{ product.name }}</h2>
                <p class="product-price">{{ product.price | currency: 'USD' }}</p>
                <button
                  class="secondary"
                  type="button"
                  (click)="edit(product)"
                  [disabled]="saving()"
                >
                  Edit {{ product.name }} <span aria-hidden="true">↗</span>
                </button>
              </div>
            </article>
          } @empty {
            @if (!loading()) {
              <p>No products found.</p>
            }
          }
        </div>
      </section>
    </div>
  `,
})
export class ManagementPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly categories = categories;
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly preview = signal('');
  readonly fileName = signal('');
  private selectedFile: File | null = null;
  search = '';
  category = '';
  editing = '';
  private latestRequestId = 0;
  readonly imageError = imageError;
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    category: [categories[0]!, Validators.required],
    price: ['', [Validators.required, priceValidator]],
    image: [
      '',
      Validators.pattern(
        /^(https?:\/\/.+|\/products\/(?:uploads\/)?[a-z0-9-]+\.(?:png|jpg|webp))$/,
      ),
    ],
  });

  ngOnInit() {
    void this.load();
  }

  async load() {
    const requestId = ++this.latestRequestId;
    this.loading.set(true);
    try {
      const products = await this.api.products(this.category, this.search);
      if (requestId === this.latestRequestId) {
        this.products.set(products);
      }
    } catch (error) {
      this.error.set(message(error));
    } finally {
      if (requestId === this.latestRequestId) {
        this.loading.set(false);
      }
    }
  }

  selectImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.error.set('');
    this.saved.set(false);
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      this.error.set('Choose a PNG, JPEG, or WebP image up to 5 MB.');
      return;
    }
    this.clearSelection();
    this.selectedFile = file;
    this.fileName.set(file.name);
    this.preview.set(URL.createObjectURL(file));
  }

  private clearSelection() {
    if (this.preview()) {
      URL.revokeObjectURL(this.preview());
    }
    this.preview.set('');
    this.fileName.set('');
    this.selectedFile = null;
  }

  ngOnDestroy() {
    this.clearSelection();
  }

  edit(product: Product) {
    this.clearSelection();
    this.editing = product.id;
    this.form.setValue({
      name: product.name,
      category: product.category,
      price: product.price.toFixed(2),
      image: product.image,
    });
    this.saved.set(false);
    this.error.set('');
  }

  reset() {
    this.clearSelection();
    this.editing = '';
    this.form.reset({ name: '', category: categories[0]!, price: '', image: '' });
    this.saved.set(false);
    this.error.set('');
  }

  async save() {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid || (!this.selectedFile && !this.form.controls.image.value)) {
      this.form.markAllAsTouched();
      this.error.set('Check the product name, category, price, and choose an image.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.saved.set(false);
    try {
      if (this.selectedFile) {
        const upload = await this.api.uploadProductImage(this.selectedFile);
        if (!upload.success || !upload.image) {
          throw new Error('Image was not uploaded. Please try again.');
        }
        this.form.controls.image.setValue(upload.image);
        this.clearSelection();
      }
      const values = this.form.getRawValue();
      const result = await this.api.saveProduct({
        ...values,
        price: Number(values.price),
        ...(this.editing ? { id: this.editing } : {}),
      });
      if (!result.success) {
        throw new Error('Product was not saved. Check for a duplicate product name.');
      }
      this.reset();
      this.saved.set(true);
      await this.load();
    } catch (error) {
      this.error.set(message(error));
    } finally {
      this.saving.set(false);
    }
  }
}
function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
function imageError(event: Event) {
  const image = event.target as HTMLImageElement;
  if (!image.src.endsWith('/assets/img/market-basket.svg')) {
    image.src = '/assets/img/market-basket.svg';
  }
}
