import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SchoolRegistrationService, TurmaData } from '../../registration.service';
import { LucideAngularModule, Plus, Trash2, Edit } from 'lucide-angular';

@Component({
    selector: 'app-step-turma',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
    templateUrl: './step-turma.component.html',
    styleUrls: ['./step-turma.component.css']
})
export class StepTurmaComponent implements OnInit {
    turmaForm: FormGroup;
    turmas$ = this.registrationService.turmas$;
    professors$ = this.registrationService.professors$;
    icons = { Plus, Trash2, Edit };

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
            periodo: ['', Validators.required],
            serie: ['', Validators.required],
            professor_id: ['', Validators.required],
            quantidade_alunos: [0, [Validators.required, Validators.min(1)]],
            data_inicio: ['', Validators.required]
        });
    }

    ngOnInit(): void { }

    addTurma() {
        if (this.turmaForm.valid) {
            const turma: TurmaData = {
                ...this.turmaForm.value,
                status: true
            };
            this.registrationService.addTurma(turma);
            this.turmaForm.reset({
                estagio: '',
                periodo: '',
                professor_id: ''
            });
        } else {
            this.turmaForm.markAllAsTouched();
        }
    }

    removeTurma(id: string) {
        this.registrationService.removeTurma(id);
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
