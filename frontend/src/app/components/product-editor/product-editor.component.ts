import { Component, inject, OnDestroy, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Product } from '../../models/api.models';
import { categories } from '../../constants/product-categories';
import { priceValidator } from '../../validators/validators';
import { message } from '../../utils/error-message';

@Component({
  selector: 'section[app-product-editor]',
  imports: [ReactiveFormsModule],
  host: { class: 'panel editor-panel' },
  templateUrl: './product-editor.component.html',
})
export class ProductEditorComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  readonly productSaved = output<void>();
  readonly categories = categories;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly preview = signal('');
  readonly fileName = signal('');
  private selectedFile: File | null = null;
  editing = '';
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
      this.productSaved.emit();
    } catch (error) {
      this.error.set(message(error));
    } finally {
      this.saving.set(false);
    }
  }
}
