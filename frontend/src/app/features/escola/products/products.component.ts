import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
    LucideAngularModule,
    ArrowLeft,
    Search,
    Plus,
    Eye,
    Pencil,
    Trash2,
    X,
    CalendarDays,
    Users,
    CheckCircle2,
    Upload,
    Package
} from 'lucide-angular';
import { ProdutoService, Produto, ProdutoForm } from '../../../core/services/produto.service';
import { DeleteConfirmModalComponent } from '../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';
import { SchoolService } from '../../../core/services/school.service';

@Component({
    selector: 'app-escola-products',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, DeleteConfirmModalComponent],
    templateUrl: '../../admin/products/products.component.html',
})
export class EscolaProductsComponent implements OnInit, OnDestroy {
    icons = { ArrowLeft, Search, Plus, Eye, Pencil, Trash2, X, CalendarDays, Users, CheckCircle2, Upload, Package };

    // Data
    products: Produto[] = [];
    loading = false;
    searchTerm = '';
    selectedSchoolId: string | null = null;
    private schoolSub?: Subscription;

    // Form Modal
    showFormModal = false;
    isEditing = false;
    editingProductId: string | null = null;
    formLoading = false;
    imageFile: File | null = null;
    imagePreview: string = '';
    form: ProdutoForm = this.getEmptyForm();

    // Delete Confirm Modal
    showDeleteModal = false;
    deleteProductId: string | null = null;
    deleteLoading = false;

    // Success Toast
    showSuccessToast = false;
    successTitle = '';
    successMessage = '';

    constructor(
        private produtoService: ProdutoService,
        private schoolService: SchoolService,
        private router: Router
    ) { }

    ngOnInit() {
        this.schoolSub = this.schoolService.selectedSchool$.subscribe(s => {
            this.selectedSchoolId = s?.id || null;
            if (this.selectedSchoolId) {
                this.loadProducts();
            }
        });
    }

    ngOnDestroy() {
        this.schoolSub?.unsubscribe();
    }

    getEmptyForm(): ProdutoForm {
        return {
            nome: '',
            descricao: '',
            preco: 0,
            url_imagem: '',
            categoria: '',
            data_vigencia_inicio: '',
            data_vigencia_final: '',
            limite_por_aluno: 2,
            status: true
        };
    }

    async loadProducts() {
        if (!this.selectedSchoolId) return;
        this.loading = true;
        try {
            this.products = await this.produtoService.getProducts(
                this.selectedSchoolId,
                this.searchTerm
            );
        } catch (error) {
            console.error('Error loading products:', error);
        } finally {
            this.loading = false;
        }
    }

    onSearch() {
        this.loadProducts();
    }

    goBack() {
        this.router.navigate(['/escola/dashboard']);
    }

    formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('pt-BR');
    }

    formatDateRange(inicio: string, final_: string): string {
        return `${this.formatDate(inicio)} - ${this.formatDate(final_)}`;
    }

    openCreateModal() {
        this.isEditing = false;
        this.editingProductId = null;
        this.form = this.getEmptyForm();
        this.imageFile = null;
        this.imagePreview = '';
        this.showFormModal = true;
    }

    openEditModal(product: Produto) {
        this.isEditing = true;
        this.editingProductId = product.id;
        this.form = {
            nome: product.nome,
            descricao: product.descricao,
            preco: product.preco,
            url_imagem: product.url_imagem,
            categoria: product.categoria || '',
            data_vigencia_inicio: product.data_vigencia_inicio,
            data_vigencia_final: product.data_vigencia_final,
            limite_por_aluno: product.limite_por_aluno,
            status: product.status
        };
        this.imageFile = null;
        this.imagePreview = product.url_imagem || '';
        this.showFormModal = true;
    }

    closeFormModal() {
        this.showFormModal = false;
        this.editingProductId = null;
    }

    onImageSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            this.imageFile = input.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                this.imagePreview = e.target?.result as string;
            };
            reader.readAsDataURL(this.imageFile);
        }
    }

    async submitForm() {
        if (!this.form.nome.trim() || !this.selectedSchoolId) return;
        this.formLoading = true;
        try {
            if (this.imageFile) {
                const imageUrl = await this.produtoService.uploadProductImage(this.imageFile);
                if (imageUrl) this.form.url_imagem = imageUrl;
            }

            let result;
            if (this.isEditing && this.editingProductId) {
                result = await this.produtoService.updateProduct(this.editingProductId, this.form);
                if (result.success) this.showSuccess('Alterações salvas!', 'As alterações no produto foram salvas com sucesso!');
            } else {
                result = await this.produtoService.createProduct(this.form, this.selectedSchoolId);
                if (result.success) this.showSuccess('Produto cadastrado!', 'O produto foi cadastrado com sucesso!');
            }

            if (result.success) {
                this.closeFormModal();
                await this.loadProducts();
            }
        } catch (error) {
            console.error('Error saving product:', error);
        } finally {
            this.formLoading = false;
        }
    }

    openDeleteModal(productId: string) {
        this.deleteProductId = productId;
        this.showDeleteModal = true;
    }

    closeDeleteModal() {
        this.showDeleteModal = false;
        this.deleteProductId = null;
    }

    async confirmDelete() {
        if (!this.deleteProductId) return;
        this.deleteLoading = true;
        try {
            const result = await this.produtoService.deleteProduct(this.deleteProductId);
            if (result.success) {
                this.closeDeleteModal();
                this.showSuccess('Produto excluído!', 'O produto foi excluído com sucesso!');
                await this.loadProducts();
            }
        } catch (error) {
            console.error('Error deleting product:', error);
        } finally {
            this.deleteLoading = false;
        }
    }

    showSuccess(title: string, message: string) {
        this.successTitle = title;
        this.successMessage = message;
        this.showSuccessToast = true;
    }

    closeSuccessToast() {
        this.showSuccessToast = false;
    }
}
