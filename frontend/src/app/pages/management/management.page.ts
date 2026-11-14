import { Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Product } from '../../models/api.models';
import { categories } from '../../constants/product-categories';
import { ProductEditorComponent } from '../../components/product-editor/product-editor.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { message } from '../../utils/error-message';

@Component({
  selector: 'app-management',
  imports: [FormsModule, ProductEditorComponent, ProductCardComponent],
  templateUrl: './management.page.html',
  styleUrl: './management.page.scss',
})
export class ManagementPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly categories = categories;
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly deleting = signal(false);
  readonly pendingDelete = signal<Product | null>(null);
  readonly deleted = signal('');
  private readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
  private readonly editorComponent = viewChild.required(ProductEditorComponent);
  search = '';
  category = '';
  private latestRequestId = 0;

  ngOnInit() {
    void this.load();
  }

  requestDelete(product: Product) {
    if (this.deleting() || this.editorComponent().saving()) return;
    this.error.set('');
    this.deleted.set('');
    this.pendingDelete.set(product);
    this.deleteDialog().nativeElement.showModal();
  }

  cancelDelete(event?: Event) {
    if (this.deleting()) {
      event?.preventDefault();
      return;
    }
    this.pendingDelete.set(null);
    this.deleteDialog().nativeElement.close();
  }

  async confirmDelete() {
    const product = this.pendingDelete();
    if (!product || this.deleting()) return;
    this.deleting.set(true);
    this.error.set('');
    try {
      const result = await this.api.deleteProduct(product.id);
      if (!result.success)
        throw new Error('Product could not be deleted. It may already have been removed.');
      this.products.update((products) => products.filter((item) => item.id !== product.id));
      if (this.editorComponent().editing === product.id) this.editorComponent().reset();
      this.deleted.set(`${product.name} deleted.`);
      this.pendingDelete.set(null);
      this.deleteDialog().nativeElement.close();
      await this.load();
    } catch {
      this.error.set('Unable to delete the product. Please try again.');
    } finally {
      this.deleting.set(false);
    }
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
}
