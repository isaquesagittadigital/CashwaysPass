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
    X,
    RefreshCw,
    CreditCard
} from 'lucide-angular';
import { CarteiraService, WalletStudent, Purpose, InventoryItem, Transaction, StudentFinancialProfile } from '../../../core/services/carteira.service';
import { SchoolService, School } from '../../../core/services/school.service';

@Component({
    selector: 'app-wallet',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './wallet.component.html',
})
export class WalletComponent implements OnInit, OnDestroy {
    icons = { ArrowLeft, Search, Download, Eye, ChevronDown, X, RefreshCw, CreditCard };

    // Student list
    students: WalletStudent[] = [];
    totalStudents = 0;
    currentPage = 1;
    pageSize = 8;
    totalPages = 1;
    loading = false;

    // Filters
    statusFilter = 'Todos';
    schoolFilter = '';
    searchTerm = '';
    statusOptions = ['Todos', 'Ativo', 'Inativo'];

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
        private router: Router
    ) { }

    ngOnInit() {
        this.schoolSub = this.schoolService.schools$.subscribe(s => this.schools = s);
        this.selectedSchoolSub = this.schoolService.selectedSchool$.subscribe(s => {
            this.selectedSchoolId = s?.id || null;
            this.loadStudents();
        });
    }

    ngOnDestroy() {
        this.schoolSub?.unsubscribe();
        this.selectedSchoolSub?.unsubscribe();
    }

    async loadStudents() {
        this.loading = true;
        const escolaId = this.schoolFilter || this.selectedSchoolId || undefined;
        const { students, total } = await this.carteiraService.getStudentsWallet(
            escolaId,
            this.statusFilter,
            this.searchTerm,
            this.currentPage,
            this.pageSize
        );
        this.students = students;
        this.totalStudents = total;
        this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        this.loading = false;
    }

    onSearch() {
        this.currentPage = 1;
        this.loadStudents();
    }

    onFilterChange() {
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
        this.router.navigate(['/admin/dashboard']);
    }

    formatCurrency(value: number): string {
        return `R$${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

        if (alunoId) {
            const profile = await this.carteiraService.getStudentFinancialProfile(alunoId);
            this.selectedProfile = profile;

            if (profile) {
                this.purposes = await this.carteiraService.getStudentPurposes(alunoId);
                await this.loadInventory(alunoId);
                await this.loadTransactions(alunoId);
            }
        } else {
            // Build basic profile from available data
            this.selectedProfile = {
                id: student.id,
                nome: student.nome,
                turma: `${student.turma_serie} ${student.turma_nome}`.trim(),
                status: student.status,
                saldo_carteira: student.saldo_carteira,
                saldo_propositos: 0
            };
        }
        this.profileLoading = false;
    }

    closeProfileModal() {
        this.showProfileModal = false;
        this.selectedProfile = null;
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
