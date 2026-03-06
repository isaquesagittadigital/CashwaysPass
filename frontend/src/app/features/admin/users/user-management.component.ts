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
    X as XIcon,
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
    Shield,
    Download,
    FileSpreadsheet,
    FilePlus,
    ArrowUpDown,
    ChevronRight,
    ChevronLeft
} from 'lucide-angular';
import { UsuarioService, Usuario, UserTipoAcesso, UserStatus } from '../../../core/services/usuario.service';
import { SchoolService, School } from '../../../core/services/school.service';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './user-management.component.html',
})
export class UserManagementComponent implements OnInit, OnDestroy {
    icons = {
        ArrowLeft, Search, Plus, X: XIcon, Eye, Pencil, Trash2,
        ChevronDown, Key, Save, CheckCircle2, Mail,
        User, Calendar, Phone, Building, Clock, Shield,
        Download, FileSpreadsheet, FilePlus, ArrowUpDown,
        ChevronRight, ChevronLeft
    };

    // Data
    usuarios: Usuario[] = [];
    escolas: any[] = [];
    turmas: any[] = [];
    loading = false;

    // Filters & Pagination
    searchTerm = '';
    tipoFilter = '';
    statusFilter = '';
    currentPage = 1;
    pageSize = 10;
    totalItems = 0;
    totalPages = 1;

    // Selection
    selectedUsers = new Set<number>();

    selectedSchoolId: string | null = null;
    private schoolSub?: Subscription;

    // Modals Control
    showFormModal = false;
    showDetailModal = false;
    showSuccessToast = false;
    showEmailToast = false;
    showEditSuccessToast = false;
    showDeleteConfirm = false;
    userToDelete: number | null = null;
    isBulkDelete = false;

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
                this.currentPage = 1;
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
        this.selectedUsers.clear();

        const { users, total } = await this.usuarioService.getUsuarios(
            this.selectedSchoolId,
            this.searchTerm,
            this.tipoFilter,
            this.statusFilter,
            this.currentPage,
            this.pageSize
        );

        this.usuarios = users;
        this.totalItems = total;
        this.totalPages = Math.ceil(total / this.pageSize) || 1;
        this.loading = false;
    }

    async loadSchools() {
        this.escolas = await this.usuarioService.getSchools();
    }

    async loadTurmas() {
        if (this.selectedSchoolId) {
            this.turmas = await this.usuarioService.getTurmas(this.selectedSchoolId);
        }
    }

    onSearch() {
        this.currentPage = 1;
        this.loadUsuarios();
    }

    onFilterChange() {
        this.currentPage = 1;
        this.loadUsuarios();
    }

    // --- Pagination ---
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadUsuarios();
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadUsuarios();
        }
    }

    // --- Selection ---
    toggleSelectAll() {
        if (this.isAllSelected()) {
            this.selectedUsers.clear();
        } else {
            this.usuarios.forEach(u => this.selectedUsers.add(u.id));
        }
    }

    toggleSelectUser(id: number) {
        if (this.selectedUsers.has(id)) {
            this.selectedUsers.delete(id);
        } else {
            this.selectedUsers.add(id);
        }
    }

    isSelected(id: number): boolean {
        return this.selectedUsers.has(id);
    }

    isAllSelected(): boolean {
        return this.usuarios.length > 0 && this.selectedUsers.size === this.usuarios.length;
    }

    // --- Bulk Actions ---
    async deleteSelected() {
        if (this.selectedUsers.size === 0) return;
        if (confirm(`Deseja realmente excluir ${this.selectedUsers.size} usuários selecionados?`)) {
            const ids = Array.from(this.selectedUsers);
            const result = await this.usuarioService.deleteBulkUsuarios(ids);
            if (result.success) {
                this.loadUsuarios();
            } else {
                alert('Erro ao excluir usuários.');
            }
        }
    }

    async exportToCSV() {
        if (this.usuarios.length === 0) return;

        const headers = ['Nome', 'Tipo', 'Escola', 'Email', 'CPF', 'Status', 'Criado em'];
        const rows = this.usuarios.map(u => [
            u.nome_completo,
            u.tipo_acesso,
            this.getEscolaName(u.escola_id),
            u.email,
            u.cpf,
            u.status,
            this.formatDate(u.created_at)
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "usuarios.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    bulkRegister() {
        alert('Funcionalidade de cadastro em massa será implementada em breve.');
    }

    goBack() {
        this.router.navigate(['/admin/dashboard']);
    }

    // --- Form Actions ---
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

    // --- Detail Actions ---
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

    async deleteUser(id: number) {
        if (confirm('Deseja realmente excluir este usuário?')) {
            const result = await this.usuarioService.deleteUsuario(id);
            if (result.success) {
                this.loadUsuarios();
            } else {
                alert('Erro ao excluir usuário.');
            }
        }
    }

    async resetPassword() {
        if (!this.selectedUser?.email) return;
        this.resetLoading = true;
        const result = await this.usuarioService.resetPassword(this.selectedUser.email);
        if (result.success) {
            this.showEmailToast = true;
            this.showDetailModal = false;
        }
        this.resetLoading = false;
    }

    // --- Utils ---
    getStatusClass(status: string): string {
        return status === 'Ativo'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700';
    }

    getBadgeClass(tipo: string): string {
        switch (tipo) {
            case 'Aluno': return 'bg-green-100 text-green-700';
            case 'Professor': return 'bg-pink-100 text-pink-700';
            case 'Responsável': return 'bg-orange-100 text-orange-700';
            case 'Administrador': return 'bg-blue-100 text-blue-700';
            case 'Escola': return 'bg-purple-100 text-purple-700';
            case 'Lojista': return 'bg-cyan-100 text-cyan-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    }

    formatDate(dateStr: string | undefined): string {
        if (!dateStr) return '--/--/----';
        return new Date(dateStr).toLocaleDateString('pt-BR');
    }

    getTurmaName(id: string | undefined): string {
        if (!id) return '-';
        const turma = this.turmas.find(t => t.id === id);
        return turma ? turma.nome : '-';
    }

    getEscolaName(id: string | undefined): string {
        if (!id) return '-';
        const escola = this.escolas.find(e => e.id === id);
        return escola ? escola.nome : '-';
    }
}
