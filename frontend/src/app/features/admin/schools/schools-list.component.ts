import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SchoolManagementService } from '../../../core/services/school-management.service';
import { AdminDashboardService } from '../../../core/services/admin-dashboard.service';
import { SchoolService as GlobalSchoolService, School } from '../../../core/services/school.service';
import { LucideAngularModule, Search, Pencil, Trash2, ChevronLeft, BarChart2, Users, Plus, X, Check, ArrowLeft, ChevronDown, TrendingUp } from 'lucide-angular';
import { Router, RouterModule } from '@angular/router';
import { DeleteConfirmModalComponent } from '../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';
import { Subscription } from 'rxjs';
import { ProfessorManagementComponent } from './professor-management/professor-management.component';
import { StudentManagementComponent } from './student-management/student-management.component';
import { EditSchoolModalComponent } from './edit-school-modal/edit-school-modal.component';
import { ActionSuccessModalComponent } from '../../../shared/components/success-modal/success-modal.component';

@Component({
    selector: 'app-schools-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        LucideAngularModule,
        RouterModule,
        DeleteConfirmModalComponent,
        ProfessorManagementComponent,
        StudentManagementComponent,
        EditSchoolModalComponent,
        ActionSuccessModalComponent
    ],
    templateUrl: './schools-list.component.html',
    styleUrls: ['./schools-list.component.css']
})
export class SchoolsListComponent implements OnInit, OnDestroy {
    icons = { Search, Pencil, Trash2, ChevronLeft, BarChart2, Users, Plus, X, Check, ArrowLeft, ChevronDown, TrendingUp };

    selectedSchool: any | null = null;
    dashboardStats: any = null;
    isLoading = false;

    // Subscription
    private schoolSub?: Subscription;

    // Turmas List State
    turmas: any[] = [];
    filteredTurmas: any[] = [];
    searchTermTurma: string = '';
    selectedTurma: any | null = null;

    // Tab State
    currentTab: 'dados' | 'professors' | 'students' = 'dados';

    // Turma Form
    turmaForm: FormGroup;
    isSubmitting = false;

    // Delete School
    showDeleteModal = false;
    deleteLoading = false;

    // Delete Turma
    showDeleteTurmaModal = false;
    turmaToDelete: any = null;
    deleteTurmaLoading = false;

    // Toast
    showToast = false;
    toastMessage = '';

    // Modals Extras
    showEditModal = false;
    showSuccessModal = false;
    successModalTitle = '';
    successModalMessage = '';

    // Role Control
    isAdmin = true;

    constructor(
        private schoolService: SchoolManagementService,
        private dashboardService: AdminDashboardService,
        private globalSchoolService: GlobalSchoolService,
        private router: Router,
        private fb: FormBuilder
    ) {
        this.turmaForm = this.fb.group({
            nome: ['', Validators.required],
            estagio: ['', Validators.required],
            periodo: ['', Validators.required],
            serie: ['', Validators.required],
            quantidade_alunos: [0, Validators.required],
            data_inicio: [new Date().toISOString().split('T')[0], Validators.required],
            status: [true]
        });
    }

