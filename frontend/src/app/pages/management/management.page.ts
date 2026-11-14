import { Component, inject, OnInit, signal } from '@angular/core';
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
})
export class ManagementPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly categories = categories;
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  search = '';
  category = '';
  private latestRequestId = 0;

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
}
