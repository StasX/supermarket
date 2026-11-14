import { Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Product } from '../../models/api.models';

@Component({
  selector: 'article[app-product-card]',
  imports: [CurrencyPipe],
  host: { class: 'panel product' },
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly disabled = input(false);
  readonly mode = input<'shop' | 'manage'>('shop');
  readonly selected = output<Product>();
  imageError(event: Event) {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/assets/img/market-basket.svg')) {
      image.src = '/assets/img/market-basket.svg';
    }
  }
}
