import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
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
    ChevronLeft,
    Upload
} from 'lucide-angular';
import * as Papa from 'papaparse';
import { DeleteConfirmModalComponent } from '../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { UsuarioService, Usuario, UserTipoAcesso, UserStatus } from '../../../core/services/usuario.service';
import { SchoolService, School } from '../../../core/services/school.service';

@Component({
    selector: 'app-escola-user-management',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, DeleteConfirmModalComponent, NgxMaskDirective],
    templateUrl: './escola-user-management.component.html',
})
export class EscolaUserManagementComponent implements OnInit, OnDestroy {
    icons = {
        ArrowLeft, Search, Plus, X: XIcon, Eye, Pencil, Trash2,
        ChevronDown, Key, Save, CheckCircle2, Mail,
        User, Calendar, Phone, Building, Clock, Shield,
        Download, FileSpreadsheet, FilePlus, ArrowUpDown,
        ChevronRight, ChevronLeft, Upload
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
    showDeleteSuccessToast = false;
    showDeleteConfirm = false;
    userToDelete: number | null = null;
    isBulkDelete = false;
    deleteLoading = false;

    // Bulk Upload Modal
    showBulkModal = false;
    bulkLoading = false;
    bulkProgress = 0;
    bulkErrorCount = 0;
    bulkSuccessCount = 0;

    // Form State
    isEditing = false;
    formLoading = false;
    form: Partial<Usuario> = {
        tipo_acesso: 'Responsavel',
        nome_completo: '',
        cpf: '',
        cnpj: '',
        Proposito_Lojista: '',
        telefone: '',
        turmaID: '',
        email: '',
        escola_id: '',
        status: 'active'
    };

    propositosLojista = [
        { value: 'Alimentação', label: 'Alimentação' },
        { value: 'Entretenimento', label: 'Entretenimento' },
        { value: 'Mercado', label: 'Mercado' }
    ];

    selectedUser: Usuario | null = null;
    resetLoading = false;

    // Searchable School Selection
    schoolSearchTerm = '';
    showSchoolList = false;
    filteredEscolas: any[] = [];

    constructor(
        private usuarioService: UsuarioService,
        private schoolService: SchoolService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (target && typeof target.closest === 'function' && !target.closest('.relative')) {
            this.showSchoolList = false;
        }
    }

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
        this.filteredEscolas = [...this.escolas];
    }

    filterSchools() {
        const term = this.schoolSearchTerm.toLowerCase();
        this.filteredEscolas = this.escolas.filter(e => 
            e.nome?.toLowerCase().includes(term) || 
            e.id?.toLowerCase().includes(term)
        );
        this.showSchoolList = true;
    }

    selectSchool(escola: any) {
        this.form.escola_id = escola.id;
        this.schoolSearchTerm = escola.nome;
        this.showSchoolList = false;
        // Ao trocar de escola, recarrega as turmas dela
        this.usuarioService.getTurmas(escola.id).then(turmas => {
            this.turmas = turmas;
        });
    }

    onTipoAcessoChange() {
        if (this.shouldDisablePeriod()) {
            this.form.turmaID = '';
        }
    }

