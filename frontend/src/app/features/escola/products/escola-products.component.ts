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
    PlusCircle,
    Users,
    Image,
    Package,
    Calendar,
    Upload,
    CheckCircle2
} from 'lucide-angular';
import { ProdutoService, Produto, ProdutoForm } from '../../../core/services/produto.service';
import { DeleteConfirmModalComponent } from '../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';
import { SchoolService, School } from '../../../core/services/school.service';
import { supabase } from '../../../core/supabase';

@Component({
    selector: 'app-escola-products',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, DeleteConfirmModalComponent],
    templateUrl: './escola-products.component.html',
})
export class EscolaProductsComponent implements OnInit, OnDestroy { 
    // Triggering re-save
    icons = { ArrowLeft, Search, Plus, Eye, Pencil, Trash2, X, PlusCircle, Users, Image, Package, Calendar, Upload, CheckCircle2 };

    // Data
    products: Produto[] = [];
    loading = false;
    searchTerm = '';
    selectedSchoolId: string | null = null;
    turmas: any[] = [];
    selectedTurma: string = '';
    selectedTurmaId: string = ''; // Used for the form select
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

    // Details Modal
    showDetailsModal = false;
    selectedDetailsProduct: Produto | null = null;

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
            this.selectedTurma = '';
            this.loadTurmas();
            this.loadProducts();
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
            status: true,
            turma_ids: [],
            quantidade: 0
        };
    }

    async loadProducts() {
        this.loading = true;
        this.products = await this.produtoService.getProducts(
            this.selectedSchoolId || undefined,
            this.searchTerm
        );
        this.loading = false;
    }

    async loadTurmas() {
        this.turmas = [];
        if (!this.selectedSchoolId) return;
        try {
            const { data } = await supabase.from('turma').select('id, serie, nome').eq('escola_id', this.selectedSchoolId);
            this.turmas = data || [];
        } catch (error) {
            console.error('Error loading turmas', error);
        }
    }

    onSearch() {
        this.loadProducts();
    }

    goBack() {
        this.router.navigate(['/escola/dashboard']);
    }

    getTurmaName(turmaId: string): string {
        const turma = this.turmas.find(t => t.id === turmaId);
        return turma ? `${turma.serie ? turma.serie + ' ' : ''}${turma.nome}` : 'Turma desconhecida';
    }

    addTurma() {
        if (this.selectedTurmaId && !this.form.turma_ids.includes(this.selectedTurmaId)) {
            this.form.turma_ids.push(this.selectedTurmaId);
        }
        this.selectedTurmaId = '';
    }

    removeTurma(id: string) {
        this.form.turma_ids = this.form.turma_ids.filter(t => t !== id);
    }

    // --- Currency formatting ---
    formatCurrency(value: number): string {
        return `R$${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('pt-BR');
    }

    formatDateRange(inicio: string, final_: string): string {
        return `${this.formatDate(inicio)} - ${this.formatDate(final_)}`;
    }

    // --- Form Modal ---
    openCreateModal() {
        this.isEditing = false;
        this.editingProductId = null;
        this.form = this.getEmptyForm();
        this.imageFile = null;
        this.imagePreview = '';
        this.selectedTurmaId = '';
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
            status: product.status,
            turma_ids: [...(product.turma_ids || [])],
            quantidade: product.quantidade || 0
        };
        this.selectedTurmaId = '';
        this.imageFile = null;
        this.imagePreview = product.url_imagem || '';
        this.showFormModal = true;
    }

    openDetailsModal(product: Produto) {
        this.selectedDetailsProduct = product;
        this.showDetailsModal = true;
    }

    closeDetailsModal() {
        this.showDetailsModal = false;
        this.selectedDetailsProduct = null;
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
        if (!this.form.nome.trim()) return;
        this.formLoading = true;

        if (this.imageFile) {
            try {
                const imageUrl = await this.produtoService.uploadProductImage(this.imageFile);
                if (imageUrl) {
                    this.form.url_imagem = imageUrl;
                }
            } catch (error) {
                console.error('Failed to upload image:', error);
                alert('Erro ao fazer upload da imagem. O produto será salvo sem alteração na imagem ou tente novamente.');
                this.formLoading = false;
                return;
            }
        }

        let result;
        if (this.isEditing && this.editingProductId) {
            result = await this.produtoService.updateProduct(this.editingProductId, this.form);
            if (result.success) {
                this.showSuccess('Alterações salvas!', 'As alterações no produtos foram salvas com sucesso!');
            }
        } else {
            if (!this.selectedSchoolId) {
                alert('Selecione uma escola para cadastrar o produto.');
                this.formLoading = false;
                return;
            }
            result = await this.produtoService.createProduct(this.form, this.selectedSchoolId);
            if (result.success) {
                this.showSuccess('Produto cadastrado!', 'O produto foi cadastrado com sucesso!');
            }
        }

        this.formLoading = false;

        if (result.success) {
            this.closeFormModal();
            await this.loadProducts();
        } else {
            alert('Erro ao salvar produto. Tente novamente.');
        }
    }

    // --- Delete Modal ---
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

        const result = await this.produtoService.deleteProduct(this.deleteProductId);
        this.deleteLoading = false;

        if (result.success) {
            this.closeDeleteModal();
            this.showSuccess('Produto excluído!', 'O produto foi excluído com sucesso!');
            await this.loadProducts();
        } else {
            alert('Erro ao excluir produto. Tente novamente.');
        }
    }

    // --- Success Toast ---
    showSuccess(title: string, message: string) {
        this.successTitle = title;
        this.successMessage = message;
        this.showSuccessToast = true;
    }

    closeSuccessToast() {
        this.showSuccessToast = false;
    }
}
