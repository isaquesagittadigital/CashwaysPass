import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolManagementService } from '../../../../core/services/school-management.service';
import { DeleteConfirmModalComponent } from '../../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';
import { LucideAngularModule, Upload, UserPlus, Mail, Trash2, GraduationCap, X, FileSpreadsheet } from 'lucide-angular';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Papa } from 'ngx-papaparse';
import { EmailService } from '../../../../core/services/email.service';


@Component({
    selector: 'app-student-management',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, ReactiveFormsModule, DeleteConfirmModalComponent],
    templateUrl: './student-management.component.html',
    styleUrls: ['./student-management.component.css'],
    providers: [Papa]
})
export class StudentManagementComponent implements OnInit {
    icons = { Upload, UserPlus, Mail, Trash2, GraduationCap, X, FileSpreadsheet };
    @Input() schoolId!: string;
    students: any[] = [];
    isLoading = true;
    isSubmitting = false;
    showToast = false;
    toastMessage = '';

    showDeleteModal = false;
    deleteId: string | null = null;
    deleteLoading = false;

    showModal = false;
    isBulk = false;
    studentForm: FormGroup;
    turmas: any[] = [];

    constructor(
        private schoolService: SchoolManagementService,
        private emailService: EmailService,
        private fb: FormBuilder,
        private papa: Papa
    ) {
        this.studentForm = this.fb.group({
            turmaId: ['', Validators.required],
            nome: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            telefone: [''],
            data_nascimento: [''],
            responsavel: [''],
            emailResponsavel: [''],
            numeroCarteira: ['']
        });
    }

    ngOnInit(): void {
        this.loadStudents();
        this.loadTurmas();
    }

    loadStudents() {
        this.isLoading = true;
        this.schoolService.getStudentsBySchool(this.schoolId).subscribe({
            next: (data) => {
                this.students = data;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading students:', err);
                this.isLoading = false;
            }
        });
    }

    loadTurmas() {
        this.schoolService.getTurmasBySchool(this.schoolId).subscribe(data => this.turmas = data);
    }

    openAddModal() {
        this.isBulk = false;
        this.studentForm.reset({ turmaId: '' });
        this.showModal = true;
    }

    openBulkModal() {
        this.isBulk = true;
        this.showModal = true;
    }

    downloadTemplate() {
        const csvContent = "nome,email,telefone,data_nascimento,turma\nJoão Silva,joao@email.com,11999999999,2012-05-10,Turma A\nMaria Souza,maria@email.com,11988888888,2013-03-20,Turma A";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "modelo_alunos.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    onFileChange(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.isSubmitting = true;
            this.papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (result) => {
                    const mappedStudents = result.data.map((row: any) => ({
                        turmaId: this.turmas.find(t => t.nome === row.turma)?.id || this.studentForm.get('turmaId')?.value || this.turmas[0]?.id || '',
                        nome: row.nome || '',
                        email: row.email || '',
                        telefone: row.telefone || '',
                        data_nascimento: row.data_nascimento || '',
                        responsavel: row.responsavel || '',
                        emailResponsavel: row.email_responsavel || row.email || '',
                        numeroCarteira: row.carteira || ''
                    })).filter((s: any) => s.nome !== '');

                    if (mappedStudents.length > 0) {
                        const res = await this.schoolService.createStudentsBulk(this.schoolId, mappedStudents);
                        if (res.success) {
                            this.toastMessage = 'Alunos importados com sucesso!';
                            this.showToast = true;
                            setTimeout(() => this.showToast = false, 3000);
                            this.loadStudents();
                        } else {
                            alert('Erro ao importar alunos.');
                        }
                    }
                    this.isSubmitting = false;
                    this.showModal = false;
                },
                error: (err) => {
                    this.isSubmitting = false;
                    alert('Erro ao processar o arquivo CSV.');
                }
            });
        }
    }

    async onSubmit() {
        if (this.studentForm.valid) {
            this.isSubmitting = true;
            const data = { ...this.studentForm.value, escola_id: this.schoolId };
            const result = await this.schoolService.createStudent(data);

            if (result.success) {
                this.showModal = false;
                this.loadStudents();
                this.toastMessage = 'Cadastro realizado com sucesso.';
                this.showToast = true;
                setTimeout(() => this.showToast = false, 3000);
            } else {
                alert('Erro ao cadastrar aluno: ' + (result.error?.message || 'Erro desconhecido'));
            }
            this.isSubmitting = false;
        } else {
            this.studentForm.markAllAsTouched();
        }
    }

    onDelete(id: string) {
        this.deleteId = id;
        this.showDeleteModal = true;
    }

    confirmDelete() {
        if (!this.deleteId) return;
        this.deleteLoading = true;
        this.schoolService.deleteStudent(this.deleteId).subscribe({
            next: () => {
                this.showDeleteModal = false;
                this.deleteLoading = false;
                this.deleteId = null;
                this.loadStudents();
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

    isSendingEmail: { [key: string]: boolean } = {};

    onSendEmail(student: any) {
        if (!student.email) {
            alert('Este aluno não possui um email cadastrado.');
            return;
        }

        this.isSendingEmail[student.id] = true;
        this.emailService.sendStudentWelcomeEmail(student.id, student.email).subscribe({
            next: () => {
                this.isSendingEmail[student.id] = false;
                alert('Email de boas-vindas enviado com sucesso!');
            },
            error: () => {
                this.isSendingEmail[student.id] = false;
                alert('Ocorreu um erro ao enviar o email.');
            }
        });
    }
}
