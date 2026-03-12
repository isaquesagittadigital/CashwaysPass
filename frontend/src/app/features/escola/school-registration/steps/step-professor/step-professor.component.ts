import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SchoolRegistrationService, ProfessorData } from '../../registration.service';
import { LucideAngularModule, Plus, Search, Trash2, Edit, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-angular';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { DeleteConfirmModalComponent } from '../../../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';

@Component({
    selector: 'app-step-professor',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, DeleteConfirmModalComponent],
    templateUrl: './step-professor.component.html',
    styleUrls: ['./step-professor.component.css']
})
export class StepProfessorComponent implements OnInit {
    professorForm: FormGroup;
    professors$ = this.registrationService.professors$;
    icons = { Plus, Search, Trash2, Edit, ChevronLeft, ChevronRight, CheckCircle2 };

    // Filtering
    searchTerm$ = new BehaviorSubject<string>('');
    grauFilter$ = new BehaviorSubject<string>('');
    statusFilter$ = new BehaviorSubject<string>('');

    filteredProfessors$ = combineLatest([
        this.professors$,
        this.searchTerm$,
        this.grauFilter$,
        this.statusFilter$
    ]).pipe(
        map(([professors, search, grau, status]) => {
            return professors.filter(p => {
                const matchesSearch = !search || p.nome.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase());
                const matchesGrau = !grau || p.escolaridade === grau;
                const matchesStatus = !status || p.status === status;
                return matchesSearch && matchesGrau && matchesStatus;
            });
        })
    );

    escolaridadeOptions = [
        { label: 'Superior Completo', value: 'Superior Completo' },
        { label: 'Pós-Graduação', value: 'Pós-Graduação' },
        { label: 'Mestrado', value: 'Mestrado' },
        { label: 'Doutorado', value: 'Doutorado' }
    ];

    constructor(
        private fb: FormBuilder,
        private registrationService: SchoolRegistrationService
    ) {
        this.professorForm = this.fb.group({
            nome: ['', Validators.required],
            escolaridade: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]]
        });
    }

    // Edit State
    isEditing = false;
    editingId: string | null = null;
    
    // Auth & Modals State
    showDeleteConfirm = false;
    professorToDelete: string | null = null;
    
    // Toast State
    showSuccessToast = false;
    toastMessage = '';
    toastTimeout: any;

    ngOnInit(): void { }

    addProfessor() {
        if (this.professorForm.valid) {
            const professor: ProfessorData = {
                ...this.professorForm.value,
                status: 'active'
            };

            if (this.isEditing && this.editingId) {
                this.registrationService.updateProfessor(this.editingId, professor);
                this.showToast('Professor atualizado com sucesso!');
                this.isEditing = false;
                this.editingId = null;
            } else {
                this.registrationService.addProfessor(professor);
                this.showToast('Professor cadastrado com sucesso!');
            }

            this.professorForm.reset({
                escolaridade: ''
            });
        } else {
            this.professorForm.markAllAsTouched();
        }
    }

    editProfessor(professor: ProfessorData) {
        this.isEditing = true;
        this.editingId = professor.id || null;
        this.professorForm.patchValue({
            nome: professor.nome,
            escolaridade: professor.escolaridade,
            email: professor.email
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    removeProfessor(id: string) {
        this.professorToDelete = id;
        this.showDeleteConfirm = true;
    }

    confirmDelete() {
        if (this.professorToDelete) {
            this.registrationService.removeProfessor(this.professorToDelete);
            this.showToast('Professor removido com sucesso!');
            this.showDeleteConfirm = false;
            this.professorToDelete = null;

            // Reset form if deleting the currently editing item
            if (this.isEditing && this.editingId === this.professorToDelete) {
                this.isEditing = false;
                this.editingId = null;
                this.professorForm.reset({ escolaridade: '' });
            }
        }
    }

    cancelDelete() {
        this.showDeleteConfirm = false;
        this.professorToDelete = null;
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

    updateSearch(val: string) { this.searchTerm$.next(val); }
    updateGrau(val: string) { this.grauFilter$.next(val); }
    updateStatus(val: string) { this.statusFilter$.next(val); }

    onNext() {
        this.registrationService.setStep(3);
    }

    onBack() {
        this.registrationService.setStep(1);
    }
}
