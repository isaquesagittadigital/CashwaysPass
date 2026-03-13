import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
    LucideAngularModule,
    ArrowLeft,
    Search,
    Download,
    Eye,
    ChevronDown,
    X as XIcon,
    RefreshCw,
    CreditCard,
    Filter,
    Plus
} from 'lucide-angular';
import { CarteiraService, WalletStudent, Purpose, InventoryItem, Transaction, StudentFinancialProfile } from '../../../core/services/carteira.service';
import { SchoolService, School } from '../../../core/services/school.service';
import { SchoolManagementService } from '../../../core/services/school-management.service';

import { NgxMaskDirective } from 'ngx-mask';
import { ActionSuccessModalComponent } from '../../../shared/components/success-modal/success-modal.component';

@Component({
    selector: 'app-escola-wallet',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, NgxMaskDirective, ActionSuccessModalComponent],
    templateUrl: './escola-wallet.component.html',
})
export class EscolaWalletComponent implements OnInit, OnDestroy {
    public icons: any = { ArrowLeft, Search, Download, Eye, ChevronDown, X: XIcon, RefreshCw, CreditCard, Filter, Plus };

    // Student list
    students: WalletStudent[] = [];
    totalStudents = 0;
    currentPage = 1;
    pageSize = 8;
    totalPages = 1;
    loading = false;

    // Filters
    turmas: any[] = [];
    listOfStudents: any[] = [];
    turmaFilter = '';
    alunoFilter = '';
    searchTerm = '';
    statusFilter = 'Todos';
    walletTypeFilter = 'Alunos';
    schoolFilter = '';

    // Schools
    schools: School[] = [];
    private schoolSub?: Subscription;
    private selectedSchoolSub?: Subscription;
    selectedSchoolId: string | null = null;

    // Financial Profile Modal
    showProfileModal = false;
    profileLoading = false;
    selectedProfile: StudentFinancialProfile | null = null;
    purposes: Purpose[] = [];
    inventory: InventoryItem[] = [];
    inventoryTotal = 0;
    inventoryPage = 1;
    inventoryTotalPages = 1;
    transactions: Transaction[] = [];
    transactionsTotal = 0;
    transactionMonth = '';
    
    // Manual Balance
    showAddBalanceForm = false;
    showSuccessModal = false;
    successModalTitle = '';
    successModalMessage = '';
    addBalanceAmountFormatted: string = '';
    addBalanceLoading = false;
    lastAddedAmount = 0;

    // Redeem Modal
    showRedeemModal = false;
    redeemItemId: string | null = null;
    redeemLoading = false;

    // Purpose colors
    purposeColors: { [key: string]: string } = {
        'Alimentação': 'bg-[#1a3a5c]',
        'Entretenimento': 'bg-[#1a3a5c]',
        'Mercado': 'border-2 border-[#8BC34A] bg-[#1a3a5c]',
        'Minha reserva': 'bg-[#1a3a5c]',
    };

    constructor(
        private carteiraService: CarteiraService,
        private schoolService: SchoolService,
        private schoolManagementService: SchoolManagementService,
        private router: Router
    ) { }

    ngOnInit() {
        this.schoolSub = this.schoolService.schools$.subscribe(s => this.schools = s);
        this.selectedSchoolSub = this.schoolService.selectedSchool$.subscribe(s => {
            this.selectedSchoolId = s?.id || null;
            this.schoolFilter = this.selectedSchoolId || '';
            
            if (this.schoolFilter) {
                this.loadTurmas(this.schoolFilter);
            }
            this.loadStudents();
        });
    }

    ngOnDestroy() {
        this.schoolSub?.unsubscribe();
        this.selectedSchoolSub?.unsubscribe();
    }

