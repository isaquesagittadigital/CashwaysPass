import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolManagementService } from '../../../../core/services/school-management.service';
import { DeleteConfirmModalComponent } from '../../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';
import { LucideAngularModule, UserPlus, Edit, Trash2, Users, X, Plus, Save } from 'lucide-angular';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
    selector: 'app-professor-management',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, ReactiveFormsModule, DeleteConfirmModalComponent],
    templateUrl: './professor-management.component.html',
    styleUrls: ['./professor-management.component.css']
})
export class ProfessorManagementComponent implements OnInit {
    icons = { UserPlus, Edit, Trash2, Users, X, Plus, Save };
    @Input() schoolId!: string;
    professors: any[] = [];
    isLoading = true;
    isSubmitting = false;

    showDeleteModal = false;
    deleteId: string | null = null;
    deleteLoading = false;

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

    ngOnInit(): void {
        this.loadProfessors();
    }

    loadProfessors() {
        this.isLoading = true;
        this.schoolService.getProfessorsBySchool(this.schoolId).subscribe({
            next: (data) => {
                this.professors = data;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading professors:', err);
                this.isLoading = false;
            }
        });
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
                tipo_acesso: 'Professor'
            };

            const obs = this.isEditing
                ? this.schoolService.updateProfessor(this.editingId!, data)
                : this.schoolService.createProfessor(data);

            obs.subscribe({
                next: () => {
                    this.isSubmitting = false;
                    this.showModal = false;
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
