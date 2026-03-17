import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ChevronLeft, ChevronRight, ShoppingCart, Tag } from 'lucide-angular';
import { ProdutoService, Produto } from '../../../core/services/produto.service';
import { ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-product-carousel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './product-carousel.component.html',
  styleUrls: ['./product-carousel.component.css']
})
export class ProductCarouselComponent implements OnInit {
  @Input() title: string = 'Produtos em Destaque';
  
  products: Produto[] = [];
  isLoading: boolean = true;
  currentIndex: number = 0;
  
  readonly icons = {
    ChevronLeft,
    ChevronRight,
    ShoppingCart,
    Tag
  };

  constructor(
    private productoService: ProdutoService,
    private profileService: ProfileService
  ) {}

  async ngOnInit() {
    await this.loadProducts();
  }

  async loadProducts() {
    this.isLoading = true;
    try {
      const profile = await this.profileService.getProfile();
      if (profile?.escola_id) {
        this.products = await this.productoService.getProducts(profile.escola_id);
      }
    } catch (error) {
      console.error('Error loading carousel products:', error);
    } finally {
      this.isLoading = false;
    }
  }

  next() {
    if (this.products.length <= 1) return;
    this.currentIndex = (this.currentIndex + 1) % this.products.length;
  }

  prev() {
    if (this.products.length <= 1) return;
    this.currentIndex = (this.currentIndex - 1 + this.products.length) % this.products.length;
  }

  setIndex(index: number) {
    this.currentIndex = index;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }
}
