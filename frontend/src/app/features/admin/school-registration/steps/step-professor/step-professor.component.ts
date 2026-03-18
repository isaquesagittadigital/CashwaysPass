import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SchoolRegistrationService, MonitorData } from '../../registration.service';
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
    monitorForm: FormGroup;
    monitors$ = this.registrationService.monitors$;
    icons = { Plus, Search, Trash2, Edit, ChevronLeft, ChevronRight, CheckCircle2 };

    // Filtering
    searchTerm$ = new BehaviorSubject<string>('');
    grauFilter$ = new BehaviorSubject<string>('');
    statusFilter$ = new BehaviorSubject<string>('');

    filteredMonitores$ = combineLatest([
        this.monitors$,
        this.searchTerm$,
        this.grauFilter$,
        this.statusFilter$
    ]).pipe(
        map(([monitors, search, grau, status]) => {
            return monitors.filter(p => {
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
        this.monitorForm = this.fb.group({
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
    monitorToDelete: string | null = null;
    
    // Toast State
    showSuccessToast = false;
    toastMessage = '';
    toastTimeout: any;

    ngOnInit(): void { }

    addMonitor() {
        if (this.monitorForm.valid) {
            const monitor: MonitorData = {
                ...this.monitorForm.value,
                status: 'active'
            };

            if (this.isEditing && this.editingId) {
                this.registrationService.updateMonitor(this.editingId, monitor);
                this.showToast('Monitor atualizado com sucesso!');
                this.isEditing = false;
                this.editingId = null;
            } else {
                this.registrationService.addMonitor(monitor);
                this.showToast('Monitor cadastrado com sucesso!');
            }

            this.monitorForm.reset({
                escolaridade: ''
            });
        } else {
            this.monitorForm.markAllAsTouched();
        }
    }

    editMonitor(monitor: MonitorData) {
        this.isEditing = true;
        this.editingId = monitor.id || null;
        this.monitorForm.patchValue({
            nome: monitor.nome,
            escolaridade: monitor.escolaridade,
            email: monitor.email
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    removeMonitor(id: string) {
        this.monitorToDelete = id;
        this.showDeleteConfirm = true;
    }

    confirmDelete() {
        if (this.monitorToDelete) {
            this.registrationService.removeMonitor(this.monitorToDelete);
            this.showToast('Monitor removido com sucesso!');
            this.showDeleteConfirm = false;
            this.monitorToDelete = null;

            // Reset form if deleting the currently editing item
            if (this.isEditing && this.editingId === this.monitorToDelete) {
                this.isEditing = false;
                this.editingId = null;
                this.monitorForm.reset({ escolaridade: '' });
            }
        }
    }

    cancelDelete() {
        this.showDeleteConfirm = false;
        this.monitorToDelete = null;
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
