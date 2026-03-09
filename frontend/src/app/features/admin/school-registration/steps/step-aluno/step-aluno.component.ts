import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SchoolRegistrationService, AlunoData } from '../../registration.service';
import { SchoolService } from '../../../../../core/services/school.service';
import { LucideAngularModule, Upload, Plus, Trash2, Edit } from 'lucide-angular';
import { Papa } from 'ngx-papaparse';
import { Router } from '@angular/router';
import { FeedbackModalComponent } from '../../feedback-modal/feedback-modal.component';

@Component({
    selector: 'app-step-aluno',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, FeedbackModalComponent],
    templateUrl: './step-aluno.component.html',
    styleUrls: ['./step-aluno.component.css'],
    providers: [Papa]
})
export class StepAlunoComponent implements OnInit {
    alunoForm: FormGroup;
    students$ = this.registrationService.students$;
    turmas$ = this.registrationService.turmas$;
    showSuccessModal = false;
    icons = { Upload, Plus, Trash2, Edit };

    constructor(
        private fb: FormBuilder,
        private registrationService: SchoolRegistrationService,
        private papa: Papa,
        private router: Router,
        private schoolService: SchoolService
    ) {
        this.alunoForm = this.fb.group({
            turmaId: ['', Validators.required],
            nome: ['', Validators.required],
            responsavel: ['', Validators.required],
            emailResponsavel: ['', [Validators.required, Validators.email]],
            numeroCarteira: ['', Validators.required]
        });
    }

    ngOnInit(): void { }

    addStudent() {
        if (this.alunoForm.valid) {
            this.registrationService.addStudent(this.alunoForm.value);
            this.alunoForm.reset({
                turmaId: ''
            });
        } else {
            this.alunoForm.markAllAsTouched();
        }
    }

    removeStudent(id: string) {
        this.registrationService.removeStudent(id);
    }

    onFileChange(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (result) => {
                    const students: AlunoData[] = result.data.map((row: any) => ({
                        turmaId: this.alunoForm.get('turmaId')?.value || '',
                        nome: row.nome || row.Nome || '',
                        responsavel: row.responsavel || row.Responsavel || '',
                        emailResponsavel: row.email || row.Email || '',
                        numeroCarteira: row.carteira || row.Carteira || ''
                    })).filter((s: AlunoData) => s.nome !== '');

                    this.registrationService.addStudentsBulk(students);
                }
            });
        }
    }

    getTurmaName(id: string, turmas: any[] | null): string {
        if (!turmas) return 'N/A';
        const t = turmas.find(x => x.id === id);
        return t ? `${t.serie} ${t.nome}` : 'N/A';
    }

    onBack() {
        this.registrationService.setStep(3);
    }

    async onSubmit() {
        const result = await this.registrationService.submitRegistration();
        if (result.success) {
            this.showSuccessModal = true;
        } else {
            alert('Falha ao realizar o cadastro. Verifique os dados e tente novamente.');
        }
    }

    onFinish() {
        this.schoolService.loadSchools(); // Reload the schools so the dashboard dropdown updates
        this.router.navigate(['/admin/dashboard']);
    }
}
