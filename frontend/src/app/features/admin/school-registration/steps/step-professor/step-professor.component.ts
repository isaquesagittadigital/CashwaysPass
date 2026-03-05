import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SchoolRegistrationService, ProfessorData } from '../../registration.service';
import { LucideAngularModule, Plus, Search, Trash2, Edit } from 'lucide-angular';

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
    icons = { Plus, Search, Trash2, Edit };

    escolaridadeOptions = [
        { label: 'Graduação', value: 'Graduação' },
        { label: 'Pós-graduação', value: 'Pós-graduação' },
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

    onNext() {
        this.registrationService.setStep(3);
    }

    onBack() {
        this.registrationService.setStep(1);
    }
}
