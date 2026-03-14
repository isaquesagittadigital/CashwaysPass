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
    deleteModalEntityName = 'aluno';
    deleteModalEntityArticle = 'o';

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

    // Selection
    selectedIds: Set<string> = new Set();

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

    // Selection Logic
    toggleAllSelection(event: any) {
        const checked = event.target.checked;
        if (checked) {
            this.paginatedStudents.forEach(s => this.selectedIds.add(s.id));
        } else {
            this.paginatedStudents.forEach(s => this.selectedIds.delete(s.id));
        }
    }

    toggleStudentSelection(studentId: string) {
        if (this.selectedIds.has(studentId)) {
            this.selectedIds.delete(studentId);
        } else {
            this.selectedIds.add(studentId);
        }
    }

    isStudentSelected(studentId: string): boolean {
        return this.selectedIds.has(studentId);
    }

    get allPaginatedSelected(): boolean {
        return this.paginatedStudents.length > 0 && 
               this.paginatedStudents.every(s => this.selectedIds.has(s.id));
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
            turmaId: student.turmaId || student.turma?.id || ''
        });
        this.showModal = true;
    }

    openBulkModal() {
        this.isBulk = true;
        this.showModal = true;
    }

    downloadTemplate() {
        const currentTurma = this.turmas.find(t => t.id === this.turmaId);
        const turmaLabel = currentTurma ? `${currentTurma.serie}${isNaN(Number(currentTurma.serie)) ? '' : 'ª'} ${currentTurma.nome}` : "Turma A";
        
        const csvContent = `nome,email,telefone,data_nascimento,turma,carteira\nJoão Silva,joao@email.com,11999999999,2012-05-10,${turmaLabel},AA0001`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `modelo_alunos_${turmaLabel.replace(/\s+/g, '_').toLowerCase()}.csv`);
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
                        // Priority: 
                        // 1. Try to match the turma from CSV column
                        // 2. If no match or no column, use the current context (this.turmId)
                        // 3. Fallback to first available class if nothing else works
                        
                        let matchedTurma = null;
                        const csvTurma = (row.turma || row.turma_nome || row.turmaNome || '').toLowerCase().trim();

                        if (csvTurma) {
                            matchedTurma = this.turmas.find(t => 
                                t.nome?.toLowerCase().trim() === csvTurma || 
                                t.serie?.toString().toLowerCase().trim() === csvTurma ||
                                `${t.serie} ${t.nome}`.toLowerCase().trim() === csvTurma ||
                                `${t.serie}${isNaN(Number(t.serie)) ? '' : 'ª'} ${t.nome}`.toLowerCase().trim() === csvTurma ||
                                t.id === csvTurma
                            );
                        }

                        // If NOT matched by CSV but we have a context turmaId, use context
                        const currentTurmaContext = this.turmas.find(t => t.id === this.turmaId);
                        const finalTurma = matchedTurma || currentTurmaContext || this.turmas[0];

                        return {
                            turmaId: finalTurma?.id || null, // Never send empty string for UUID column
                            turmaNome: finalTurma ? `${finalTurma.serie}${isNaN(Number(finalTurma.serie)) ? '' : 'ª'} ${finalTurma.nome}` : (row.turma || 'Sem turma'),
                            nome: row.nome || '',
                            email: row.email || '',
                            telefone: row.telefone || '',
                            data_nascimento: row.data_nascimento || null, // Use null for empty dates
                            numeroCarteira: row.carteira || row.ra || ''
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
        if (id === 'bulk') {
            if (this.selectedIds.size === 0) {
                alert('Selecione ao menos um aluno para excluir.');
                return;
            }
            this.deleteModalEntityName = this.selectedIds.size > 1 ? 'alunos' : 'aluno';
            this.deleteModalEntityArticle = this.selectedIds.size > 1 ? 'os' : 'o';
        } else {
            this.deleteModalEntityName = 'aluno';
            this.deleteModalEntityArticle = 'o';
        }
        this.deleteId = id;
        this.showDeleteModal = true;
    }

    async confirmDelete() {
        if (!this.deleteId) return;
        this.deleteLoading = true;
        
        try {
            if (this.deleteId === 'bulk') {
                const idsArray = Array.from(this.selectedIds);
                let successCount = 0;
                
                for (const id of idsArray) {
                    await this.schoolService.deleteStudent(id).toPromise();
                    successCount++;
                }
                
                this.selectedIds.clear();
                this.successModalTitle = 'Alunos excluídos!';
                this.successModalMessage = `${successCount} alunos foram removidos com sucesso!`;
            } else {
                await this.schoolService.deleteStudent(this.deleteId).toPromise();
                this.successModalTitle = 'Aluno excluído!';
                this.successModalMessage = 'O aluno foi removido com sucesso!';
            }

            this.showDeleteModal = false;
            this.deleteLoading = false;
            this.deleteId = null;
            this.loadStudents();
            this.showSuccessModal = true;
        } catch (error) {
            console.error('Error deleting student(s):', error);
            alert('Ocorreu um erro ao excluir. Verifique se o aluno possui vínculos ativos.');
            this.deleteLoading = false;
        }
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
