import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SchoolRegistrationService, ProfessorData } from '../../registration.service';
import { LucideAngularModule, Plus, Search, Trash2, Edit, ChevronLeft, ChevronRight } from 'lucide-angular';
import { BehaviorSubject, combineLatest, map } from 'rxjs';

@Component({
    selector: 'app-step-professor',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
    templateUrl: './step-professor.component.html',
    styleUrls: ['./step-professor.component.css']
})
export class StepProfessorComponent implements OnInit {
    professorForm: FormGroup;
    professors$ = this.registrationService.professors$;
    icons = { Plus, Search, Trash2, Edit, ChevronLeft, ChevronRight };

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

    ngOnInit(): void { }

    addProfessor() {
        if (this.professorForm.valid) {
            const professor: ProfessorData = {
                ...this.professorForm.value,
                status: 'active'
            };
            this.registrationService.addProfessor(professor);
            this.professorForm.reset({
                escolaridade: ''
            });
        } else {
            this.professorForm.markAllAsTouched();
        }
    }

    removeProfessor(id: string) {
        this.registrationService.removeProfessor(id);
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