    async loadStudents() {
        if (!this.selectedSchoolId) {
            this.students = [];
            this.totalStudents = 0;
            return;
        }
        this.loading = true;
        
        // Use schoolFilter if set (primarily for Admin), otherwise use the global selectedSchoolId
        const activeSchoolId = this.schoolFilter || this.selectedSchoolId;

        // If alunoFilter is selected, we fetch all students for that specific IDs
        // or we can pass it if the service supported it. 
        // For now, let's focus on the Turma filter which is what's in the UI.

        const walletTypeMap: { [key: string]: string } = {
            'Alunos': 'Aluno',
            'Convidados': 'Convidado',
            'Logistas': 'Lojista'
        };
        const tipoAcesso = walletTypeMap[this.walletTypeFilter] || 'Aluno';

        const { students, total } = await this.carteiraService.getStudentsWallet(
            activeSchoolId || undefined,
            this.statusFilter,
            this.searchTerm,
            this.currentPage,
            this.pageSize,
            this.turmaFilter || undefined,
            tipoAcesso
        );
        
        this.students = students;
        this.totalStudents = total;
        this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        this.loading = false;
    }

    async loadTurmas(schoolId: string) {
        this.schoolManagementService.getTurmasBySchool(schoolId).subscribe({
            next: (data) => {
                this.turmas = data;
            },
            error: (err) => console.error('Error loading turmas:', err)
        });

        // Also load all students names for the aluno filter
        const { students } = await this.carteiraService.getStudentsWallet(schoolId, 'Todos', '', 1, 1000);
        this.listOfStudents = students.map(s => ({ id: s.id, aluno_id: s.aluno_id, nome: s.nome }));
    }

    onFilterChange() {
        this.currentPage = 1;
        this.loadStudents();
    }

    onSearch() {
        this.currentPage = 1;
        this.loadStudents();
    }

    get hasFilters(): boolean {
        const isDefaultSchool = this.schoolFilter === this.selectedSchoolId;
        return !!this.searchTerm || !!this.turmaFilter || this.statusFilter !== 'Todos' || (!!this.schoolFilter && !isDefaultSchool) || this.walletTypeFilter !== 'Alunos';
    }

    onAlunoChange() {
        this.currentPage = 1;
        this.loadStudents();
    }

    onSchoolChange() {
        if (this.schoolFilter) {
            this.loadTurmas(this.schoolFilter);
            this.turmaFilter = ''; // Reset turma when school changes
        } else {
            this.turmas = [];
            this.turmaFilter = '';
        }
        this.onFilterChange();
    }

    onStatusChange() {
        this.onFilterChange();
    }

