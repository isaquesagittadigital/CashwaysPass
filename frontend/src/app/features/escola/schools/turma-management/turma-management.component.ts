import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolManagementService } from '../../../../core/services/school-management.service';
import { DeleteConfirmModalComponent } from '../../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';
import { LucideAngularModule, Plus, Edit, Trash2, Users, X, Save } from 'lucide-angular';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
    selector: 'app-turma-management',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, ReactiveFormsModule, DeleteConfirmModalComponent],
    templateUrl: './turma-management.component.html',
    styleUrls: ['./turma-management.component.css']
})
export class TurmaManagementComponent implements OnInit {
    icons = { Plus, Edit, Trash2, Users, X, Save };
    @Input() schoolId!: string;
    turmas: any[] = [];
    isLoading = true;
    isSubmitting = false;

    // Toast state
    showToast = false;
    toastMessage = '';

    showDeleteModal = false;
    deleteId: string | null = null;
    deleteLoading = false;

    showModal = false;
    isEditing = false;
    editingId: string | null = null;
    turmaForm: FormGroup;

    professors: any[] = [];

    constructor(
        private schoolService: SchoolManagementService,
        private fb: FormBuilder
    ) {
        this.turmaForm = this.fb.group({
            nome: ['', Validators.required],
            estagio: ['', Validators.required],
            Periodos: ['', Validators.required],
            serie: ['', Validators.required],
            professor_id: [''],
            quantidade_alunos: [0, Validators.required],
            data_inicio: [new Date().toISOString().split('T')[0]],
            status: [true]
        });
    }

    ngOnInit(): void {
        this.loadTurmas();
        this.loadProfessors();
    }

    loadTurmas() {
        this.isLoading = true;
        this.schoolService.getTurmasBySchool(this.schoolId).subscribe({
            next: (data) => {
                this.turmas = data;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading turmas:', err);
                this.isLoading = false;
            }
        });
    }

    loadProfessors() {
        this.schoolService.getProfessorsBySchool(this.schoolId).subscribe({
            next: (data) => this.professors = data,
            error: (err) => console.error('Error loading professors for selection:', err)
        });
    }

    openAddModal() {
        this.isEditing = false;
        this.editingId = null;
        this.turmaForm.reset({ status: true, quantidade_alunos: 0 });
        this.showModal = false; // We use in-page form now
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    openEditModal(turma: any) {
        this.isEditing = true;
        this.editingId = turma.id;
        this.turmaForm.patchValue(turma);
        this.showModal = false; // We use in-page form now
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    onSubmit() {
        if (this.turmaForm.valid) {
            this.isSubmitting = true;
            const data = { ...this.turmaForm.value, escola_id: this.schoolId };
            const obs = this.isEditing
                ? this.schoolService.updateTurma(this.editingId!, data)
                : this.schoolService.createTurma(data);

            obs.subscribe({
                next: () => {
                    this.isSubmitting = false;
                    const wasEditing = this.isEditing;
                    this.isEditing = false;
                    this.turmaForm.reset({
                        status: true,
                        quantidade_alunos: 0,
                        data_inicio: new Date().toISOString().split('T')[0],
                        Periodos: ''
                    });
                    this.loadTurmas();

                    // Show success toast
                    this.toastMessage = wasEditing ? 'Turma atualizada com sucesso' : 'Turma cadastrada com sucesso';
                    this.showToast = true;
                    setTimeout(() => this.showToast = false, 3000);
                },
                error: (err) => {
                    this.isSubmitting = false;
                    alert('Erro ao salvar turma: ' + err.message);
                }
            });
        } else {
            this.turmaForm.markAllAsTouched();
        }
    }

    onDelete(id: string) {
        this.deleteId = id;
        this.showDeleteModal = true;
    }

    confirmDelete() {
        if (!this.deleteId) return;
        this.deleteLoading = true;
        this.schoolService.deleteTurma(this.deleteId).subscribe({
            next: () => {
                this.showDeleteModal = false;
                this.deleteLoading = false;
                this.deleteId = null;
                this.loadTurmas();
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