    ngOnInit(): void {
        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user.tipo_acesso === 'Escola') {
                this.isAdmin = false;
            }
        }

        this.schoolSub = this.globalSchoolService.selectedSchool$.subscribe(school => {
            if (school) {
                this.loadSchoolFullData(school.id);
            }
        });
    }

    ngOnDestroy(): void {
        this.schoolSub?.unsubscribe();
    }

    async loadSchoolFullData(schoolId: string) {
        this.isLoading = true;
        try {
            // Pegar os dados reais da escola
            this.schoolService.getSchoolById(schoolId).subscribe({
                next: async (schoolData) => {
                    this.selectedSchool = schoolData;

                    // Dashboard stats
                    try {
                        this.dashboardStats = await this.dashboardService.getDashboardStats(schoolId, '12 meses');
                    } catch (e) {
                        this.dashboardStats = null;
                    }

                    this.loadTurmas();
                    this.isLoading = false;
                },
                error: (e) => {
                    console.error(e);
                    this.isLoading = false;
                }
            });
        } catch (e) {
            console.error(e);
            this.isLoading = false;
        }
    }

    loadTurmas() {
        if (!this.selectedSchool) return;
        this.schoolService.getTurmasBySchool(this.selectedSchool.id).subscribe({
            next: (data) => {
                this.turmas = data;
                this.filterTurmas();
            },
            error: (err) => console.error(err)
        });
    }

    filterTurmas() {
        if (!this.searchTermTurma) {
            this.filteredTurmas = [...this.turmas];
        } else {
            this.filteredTurmas = this.turmas.filter(t =>
                t.nome?.toLowerCase().includes(this.searchTermTurma.toLowerCase())
            );
        }

        // Definir sempre a primeira turma como selecionada para edição
        if (this.filteredTurmas.length > 0) {
            this.selectTurmaToEdit(this.filteredTurmas[0]);
        } else {
            this.selectTurmaToEdit(null);
        }
    }

    onSearchTurmaChange() {
        this.filterTurmas();
    }

    selectTurmaToEdit(turma: any | null) {
        this.selectedTurma = turma;
        // Keep current tab unless we are specifically wanting to go back to dados or it's a new turma
        if (!turma) {
            this.currentTab = 'dados';
        }
        if (turma) {
            this.turmaForm.patchValue(turma);
        } else {
            this.turmaForm.reset({
                status: true,
                quantidade_alunos: 0,
                data_inicio: new Date().toISOString().split('T')[0]
            });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    saveTurma() {
        if (!this.selectedSchool) return;
        if (this.turmaForm.valid) {
            this.isSubmitting = true;
            const data = { ...this.turmaForm.value, escola_id: this.selectedSchool.id };

            const obs = this.selectedTurma?.id
                ? this.schoolService.updateTurma(this.selectedTurma.id, data)
                : this.schoolService.createTurma(data);

            obs.subscribe({
                next: () => {
                    this.isSubmitting = false;
                    const msg = this.selectedTurma?.id ? 'Turma atualizada com sucesso' : 'Turma cadastrada com sucesso';
                    this.toastMessage = msg;
                    this.showToast = true;
                    setTimeout(() => this.showToast = false, 3000);

                    this.selectedTurma = null;
                    this.turmaForm.reset({ status: true, quantidade_alunos: 0, data_inicio: new Date().toISOString().split('T')[0] });
                    this.loadTurmas();
                },
                error: (err) => {
                    this.isSubmitting = false;
                    alert('Erro ao salvar turma: ' + err.message);
                }
            });
        } else {
            this.turmaForm.markAllAsTouched();
        }
    }

    deleteTurma(turma: any, event: Event) {
        event.stopPropagation();
        this.turmaToDelete = turma;
        this.showDeleteTurmaModal = true;
    }

    confirmDeleteTurma() {
        if (!this.turmaToDelete) return;
        this.deleteTurmaLoading = true;
        this.schoolService.deleteTurma(this.turmaToDelete.id).subscribe({
            next: () => {
                if (this.selectedTurma?.id === this.turmaToDelete.id) {
                    this.selectTurmaToEdit(null);
                }
                this.loadTurmas();
                this.deleteTurmaLoading = false;
                this.showDeleteTurmaModal = false;
                this.turmaToDelete = null;

                const msg = 'Turma excluída com sucesso';
                this.toastMessage = msg;
                this.showToast = true;
                setTimeout(() => this.showToast = false, 3000);
            },
            error: (err) => {
                this.deleteTurmaLoading = false;
                alert('Erro ao excluir turma: ' + err.message);
            }
        });
    }

    cancelDeleteTurma() {
        this.showDeleteTurmaModal = false;
        this.turmaToDelete = null;
    }

    onDeleteSchool() {
        this.showDeleteModal = true;
    }

    confirmDeleteSchool() {
        if (!this.selectedSchool) return;
        this.deleteLoading = true;
        this.schoolService.deleteSchool(this.selectedSchool.id).subscribe({
            next: () => {
                this.deleteLoading = false;
                this.showDeleteModal = false;
                // Exibir o modal de sucesso!
                this.successModalTitle = 'Escola excluída!';
                this.successModalMessage = 'A escola foi excluída com sucesso!';
                this.showSuccessModal = true;
                this.globalSchoolService.loadSchools(); // Reload globais e mudará a escola selecionada autmático
            },
            error: (err) => {
                this.deleteLoading = false;
                console.error(err);
            }
        });
    }

    cancelDeleteSchool() {
        this.showDeleteModal = false;
    }

    // Edição Modal
    openEditModal() {
        if (this.selectedSchool) {
            this.showEditModal = true;
        }
    }

    closeEditModal() {
        this.showEditModal = false;
    }

    onEditSuccess() {
        this.showEditModal = false;
        this.successModalTitle = 'Escola editada!';
        this.successModalMessage = 'A escola foi editada com sucesso!';
        this.showSuccessModal = true;
        this.globalSchoolService.loadSchools(); // Update global list with new name
    }

    closeSuccessModal() {
        this.showSuccessModal = false;
    }

    formatCurrency(value: number | undefined): string {
        if (value === undefined) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
}
