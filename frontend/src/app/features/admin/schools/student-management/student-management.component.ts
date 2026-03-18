import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolManagementService } from '../../../../core/services/school-management.service';
import { DeleteConfirmModalComponent } from '../../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';
import { ActionSuccessModalComponent } from '../../../../shared/components/success-modal/success-modal.component';
import { LucideAngularModule, Upload, UserPlus, Mail, Trash2, GraduationCap, X, FileSpreadsheet, Search, Check, ChevronDown, Edit, ArrowUpDown, Plus } from 'lucide-angular';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Papa } from 'ngx-papaparse';
import { EmailService } from '../../../../core/services/email.service';

@Component({
    selector: 'app-student-management',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, ReactiveFormsModule, FormsModule, DeleteConfirmModalComponent, ActionSuccessModalComponent],
    templateUrl: './student-management.component.html',
    styleUrls: ['./student-management.component.css'],
    providers: [Papa]
})
export class StudentManagementComponent implements OnInit, OnChanges {
    icons = { Upload, UserPlus, Mail, Trash2, GraduationCap, X, FileSpreadsheet, Search, Check, ChevronDown, Edit, ArrowUpDown, Plus };

    @Input() schoolId!: string;
    @Input() turmaId: string | null = null;

    allStudents: any[] = [];
    filteredStudents: any[] = [];
    isLoading = true;
    isSubmitting = false;

    // Filters & Search
    searchTerm: string = '';

    // Pagination
    currentPage: number = 1;
    pageSize: number = 10;
    protected Math = Math;

    // Modals
    showDeleteModal = false;
    deleteId: string | null = null;
    deleteLoading = false;

    showSuccessModal = false;
    successModalTitle = '';
    successModalMessage = '';

    showModal = false;
    isBulk = false;
    isEditing = false;
    editingId: string | null = null;
    studentForm: FormGroup;
    turmas: any[] = [];

    // Bulk Import Improvements
    isParsing = false;
    showPreviewModal = false;
    previewStudents: any[] = [];

    // Email state
    isSendingEmail: { [key: string]: boolean } = {};

    constructor(
        private schoolService: SchoolManagementService,
        private emailService: EmailService,
        private fb: FormBuilder,
        private papa: Papa
    ) {
        this.studentForm = this.fb.group({
            turmaId: ['', Validators.required],
            nome: ['', Validators.required],
            responsavel: [''],
            email: ['', [Validators.required, Validators.email]],
            email_responsavel: ['', [Validators.email]],
            telefone: [''],
            data_nascimento: [''],
            numeroCarteira: ['', [Validators.maxLength(8)]],
            status: ['active']
        });
    }

    ngOnChanges(changes: any): void {
        if ((changes.schoolId && !changes.schoolId.firstChange) || (changes.turmaId && !changes.turmaId.firstChange)) {
            this.loadStudents();
            this.loadTurmas();
        }
    }

    ngOnInit(): void {
        this.loadStudents();
        this.loadTurmas();
    }

    get statusValue(): boolean {
        return this.studentForm.get('status')?.value === 'active';
    }

    toggleStatus() {
        const current = this.studentForm.get('status')?.value;
        this.studentForm.patchValue({
            status: current === 'active' ? 'inactive' : 'active'
        });
    }

