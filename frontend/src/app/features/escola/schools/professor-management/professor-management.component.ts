import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolManagementService } from '../../../../core/services/school-management.service';
import { DeleteConfirmModalComponent } from '../../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';
import { LucideAngularModule, UserPlus, Edit, Trash2, Users, X, Plus, Save, Search, ChevronLeft, ChevronRight, RefreshCw, ChevronDown } from 'lucide-angular';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ActionSuccessModalComponent } from '../../../../shared/components/success-modal/success-modal.component';

@Component({
    selector: 'app-professor-management',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, ReactiveFormsModule, FormsModule, DeleteConfirmModalComponent, ActionSuccessModalComponent],
    templateUrl: './professor-management.component.html',
    styleUrls: ['./professor-management.component.css']
})
export class ProfessorManagementComponent implements OnInit {
    icons = { UserPlus, Edit, Trash2, Users, X, Plus, Save, Search, ChevronLeft, ChevronRight, RefreshCw, User: Users, ChevronDown };
    @Input() schoolId!: string;
    @Input() turmaId: string | null = null;
    @Output() onChanged = new EventEmitter<void>();
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

    // Modais
    showDeleteModal = false;
    deleteId: string | null = null;
    deleteLoading = false;

    showSuccessModal = false;
    successModalTitle = '';
    successModalMessage = '';

    showModal = false;
    isEditing = false;
    editingId: string | null = null;
    professorForm: FormGroup;

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

    ngOnChanges(): void {
        this.loadProfessors();
    }

    ngOnInit(): void {
        this.loadProfessors();
    }

    get statusValue(): boolean {
        return this.professorForm.get('status')?.value === 'active';
    }

    toggleStatus() {
        const current = this.professorForm.get('status')?.value;
        this.professorForm.patchValue({
            status: current === 'active' ? 'inactive' : 'active'
        });
    }

    loadProfessors() {
        if (!this.schoolId) return;
        this.isLoading = true;
        this.schoolService.getProfessorsBySchool(this.schoolId, this.turmaId || undefined).subscribe({
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
            // Filter out softly deleted professors just in case the backend query returns them
            if (prof.deleted === true || prof.excluido === 'sim') return false;

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

    closeModal() {
        this.showModal = false;
        this.isEditing = false;
        this.editingId = null;
        this.professorForm.reset({ status: 'active' });
    }

    openAddModal() {
        this.isEditing = false;
        this.editingId = null;
        this.professorForm.reset({ status: 'active' });
        this.showModal = true;
    }

    openEditModal(prof: any) {
        this.isEditing = true;
        this.editingId = prof.id;
        this.professorForm.patchValue(prof);
        this.showModal = true;
    }

    onSubmit() {
        if (this.professorForm.valid) {
            this.isSubmitting = true;
            const data = {
                ...this.professorForm.value,
                escola_id: this.schoolId,
                tipo_acesso: 'Professor',
                turmaID: this.turmaId
            };

            const obs = this.isEditing
                ? this.schoolService.updateProfessor(this.editingId!, data)
                : this.schoolService.createProfessor(data);

            obs.subscribe({
                next: () => {
                    this.isSubmitting = false;
                    const wasEditing = this.isEditing;
                    // Show success modal according to image text
                    if (wasEditing) {
                        this.successModalTitle = 'Alterações salvas!';
                        this.successModalMessage = 'As alterações foram salvas com sucesso.';
                    } else {
                        this.successModalTitle = 'Monitor cadastrado';
                        this.successModalMessage = 'O monitor foi cadastrado com sucesso!';
                    }
                    this.showSuccessModal = true;
                    this.closeModal();

                    this.loadProfessors();
                    this.onChanged.emit();
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

                // Show success modal for deletion
                this.successModalTitle = 'Monitor excluído!';
                this.successModalMessage = 'O monitor foi excluído com sucesso!';
                this.showSuccessModal = true;
            },
            error: (err) => {
                this.deleteLoading = false;
                alert('Erro na exclusão: ' + (err?.message || JSON.stringify(err)));
            }
        });
    }

    cancelDelete() {
        this.showDeleteModal = false;
        this.deleteId = null;
    }
}