    clearFilters() {
        this.searchTerm = '';
        this.turmaFilter = '';
        this.statusFilter = 'Todos';
        this.walletTypeFilter = 'Alunos';
        this.alunoFilter = '';
        this.schoolFilter = this.selectedSchoolId || '';
        this.currentPage = 1;
        this.loadStudents();
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadStudents();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadStudents();
        }
    }

    goBack() {
        this.router.navigate(['/escola/dashboard']);
    }

    formatCurrency(value: number | undefined | null): string {
        if (value === undefined || value === null) return 'R$ 0,00';
        return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    getStatusClass(status: string): string {
        return status === 'active'
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-500';
    }

    getStatusLabel(status: string): string {
        return status === 'active' ? 'Ativo' : 'Inativo';
    }

    // --- Financial Profile Modal ---
    async openProfileModal(student: WalletStudent) {
        this.showProfileModal = true;
        this.profileLoading = true;
        this.selectedProfile = null;
        this.purposes = [];
        this.inventory = [];
        this.transactions = [];

        const alunoId = student.aluno_id;

        try {
            if (alunoId) {
                const profile = await this.carteiraService.getStudentFinancialProfile(alunoId);

                if (profile) {
                    this.selectedProfile = profile;
                    const dbPurposes = await this.carteiraService.getStudentPurposes(alunoId);
                    const defaultPurposes: Purpose[] = [
                        { id: 'default-ali', nome: 'Alimentação', saldo: 0 },
                        { id: 'default-ent', nome: 'Entretenimento', saldo: 0 },
                        { id: 'default-mer', nome: 'Mercado', saldo: 0 },
                        { id: 'default-res', nome: 'Minha reserva', saldo: 0 }
                    ];

                    this.purposes = defaultPurposes.map(def => {
                        const dbP = dbPurposes.find(p => p.nome === def.nome);
                        return dbP ? dbP : def;
                    });

                    const now = new Date();
                    this.transactionMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    
                    // Parallelize data loading for better performance
                    await Promise.all([
                        this.loadInventory(alunoId),
                        this.loadTransactions(alunoId)
                    ]);
                } else {
                    this.setFallbackProfile(student);
                }
            } else {
                this.setFallbackProfile(student);
            }
        } catch (error) {
            console.error('Error loading financial profile:', error);
            this.setFallbackProfile(student);
        } finally {
            this.profileLoading = false;
        }
    }

    private setFallbackProfile(student: WalletStudent) {
        this.selectedProfile = {
            id: student.id,
            nome: student.nome,
            turma: `${student.turma_serie} ${student.turma_nome}`.trim(),
            status: student.status,
            saldo_carteira: student.saldo_carteira,
            saldo_propositos: 0
        };
        this.purposes = [
            { id: 'default-ali', nome: 'Alimentação', saldo: 0 },
            { id: 'default-ent', nome: 'Entretenimento', saldo: 0 },
            { id: 'default-mer', nome: 'Mercado', saldo: 0 },
            { id: 'default-res', nome: 'Minha reserva', saldo: 0 }
        ];
    }

    closeProfileModal() {
        this.showProfileModal = false;
        this.selectedProfile = null;
        this.showAddBalanceForm = false;
        this.addBalanceAmountFormatted = '';
    }

    toggleAddBalanceForm() {
        this.showAddBalanceForm = !this.showAddBalanceForm;
        if (!this.showAddBalanceForm) {
            this.addBalanceAmountFormatted = '';
        }
    }

    async confirmAddBalance() {
        if (!this.selectedProfile || !this.addBalanceAmountFormatted) return;
        
        // Convert formatted string or number to a valid numeric value
        let numericValue: number;
        
        if (typeof this.addBalanceAmountFormatted === 'number') {
            numericValue = this.addBalanceAmountFormatted;
        } else {
            // Ensure it's a string and remove currency/formatting
            const valueStr = String(this.addBalanceAmountFormatted || '0');
            numericValue = Number(valueStr.replace(/\./g, '').replace(',', '.'));
        }
        
        if (isNaN(numericValue) || numericValue <= 0) {
            alert('Por favor, insira um valor válido.');
            return;
        }

        this.addBalanceLoading = true;
        this.lastAddedAmount = numericValue;

        try {
            const result = await this.carteiraService.updateStudentWalletBalance(
                this.selectedProfile.id, 
                numericValue,
                this.selectedProfile.nome,
                this.selectedProfile.turma
            );
            
            this.addBalanceLoading = false;

            if (result.success) {
                // Show success modal
                this.successModalTitle = 'Saldo adicionado com sucesso!';
                this.successModalMessage = `O valor de <span class="text-gray-900 font-bold">${this.formatCurrency(numericValue)}</span> foi creditado na carteira de <b>${this.selectedProfile.nome}</b>.`;
                this.showSuccessModal = true;
                this.showAddBalanceForm = false;
                this.addBalanceAmountFormatted = '';
                
                // Refresh local data
                const currentId = this.selectedProfile?.id;
                const student = this.students.find(s => s.aluno_id === currentId || s.id === currentId);
                
                if (student) {
                    // Update balance and student ID locally (important if it was newly created in DB)
                    if (result.aluno_id) student.aluno_id = result.aluno_id;
                    student.saldo_carteira = result.new_balance || (student.saldo_carteira || 0) + numericValue;
                    
                    // Reload the full profile modal data with the updated student info
                    await this.openProfileModal(student);
                }
                
                // Refresh the main list to reflect in the table background
                await this.loadStudents();
            } else {
                console.error('Error adding balance (Service result):', result.error);
                alert('Erro ao adicionar saldo: ' + (result.error?.message || 'Erro desconhecido'));
            }
        } catch (err: any) {
            this.addBalanceLoading = false;
            console.error('Error adding balance (Component catch):', err);
            alert('Erro inesperado: ' + err.message);
        }
    }

    closeSuccessModal() {
        this.showSuccessModal = false;
    }

    async loadInventory(alunoId?: string) {
        const id = alunoId || this.selectedProfile?.id;
        if (!id) return;
        const { items, total } = await this.carteiraService.getStudentInventory(id, this.inventoryPage, 5);
        this.inventory = items;
        this.inventoryTotal = total;
        this.inventoryTotalPages = Math.max(1, Math.ceil(total / 5));
    }

    async loadTransactions(alunoId?: string) {
        const id = alunoId || this.selectedProfile?.id;
        if (!id) return;
        const { transactions, total } = await this.carteiraService.getStudentTransactionHistory(id, this.transactionMonth || undefined);
        this.transactions = transactions;
        this.transactionsTotal = total;
    }

    onTransactionMonthChange() {
        this.loadTransactions();
    }

    inventoryPrevPage() {
        if (this.inventoryPage > 1) {
            this.inventoryPage--;
            this.loadInventory();
        }
    }

    inventoryNextPage() {
        if (this.inventoryPage < this.inventoryTotalPages) {
            this.inventoryPage++;
            this.loadInventory();
        }
    }

    getPurposeColor(nome: string, index: number): string {
        if (this.purposeColors[nome]) return this.purposeColors[nome];
        return 'bg-[#1a3a5c]';
    }

    getPurposeBorderClass(index: number): string {
        return index === 2 ? 'ring-2 ring-[#8BC34A] ring-offset-1' : '';
    }

    // --- Redeem Modal ---
    openRedeemModal(itemId: string) {
        this.redeemItemId = itemId;
        this.showRedeemModal = true;
    }

    closeRedeemModal() {
        this.showRedeemModal = false;
        this.redeemItemId = null;
    }

    async exportToCSV() {
        if (!this.selectedSchoolId) return;

        const walletTypeMap: { [key: string]: string } = {
            'Alunos': 'Aluno',
            'Convidados': 'Convidado',
            'Logistas': 'Lojista'
        };
        const tipoAcesso = walletTypeMap[this.walletTypeFilter] || 'Aluno';

        // Fetch all students without pagination for the current filter
        const { students } = await this.carteiraService.getStudentsWallet(
            this.selectedSchoolId,
            'Todos',
            this.searchTerm,
            1,
            999999, // High number to get everything
            this.turmaFilter || undefined,
            tipoAcesso
        );

        if (students.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }

        const headers = ['Carteira', 'Nome do Aluno', 'Turma', 'Escola', 'Saldo Atual', 'Status'];
        const rows = students.map(s => [
            s.numero_carteira,
            s.nome,
            `${s.turma_serie} ${s.turma_nome}`.trim(),
            s.escola_nome,
            this.formatCurrency(s.saldo_carteira),
            this.getStatusLabel(s.status)
        ]);

        const csvContent = '\ufeff' + [
            headers.join(','),
            ...rows.map(r => r.map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `carteiras_${this.selectedSchoolId}_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async confirmRedeem() {
        if (!this.redeemItemId) return;
        this.redeemLoading = true;
        const result = await this.carteiraService.redeemInventoryItem(this.redeemItemId);
        this.redeemLoading = false;
        this.closeRedeemModal();

        if (result.success) {
            await this.loadInventory();
        } else {
            alert('Erro ao resgatar item. Tente novamente.');
        }
    }
}
