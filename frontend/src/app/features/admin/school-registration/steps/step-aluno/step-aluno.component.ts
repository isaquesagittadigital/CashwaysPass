import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SchoolRegistrationService, AlunoData } from '../../registration.service';
import { SchoolService } from '../../../../../core/services/school.service';
import { LucideAngularModule, Upload, Plus, Trash2, Edit, CheckCircle2 } from 'lucide-angular';
import { Papa } from 'ngx-papaparse';
import { Router } from '@angular/router';
import { FeedbackModalComponent } from '../../feedback-modal/feedback-modal.component';
import { DeleteConfirmModalComponent } from '../../../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';

@Component({
    selector: 'app-step-aluno',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, FeedbackModalComponent, DeleteConfirmModalComponent],
    templateUrl: './step-aluno.component.html',
    styleUrls: ['./step-aluno.component.css'],
    providers: [Papa]
})
export class StepAlunoComponent implements OnInit {
    alunoForm: FormGroup;
    students$ = this.registrationService.students$;
    turmas$ = this.registrationService.turmas$;
    showSuccessModal = false;
    icons = { Upload, Plus, Trash2, Edit, CheckCircle2 };

    // Edit State
    isEditing = false;
    editingId: string | null = null;
    
    // Auth & Modals State
    showDeleteConfirm = false;
    studentToDelete: string | null = null;
    
    // Toast State
    showSuccessToast = false;
    toastMessage = '';
    toastTimeout: any;

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
            emailAluno: ['', [Validators.required, Validators.email]],
            numeroCarteira: ['', Validators.required]
        });
    }

    ngOnInit(): void { }

    addStudent() {
        if (this.alunoForm.valid) {
            const student: AlunoData = { ...this.alunoForm.value };

            if (this.isEditing && this.editingId) {
                this.registrationService.updateStudent(this.editingId, student);
                this.showToast('Aluno atualizado com sucesso!');
                this.isEditing = false;
                this.editingId = null;
            } else {
                this.registrationService.addStudent(student);
                this.showToast('Aluno cadastrado com sucesso!');
            }

            this.alunoForm.reset({
                turmaId: ''
            });
        } else {
            this.alunoForm.markAllAsTouched();
        }
    }

    editStudent(student: AlunoData) {
        this.isEditing = true;
        this.editingId = student.id || null;
        this.alunoForm.patchValue({
            turmaId: student.turmaId,
            nome: student.nome,
            responsavel: student.responsavel,
            emailResponsavel: student.emailResponsavel,
            emailAluno: student.emailAluno,
            numeroCarteira: student.numeroCarteira
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    removeStudent(id: string) {
        this.studentToDelete = id;
        this.showDeleteConfirm = true;
    }

    confirmDelete() {
        if (this.studentToDelete) {
            this.registrationService.removeStudent(this.studentToDelete);
            this.showToast('Aluno removido com sucesso!');
            this.showDeleteConfirm = false;
            this.studentToDelete = null;

            if (this.isEditing && this.editingId === this.studentToDelete) {
                this.isEditing = false;
                this.editingId = null;
                this.alunoForm.reset({ turmaId: '' });
            }
        }
    }

    cancelDelete() {
        this.showDeleteConfirm = false;
        this.studentToDelete = null;
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
                        emailResponsavel: row.email || row.Email || row['Email Responsavel'] || '',
                        emailAluno: row.emailAluno || row['Email Aluno'] || row.email || row.Email || '', // Fallback to responsavel email if empty
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
