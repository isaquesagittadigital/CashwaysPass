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

    // Professors
    professors: any[] = [];
    
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
            Periodos: ['', Validators.required],
            serie: ['', Validators.required],
            quantidade_alunos: [0, Validators.required],
            data_inicio: [new Date().toISOString().split('T')[0], Validators.required],
            professor_id: [''],
            status: [true]
        });
    }

    ngOnInit(): void {
        const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
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

                    // Carregar professores ANTES das turmas para evitar problemas de sincronização no formulário
                    this.schoolService.getProfessorsBySchool(schoolId).subscribe({
                        next: (profs) => {
                            this.professors = profs;
                            this.loadTurmas();
                            this.isLoading = false;
                        },
                        error: (err) => {
                            console.error('Erro ao carregar professores:', err);
                            this.loadTurmas();
                            this.isLoading = false;
                        }
                    });
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

    get professorsInSelectedTurma(): any[] {
        if (!this.selectedTurma) return this.professors;
        // Filtramos a lista de professores da escola para mostrar apenas os vinculados a esta turma
        return this.professors.filter(p => 
            p.turmaID === this.selectedTurma.id || 
            p.id === this.selectedTurma.professor_id
        );
    }

    selectTurmaToEdit(turma: any | null) {
        this.selectedTurma = turma;
        // Se for uma nova turma, garantir que a aba de dados esteja ativa
        if (!turma) {
            this.currentTab = 'dados';
            this.turmaForm.reset({
                status: true,
                quantidade_alunos: 0,
                data_inicio: new Date().toISOString().split('T')[0],
                Periodos: ''
            });
            return;
        }

        // Patch values básicos
        this.turmaForm.patchValue(turma);

        // Identificar o ID do professor responsável de forma robusta
        // Agora prioritariamente usamos professor_id da tabela turma
        let profId = turma.professor_id || '';
        
        // Fallback apenas para dados legados (se houver)
        if (!profId) {
            // 1. Tentar encontrar no professor_obj (que vem no JOIN do getTurmasBySchool)
            // Agora professor_obj é um objeto único, não mais array
            if (turma.professor_obj) {
                profId = turma.professor_obj.id;
            }
            // 2. Se não encontrou, buscar na lista de professores carregada (pelo campo turmaID legado)
            else if (this.professors.length > 0) {
                const prof = this.professors.find(p => p.turmaID === turma.id);
                if (prof) profId = prof.id;
            }
        }

        this.turmaForm.patchValue({ professor_id: profId });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async saveTurma() {
        if (!this.selectedSchool) return;
        if (this.turmaForm.valid) {
            this.isSubmitting = true;
            const formValue = this.turmaForm.value;
            const selectedProf = this.professors.find(p => p.id === formValue.professor_id);
            
            const data = { 
                ...formValue, 
                escola_id: this.selectedSchool.id,
                data_entrada: formValue.data_inicio,
                professor: selectedProf ? selectedProf.nome_completo : null
            };

            const professorId = formValue.professor_id;
            // NÃO removemos mais o professor_id pois agora ele existe na tabela turma
            // delete data.professor_id;

            const obs = this.selectedTurma?.id
                ? this.schoolService.updateTurma(this.selectedTurma.id, data)
                : this.schoolService.createTurma(data);

            obs.subscribe({
                next: async (resp: any) => {
                    // O vínculo agora é mantido via professor_id na tabela turma,
                    // removi a lógica legada que atualizava usuarios.turmaID para permitir múltiplos
                    
                    this.isSubmitting = false;
                    const msg = this.selectedTurma?.id ? 'Turma atualizada com sucesso' : 'Turma cadastrada com sucesso';
                    this.toastMessage = msg;
                    this.showToast = true;
                    setTimeout(() => this.showToast = false, 3000);

                    // Recarregar tudo para garantir consistência
                    this.loadSchoolFullData(this.selectedSchool.id);
                    this.selectedTurma = null;
                },
                error: (err) => {
                    this.isSubmitting = false;
                    console.error('Error saving turma:', err);
                    alert('Erro ao salvar turma: ' + (err.message || 'Erro desconhecido'));
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
        
        // Refresh full data and global list
        if (this.selectedSchool?.id) {
            this.loadSchoolFullData(this.selectedSchool.id);
        }
        this.globalSchoolService.loadSchools(); 
    }

    closeSuccessModal() {
        this.showSuccessModal = false;
    }

    formatCurrency(value: number | undefined): string {
        if (value === undefined) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
}