    shouldDisablePeriod(): boolean {
        return this.form.tipo_acesso === 'Responsavel' || this.form.tipo_acesso === 'Lojista' || this.form.tipo_acesso === 'Escola' || this.form.tipo_acesso === 'Admin' || this.form.tipo_acesso === 'Convidado';
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
    deleteSelected() {
        if (this.selectedUsers.size === 0) return;
        this.isBulkDelete = true;
        this.userToDelete = null;
        this.showDeleteConfirm = true;
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
        this.showBulkModal = true;
        this.bulkProgress = 0;
        this.bulkSuccessCount = 0;
        this.bulkErrorCount = 0;
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    this.processBulkUpload(results.data);
                },
                error: (error) => {
                    console.error('CSV Parsing error:', error);
                    alert('Erro ao processar o arquivo CSV.');
                }
            });
        }
    }

    async processBulkUpload(data: any[]) {
        if (!this.selectedSchoolId) return;
        this.bulkLoading = true;
        this.bulkProgress = 0;
        this.bulkSuccessCount = 0;
        this.bulkErrorCount = 0;

        const total = data.length;
        for (let i = 0; i < total; i++) {
            const row = data[i];
            const usuario: Partial<Usuario> = {
                nome_completo: row.nome_completo,
                email: row.email,
                cpf: row.cpf,
                tipo_acesso: (row.tipo_acesso as UserTipoAcesso) || 'Responsavel',
                escola_id: this.selectedSchoolId,
                status: 'active'
            };

            try {
                const result = await this.usuarioService.createUsuario(usuario);
                if (result.success) {
                    this.bulkSuccessCount++;
                    // Trigger welcome email (fire and forget or wait)
                    await this.usuarioService.sendWelcomeEmail(usuario.email!, usuario.nome_completo!);
                } else {
                    this.bulkErrorCount++;
                }
            } catch (err) {
                this.bulkErrorCount++;
            }

            this.bulkProgress = Math.round(((i + 1) / total) * 100);
        }

        this.bulkLoading = false;
        this.loadUsuarios();
    }

    goBack() {
        this.router.navigate(['/escola/dashboard']);
    }

    // --- Form Actions ---
    openCreateModal() {
        this.isEditing = false;
        this.resetForm();
        this.form.escola_id = this.selectedSchoolId || '';
        if (this.form.escola_id) {
            const escola = this.escolas.find(e => e.id === this.form.escola_id);
            this.schoolSearchTerm = escola?.nome || '';
        } else {
            this.schoolSearchTerm = '';
        }
        this.showFormModal = true;
    }

    resetForm() {
        this.schoolSearchTerm = '';
        this.showSchoolList = false;
        this.form = {
            tipo_acesso: 'Responsavel',
            nome_completo: '',
            cpf: '',
            cnpj: '',
            Proposito_Lojista: '',
            turmaID: '',
            email: '',
            escola_id: this.selectedSchoolId || '',
            status: 'active'
        };
    }

    isLojista(): boolean {
        return this.form.tipo_acesso === 'Lojista';
    }

    async submitForm() {
        if (!this.form.nome_completo || !this.form.email) return;

        this.formLoading = true;
        try {
            // Sanitize data before sending to Supabase
            const dataToSave = { ...this.form };
            
            // Convert empty strings to null for UUID fields or fields that should be nullable
            if (!dataToSave.turmaID || dataToSave.turmaID === '') {
                delete dataToSave.turmaID; // Or set to null
                (dataToSave as any).turmaID = null;
            }

            if (!dataToSave.escola_id || dataToSave.escola_id === '') {
                (dataToSave as any).escola_id = this.selectedSchoolId;
            }

            if (this.isEditing && this.form.id) {
                const result = await this.usuarioService.updateUsuario(this.form.id, dataToSave);
                if (result.success) {
                    this.showEditSuccessToast = true;
                    this.showFormModal = false;
                    this.loadUsuarios();
                }
            } else {
                const result = await this.usuarioService.createUsuario(dataToSave);
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
        this.selectedUser = { ...user };
        this.showFormModal = false;
        this.showDetailModal = true;
        this.cdr.detectChanges();
    }

    editFromDetails() {
        if (!this.selectedUser) return;
        this.isEditing = true;
        this.form = { ...this.selectedUser };
        const escola = this.escolas.find(e => e.id === this.form.escola_id);
        this.schoolSearchTerm = escola?.nome || '';
        this.showFormModal = true;
        this.showDetailModal = false;
    }

    deleteUser(id: number) {
        this.isBulkDelete = false;
        this.userToDelete = id;
        this.showFormModal = false;
        this.showDetailModal = false;
        this.showDeleteConfirm = true;
        this.cdr.detectChanges();
    }

    async confirmDelete() {
        this.deleteLoading = true;
        try {
            if (this.isBulkDelete) {
                const ids = Array.from(this.selectedUsers);
                const result = await this.usuarioService.deleteBulkUsuarios(ids);
                if (result.success) {
                    this.loadUsuarios();
                    this.showDeleteConfirm = false;
                    this.showDeleteSuccessToast = true;
                }
            } else if (this.userToDelete !== null) {
                const result = await this.usuarioService.deleteUsuario(this.userToDelete);
                if (result.success) {
                    this.loadUsuarios();
                    this.showDeleteConfirm = false;
                    this.showDeleteSuccessToast = true;
                }
            }
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Erro ao excluir usuário(s).');
        } finally {
            this.deleteLoading = false;
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
        const s = status?.toLowerCase();
        if (s === 'active' || s === 'ativo') {
            return 'bg-green-100 text-green-700';
        }
        return 'bg-red-100 text-red-700';
    }

    getBadgeClass(tipo: string): string {
        switch (tipo) {
            case 'Aluno': return 'bg-green-100 text-green-700';
            case 'Professor': return 'bg-pink-100 text-pink-700';
            case 'Responsável': return 'bg-orange-100 text-orange-700';
            case 'Administrador': return 'bg-blue-100 text-blue-700';
            case 'Escola': return 'bg-purple-100 text-purple-700';
            case 'Lojista': return 'bg-cyan-100 text-cyan-700';
            case 'Convidado': return 'bg-amber-100 text-amber-700';
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