    loadStudents() {
        if (!this.schoolId) return;
        this.isLoading = true;
        this.schoolService.getStudentsBySchool(this.schoolId, this.turmaId || undefined).subscribe({
            next: (data) => {
                this.allStudents = data;
                this.applyFilters();
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

    applyFilters() {
        this.filteredStudents = this.allStudents.filter(student => {
            const search = this.searchTerm.toLowerCase();
            return !this.searchTerm ||
                (student.nome || student.nome_completo)?.toLowerCase().includes(search) ||
                student.email?.toLowerCase().includes(search) ||
                student.numeroCarteira?.toLowerCase().includes(search);
        });
        this.currentPage = 1;
    }

    get paginatedStudents() {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.filteredStudents.slice(start, start + this.pageSize);
    }

    get totalPages() {
        return Math.ceil(this.filteredStudents.length / this.pageSize);
    }

    nextPage() {
        if (this.currentPage < this.totalPages) this.currentPage++;
    }

    prevPage() {
        if (this.currentPage > 1) this.currentPage--;
    }

    closeModal() {
        this.showModal = false;
        this.isEditing = false;
        this.isBulk = false;
        this.showPreviewModal = false;
        this.isParsing = false;
        this.editingId = null;
        this.studentForm.reset({ turmaId: '', status: 'active' });
    }

    openAddModal() {
        this.isBulk = false;
        this.isEditing = false;
        this.studentForm.reset({ 
            turmaId: this.turmaId || '', 
            status: 'active' 
        });
        this.showModal = true;
    }

    openEditModal(student: any) {
        this.isBulk = false;
        this.isEditing = true;
        this.editingId = student.id;
        this.studentForm.patchValue({
            ...student,
            turmaId: student.turma_id || student.turmaId || student.turma?.id || '',
            responsavel: student.responsavel || student.nome_mae || '',
            email_responsavel: student.email_responsavel || '',
            telefone: student.telefone || student.user?.telefone || '',
            data_nascimento: student.data_nascimento || ''
        });
        this.showModal = true;
    }

    openBulkModal() {
        this.isBulk = true;
        this.showModal = true;
    }

    downloadTemplate() {
        const csvContent = "nome,email,telefone,data_nascimento,turma,carteira,email_responsavel\nJoão Silva,joao@email.com,11999999999,2012-05-10,Turma A,AA0001,responsavel@email.com";
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
            this.isParsing = true;
            this.papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (result) => {
                    this.previewStudents = result.data.map((row: any) => {
                        // Priority: 1. If we are already inside a specific class (turmaId), use it.
                        // 2. If not, try to find a match in the CSV data.
                        // 3. Last fallback: first available class.
                        
                        let turma: any;
                        
                        if (this.turmaId) {
                            turma = this.turmas.find(t => t.id === this.turmaId);
                        }
                        
                        if (!turma && row.turma) {
                            turma = this.turmas.find(t => 
                                t.nome?.toLowerCase() === row.turma?.toLowerCase() || 
                                t.serie?.toLowerCase() === row.turma?.toLowerCase() ||
                                `${t.serie} ${t.nome}`.toLowerCase() === row.turma?.toLowerCase()
                            );
                        }
                        
                        if (!turma) {
                            turma = this.turmas[0];
                        }

                        return {
                            turmaId: turma?.id || '',
                            turmaNome: turma ? `${turma.serie} ${turma.nome}` : row.turma,
                            nome: row.nome || '',
                            email: row.email || '',
                            telefone: row.telefone || '',
                            data_nascimento: row.data_nascimento || '',
                            numeroCarteira: row.carteira || '',
                            email_responsavel: row.email_responsavel || row.emailResponsavel || ''
                        };
                    }).filter((s: any) => s.nome !== '');

                    this.isParsing = false;
                    if (this.previewStudents.length > 0) {
                        this.showModal = false;
                        this.showPreviewModal = true;
                    } else {
                        alert('Nenhum aluno válido encontrado no arquivo.');
                    }
                },
                error: (err) => {
                    this.isParsing = false;
                    alert('Erro ao processar o arquivo CSV.');
                }
            });
        }
    }

    async confirmBulkImport() {
        if (this.previewStudents.length === 0) return;

        this.isSubmitting = true;
        try {
            const res = await this.schoolService.createStudentsBulk(this.schoolId, this.previewStudents);
            if (res.success) {
                this.successModalTitle = 'Alunos importados';
                this.successModalMessage = `A importação de ${this.previewStudents.length} alunos foi concluída com sucesso!`;
                this.showSuccessModal = true;
                this.closePreviewModal();
                this.loadStudents();
            } else {
                alert('Erro ao importar alunos: ' + (res.error?.message || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('Error in bulk import:', error);
            alert('Erro inesperado ao importar alunos.');
        } finally {
            this.isSubmitting = false;
        }
    }

    closePreviewModal() {
        this.showPreviewModal = false;
        this.previewStudents = [];
        this.isBulk = false;
    }

    async onSubmit() {
        if (this.studentForm.valid) {
            this.isSubmitting = true;
            const data = { ...this.studentForm.value, escola_id: this.schoolId };

            let res: any;
            if (this.isEditing) {
                res = await this.schoolService.updateStudent(this.editingId!, data);
            } else {
                res = await this.schoolService.createStudent(data);
            }

            if (res.success) {
                const wasEditing = this.isEditing;
                this.closeModal();
                this.loadStudents();

                this.successModalTitle = wasEditing ? 'Alterações salvas!' : 'Aluno cadastrado';
                this.successModalMessage = wasEditing ? 'As alterações foram salvas com sucesso.' : 'O aluno foi cadastrado com sucesso!';
                this.showSuccessModal = true;
            } else {
                alert('Erro ao processar aluno: ' + (res.error?.message || 'Erro desconhecido'));
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

                this.successModalTitle = 'Aluno excluído!';
                this.successModalMessage = 'O aluno foi removido com sucesso!';
                this.showSuccessModal = true;
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

    onSendEmail(student: any) {
        if (!student.email) {
            alert('Este aluno não possui um email cadastrado.');
            return;
        }

        this.isSendingEmail[student.id] = true;
        this.emailService.sendStudentWelcomeEmail(student.id, student.email).subscribe({
            next: () => {
                this.isSendingEmail[student.id] = false;
                this.successModalTitle = 'E-mail enviado!';
                this.successModalMessage = 'O e-mail de acesso foi enviado para o aluno.';
                this.showSuccessModal = true;
            },
            error: () => {
                this.isSendingEmail[student.id] = false;
                alert('Ocorreu um erro ao enviar o email.');
            }
        });
    }
}
