import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
    LucideAngularModule,
    ArrowLeft,
    Search,
    Plus,
    X,
    Eye,
    Pencil,
    Trash2,
    ChevronDown,
    Key,
    Save,
    CheckCircle2,
    Mail,
    User,
    Calendar,
    Phone,
    Building,
    Clock,
    Shield
} from 'lucide-angular';
import { UsuarioService, Usuario } from '../../../core/services/usuario.service';
import { SchoolService } from '../../../core/services/school.service';

@Component({
    selector: 'app-cadastro',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: '../../admin/users/user-management.component.html',
})
export class CadastroComponent implements OnInit, OnDestroy {
    icons = {
        ArrowLeft, Search, Plus, X, Eye, Pencil, Trash2,
        ChevronDown, Key, Save, CheckCircle2, Mail,
        User, Calendar, Phone, Building, Clock, Shield
    };

    // Data
    usuarios: Usuario[] = [];
    escolas: any[] = [];
    turmas: any[] = [];
    loading = false;
    searchTerm = '';
    tipoFilter = '';
    selectedSchoolId: string | null = null;
    private schoolSub?: Subscription;

    // Modals Control
    showFormModal = false;
    showDetailModal = false;
    showSuccessToast = false;
    showEmailToast = false;
    showEditSuccessToast = false;

    // Form State
    isEditing = false;
    formLoading = false;
    form: Partial<Usuario> = {
        tipo_acesso: 'Responsável',
        nome_completo: '',
        cpf: '',
        turmaID: '',
        email: '',
        escola_id: '',
        status: 'Ativo'
    };

    // Detail State
    selectedUser: Usuario | null = null;
    resetLoading = false;

    constructor(
        private usuarioService: UsuarioService,
        private schoolService: SchoolService,
        private router: Router
    ) { }

    ngOnInit() {
        this.schoolSub = this.schoolService.selectedSchool$.subscribe(s => {
            this.selectedSchoolId = s?.id || null;
            if (this.selectedSchoolId) {
                this.loadUsuarios();
                this.loadTurmas();
            }
        });
        this.loadSchools();
    }

    ngOnDestroy() {
        this.schoolSub?.unsubscribe();
    }

    async loadUsuarios() {
        if (!this.selectedSchoolId) return;
        this.loading = true;
        try {
            this.usuarios = await this.usuarioService.getUsuarios(
                this.selectedSchoolId,
                this.searchTerm,
                this.tipoFilter
            );
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            this.loading = false;
        }
    }

    async loadSchools() {
        try {
            this.escolas = await this.usuarioService.getSchools();
        } catch (error) {
            console.error('Error loading schools:', error);
        }
    }

    async loadTurmas() {
        if (this.selectedSchoolId) {
            try {
                this.turmas = await this.usuarioService.getTurmas(this.selectedSchoolId);
            } catch (error) {
                console.error('Error loading turmas:', error);
            }
        }
    }

    onSearch() {
        this.loadUsuarios();
    }

    onFilterChange() {
        this.loadUsuarios();
    }

    goBack() {
        this.router.navigate(['/escola/dashboard']);
    }

    openCreateModal() {
        this.isEditing = false;
        this.resetForm();
        this.form.escola_id = this.selectedSchoolId || '';
        this.showFormModal = true;
    }

    resetForm() {
        this.form = {
            tipo_acesso: 'Responsável',
            nome_completo: '',
            cpf: '',
            turmaID: '',
            email: '',
            escola_id: this.selectedSchoolId || '',
            status: 'Ativo'
        };
    }

    async submitForm() {
        if (!this.form.nome_completo || !this.form.email) return;
        this.formLoading = true;
        try {
            if (this.isEditing && this.form.id) {
                const result = await this.usuarioService.updateUsuario(this.form.id, this.form);
                if (result.success) {
                    this.showEditSuccessToast = true;
                    this.showFormModal = false;
                    this.loadUsuarios();
                }
            } else {
                const result = await this.usuarioService.createUsuario(this.form);
                if (result.success) {
                    this.showSuccessToast = true;
                    this.showFormModal = false;
                    this.loadUsuarios();
                }
            }
        } catch (error) {
            console.error('Error saving user:', error);
        } finally {
            this.formLoading = false;
        }
    }

    viewDetails(user: Usuario) {
        this.selectedUser = user;
        this.showDetailModal = true;
    }

    editFromDetails() {
        if (!this.selectedUser) return;
        this.isEditing = true;
        this.form = { ...this.selectedUser };
        this.showDetailModal = false;
        this.showFormModal = true;
    }

    async resetPassword() {
        if (!this.selectedUser?.email) return;
        this.resetLoading = true;
        try {
            const result = await this.usuarioService.resetPassword(this.selectedUser.email);
            if (result.success) {
                this.showEmailToast = true;
                this.showDetailModal = false;
            }
        } catch (error) {
            console.error('Error resetting password:', error);
        } finally {
            this.resetLoading = false;
        }
    }

    getStatusClass(status: string): string {
        return status === 'Ativo'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700';
    }

    formatDate(dateStr: string | undefined): string {
        if (!dateStr) return '--/--/----';
        return new Date(dateStr).toLocaleDateString('pt-BR');
    }

    getTurmaName(id: string | undefined): string {
        if (!id) return 'Não informado';
        const turma = this.turmas.find(t => t.id === id);
        return turma ? turma.nome : 'Período Manhã';
    }

    getEscolaName(id: string | undefined): string {
        if (!id) return 'Não informado';
        const escola = this.escolas.find(e => e.id === id);
        return escola ? escola.nome : 'Escola Caritas';
    }

    closeModals() {
        this.showDetailModal = false;
        this.showFormModal = false;
        this.showSuccessToast = false;
        this.showEmailToast = false;
        this.showEditSuccessToast = false;
    }
}
