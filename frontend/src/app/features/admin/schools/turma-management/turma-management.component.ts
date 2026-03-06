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
            periodo: ['', Validators.required],
            serie: ['', Validators.required],
            professor_id: [''],
            quantidade_alunos: [0, Validators.required],
            data_inicio: [''],
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
        this.showModal = true;
    }

    openEditModal(turma: any) {
        this.isEditing = true;
        this.editingId = turma.id;
        this.turmaForm.patchValue(turma);
        this.showModal = true;
    }

    onSubmit() {
        if (this.turmaForm.valid) {
            const data = { ...this.turmaForm.value, escola_id: this.schoolId };
            const obs = this.isEditing
                ? this.schoolService.updateTurma(this.editingId!, data)
                : this.schoolService.createTurma(data);

            obs.subscribe({
                next: () => {
                    this.showModal = false;
                    this.loadTurmas();
                },
                error: (err) => alert('Erro ao salvar turma: ' + err.message)
            });
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
