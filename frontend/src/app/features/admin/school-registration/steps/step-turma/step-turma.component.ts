import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SchoolRegistrationService, TurmaData } from '../../registration.service';
import { LucideAngularModule, Plus, Trash2, Edit, CheckCircle2 } from 'lucide-angular';
import { DeleteConfirmModalComponent } from '../../../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';

@Component({
    selector: 'app-step-turma',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, DeleteConfirmModalComponent],
    templateUrl: './step-turma.component.html',
    styleUrls: ['./step-turma.component.css']
})
export class StepTurmaComponent implements OnInit {
    turmaForm: FormGroup;
    turmas$ = this.registrationService.turmas$;
    professors$ = this.registrationService.professors$;
    icons = { Plus, Trash2, Edit, CheckCircle2 };

    // Modals & Toast State
    showDeleteConfirm = false;
    turmaToDelete: string | null = null;
    showSuccessToast = false;
    toastMessage = '';
    toastTimeout: any;

    estagioOptions = [
        { label: 'Fundamental 1', value: 'Fundamental 1' },
        { label: 'Fundamental 2', value: 'Fundamental 2' },
        { label: 'Médio', value: 'Ensino Médio' }
    ];

    periodoOptions = [
        { label: 'Manhã', value: 'Manhã' },
        { label: 'Tarde', value: 'Tarde' },
        { label: 'Noite', value: 'Noite' }
    ];

    constructor(
        private fb: FormBuilder,
        private registrationService: SchoolRegistrationService
    ) {
        this.turmaForm = this.fb.group({
            nome: ['', Validators.required],
            estagio: ['', Validators.required],
            Periodos: ['', Validators.required],
            serie: ['', Validators.required],
            professor_id: ['', Validators.required],
            quantidade_alunos: [0, [Validators.required, Validators.min(1)]],
            data_inicio: ['', Validators.required]
        });
    }

    ngOnInit(): void { }

    // Edit State
    isEditing = false;
    editingId: string | null = null;

    addTurma() {
        if (this.turmaForm.valid) {
            const turma: TurmaData = {
                ...this.turmaForm.value,
                status: true
            };

            if (this.isEditing && this.editingId) {
                this.registrationService.updateTurma(this.editingId, turma);
                this.showToast('Turma atualizada com sucesso!');
                this.isEditing = false;
                this.editingId = null;
            } else {
                this.registrationService.addTurma(turma);
                this.showToast('Turma cadastrada com sucesso!');
            }

            this.turmaForm.reset({
                estagio: '',
                Periodos: '',
                professor_id: '',
                quantidade_alunos: 0,
                data_inicio: ''
            });
        } else {
            this.turmaForm.markAllAsTouched();
        }
    }

    editTurma(turma: TurmaData) {
        this.isEditing = true;
        this.editingId = turma.id || null;
        this.turmaForm.patchValue({
            nome: turma.nome,
            estagio: turma.estagio,
            Periodos: turma.Periodos,
            serie: turma.serie,
            professor_id: turma.professor_id,
            quantidade_alunos: turma.quantidade_alunos,
            data_inicio: turma.data_inicio
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    removeTurma(id: string) {
        this.turmaToDelete = id;
        this.showDeleteConfirm = true;
    }

    confirmDelete() {
        if (this.turmaToDelete) {
            this.registrationService.removeTurma(this.turmaToDelete);
            this.showToast('Turma removida com sucesso!');
            this.showDeleteConfirm = false;
            this.turmaToDelete = null;
        }
    }

    cancelDelete() {
        this.showDeleteConfirm = false;
        this.turmaToDelete = null;
    }

    showToast(message: string) {
        this.toastMessage = message;
        this.showSuccessToast = true;
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.showSuccessToast = false;
        }, 3000);
    }

    closeToast() {
        this.showSuccessToast = false;
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
    }

    getProfessorName(id: string, professors: any[] | null): string {
        if (!professors) return 'Desconhecido';
        const prof = professors.find(p => (p.id === id || p.usuario_id === id));
        return prof ? prof.nome : 'Desconhecido';
    }

    onNext() {
        this.registrationService.setStep(4);
    }

    onBack() {
        this.registrationService.setStep(2);
    }
}
