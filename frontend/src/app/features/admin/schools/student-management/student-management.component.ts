import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolManagementService } from '../../../../core/services/school-management.service';
import { LucideAngularModule, Upload, UserPlus, Mail, Trash2, GraduationCap, X, FileSpreadsheet } from 'lucide-angular';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Papa } from 'ngx-papaparse';
import { EmailService } from '../../../../core/services/email.service';


@Component({
    selector: 'app-student-management',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, ReactiveFormsModule],
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
            responsavel: ['', Validators.required],
            emailResponsavel: ['', [Validators.required, Validators.email]],
            numeroCarteira: ['', Validators.required]
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

    onFileChange(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.isSubmitting = true;
            this.papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (result) => {
                    const mappedStudents = result.data.map((row: any) => ({
                        turmaId: this.studentForm.get('turmaId')?.value || this.turmas[0]?.id || '',
                        nome: row.nome || row.Nome || '',
                        responsavel: row.responsavel || row.Responsavel || '',
                        emailResponsavel: row.email || row.Email || '',
                        numeroCarteira: row.carteira || row.Carteira || ''
                    })).filter((s: any) => s.nome !== '');

                    if (mappedStudents.length > 0) {
                        const res = await this.schoolService.createStudentsBulk(this.schoolId, mappedStudents);
                        if (res.success) {
                            alert(`${mappedStudents.length} alunos importados com sucesso!`);
                            this.loadStudents();
                        } else {
                            alert('Erro ao importar alunos.');
                        }
                    }
                    this.isSubmitting = false;
                    this.showModal = false;
                },
                error: (err) => {
                    console.error('CSV parse error:', err);
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
            } else {
                alert('Erro ao cadastrar aluno: ' + (result.error?.message || 'Erro desconhecido'));
            }
            this.isSubmitting = false;
        } else {
            this.studentForm.markAllAsTouched();
        }
    }

    onDelete(id: string) {
        if (confirm('Deseja realmente excluir este aluno?')) {
            this.schoolService.deleteStudent(id).subscribe(() => this.loadStudents());
        }
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
