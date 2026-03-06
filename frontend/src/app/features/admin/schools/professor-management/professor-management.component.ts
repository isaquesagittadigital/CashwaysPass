import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolManagementService } from '../../../../core/services/school-management.service';
import { DeleteConfirmModalComponent } from '../../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';
import { LucideAngularModule, UserPlus, Edit, Trash2, Users, X, Plus, Save, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-angular';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';

@Component({
    selector: 'app-professor-management',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, ReactiveFormsModule, FormsModule, DeleteConfirmModalComponent],
    templateUrl: './professor-management.component.html',
    styleUrls: ['./professor-management.component.css']
})
export class ProfessorManagementComponent implements OnInit {
    icons = { UserPlus, Edit, Trash2, Users, X, Plus, Save, Search, ChevronLeft, ChevronRight, RefreshCw };
    @Input() schoolId!: string;
    allProfessors: any[] = [];
    filteredProfessors: any[] = [];
    isLoading = true;
    isSubmitting = false;

    // Filters
    searchTerm: string = '';
    grauFilter: string = '';
    statusFilter: string = '';

    // Pagination
    currentPage: number = 1;
    pageSize: number = 10;
    protected Math = Math;

    showDeleteModal = false;
    deleteId: string | null = null;
    deleteLoading = false;

    showModal = false;
    isEditing = false;
    editingId: string | null = null;
    professorForm: FormGroup;

    // For toast feedback
    showToast = false;
    toastMessage = '';

    constructor(
        private schoolService: SchoolManagementService,
        private fb: FormBuilder
    ) {
        this.professorForm = this.fb.group({
            nome_completo: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            grau_escolaridade: ['', Validators.required],
            status: ['active']
        });
    }

    ngOnInit(): void {
        this.loadProfessors();
    }

    loadProfessors() {
        this.isLoading = true;
        this.schoolService.getProfessorsBySchool(this.schoolId).subscribe({
            next: (data) => {
                this.allProfessors = data;
                this.applyFilters();
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading professors:', err);
                this.isLoading = false;
            }
        });
    }

    applyFilters() {
        this.filteredProfessors = this.allProfessors.filter(prof => {
            const matchesSearch = !this.searchTerm ||
                prof.nome_completo?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                prof.email?.toLowerCase().includes(this.searchTerm.toLowerCase());

            const matchesGrau = !this.grauFilter || prof.grau_escolaridade === this.grauFilter;
            const matchesStatus = !this.statusFilter || prof.status === this.statusFilter;

            return matchesSearch && matchesGrau && matchesStatus;
        });
        this.currentPage = 1;
    }

    get paginatedProfessors() {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.filteredProfessors.slice(start, start + this.pageSize);
    }

    get totalPages() {
        return Math.ceil(this.filteredProfessors.length / this.pageSize);
    }

    nextPage() {
        if (this.currentPage < this.totalPages) this.currentPage++;
    }

    prevPage() {
        if (this.currentPage > 1) this.currentPage--;
    }

    openAddModal() {
        this.isEditing = false;
        this.editingId = null;
        this.professorForm.reset({ status: 'active' });
        this.showModal = false; // We use in-page form now
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    openEditModal(prof: any) {
        this.isEditing = true;
        this.editingId = prof.id;
        this.professorForm.patchValue(prof);
        this.showModal = false; // We use in-page form now
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    onSubmit() {
        if (this.professorForm.valid) {
            this.isSubmitting = true;
            const data = {
                ...this.professorForm.value,
                escola_id: this.schoolId,
                tipo_acesso: 'Professor'
            };

            const obs = this.isEditing
                ? this.schoolService.updateProfessor(this.editingId!, data)
                : this.schoolService.createProfessor(data);

            obs.subscribe({
                next: () => {
                    this.isSubmitting = false;
                    const wasEditing = this.isEditing;
                    this.isEditing = false;
                    this.professorForm.reset({ status: 'active' });

                    // Show success toast
                    this.toastMessage = wasEditing ? 'Professor atualizado com sucesso.' : 'Cadastro realizado com sucesso.';
                    this.showToast = true;
                    setTimeout(() => this.showToast = false, 3000);

                    this.loadProfessors();
                },
                error: (err) => {
                    this.isSubmitting = false;
                    alert('Erro ao salvar professor: ' + err.message);
                }
            });
        } else {
            this.professorForm.markAllAsTouched();
        }
    }

    onDelete(id: string) {
        this.deleteId = id;
        this.showDeleteModal = true;
    }

    confirmDelete() {
        if (!this.deleteId) return;
        this.deleteLoading = true;
        this.schoolService.deleteProfessor(this.deleteId).subscribe({
            next: () => {
                this.showDeleteModal = false;
                this.deleteLoading = false;
                this.deleteId = null;
                this.loadProfessors();
            },
            error: () => {
                this.deleteLoading = false;
            }
        });
    }

    cancelDelete() {
        this.showDeleteModal = false;
        this.deleteId = null;
    }
}
