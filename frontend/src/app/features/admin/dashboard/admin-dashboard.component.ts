import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RouterModule } from '@angular/router';
import {
    LucideAngularModule,
    Building2,
    Users,
    CreditCard,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    CalendarDays,
    Clock,
    Share2,
    Plus,
    ShoppingBag,
    Unlock,
    Tag,
    Download,
    ChevronDown,
    ArrowUpDown,
    Eye,
    PieChart,
    BarChart,
    GraduationCap,
    X,
    Search,
    ChevronRight
} from 'lucide-angular';
import { AdminDashboardService, DashboardStats, TransactionDay } from '../../../core/services/admin-dashboard.service';
import { SchoolService } from '../../../core/services/school.service';
import { ExportService } from '../../../core/services/export.service';
import { SchoolManagementService } from '../../../core/services/school-management.service';

interface ChartSegment {
    label: string;
    value: number;
    percentage: number;
    color: string;
    dashArray: string;
    dashOffset: number;
}

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, RouterModule, FormsModule],
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    icons = {
        Building2, Users, CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight, CalendarDays, Clock,
        Share2, Plus, ShoppingBag, Unlock, Tag, Download, ChevronDown, ArrowUpDown, Eye, PieChart, BarChart, GraduationCap, X, Search, ChevronRight
    };

    activeFilter = '7 dias';
    filters = ['12 meses', '30 dias', '7 dias', '24 horas'];
    schoolId?: string;

    stats = [
        { label: 'Total investido', value: 'R$ 0,00', points: '0pts', id: 'invested', icon: 'assets/icons/total-investido.svg' },
        { label: 'Total gasto', value: 'R$ 0,00', points: '0pts', id: 'spent', icon: 'assets/icons/total-gasto.svg' },
        { label: 'Saldo livre', value: 'R$ 0,00', points: '0pts', id: 'freeBalance', icon: 'assets/icons/saldo-livre.svg' },
        { label: 'Saldo em propósitos', value: 'R$ 0,00', points: '0pts', id: 'purposeBalance', icon: 'assets/icons/saldo-propositos.svg' }
    ];

    turmasSummary: any[] = [];

    hasDonutData = false;
    hasBarData = false;

    // Dynamic Donut Data
    distributionData: ChartSegment[] = [
        { label: 'Total investido', value: 0, percentage: 0, color: '#00a8e8', dashArray: '0 100', dashOffset: 0 },
        { label: 'Total gasto', value: 0, percentage: 0, color: '#ffb088', dashArray: '0 100', dashOffset: 0 },
        { label: 'Saldo livre', value: 0, percentage: 0, color: '#7a5af8', dashArray: '0 100', dashOffset: 0 },
        { label: 'Saldo em propósitos', value: 0, percentage: 0, color: '#Bdec24', dashArray: '0 100', dashOffset: 0 }
    ];

    // Bar chart data
    transactionsData: TransactionDay[] = [];
    maxTransactionValue = 16000;
    scaleValues = [16000, 12800, 8000, 4000, 0];

    // Turma Details Modal
    showTurmaModal = false;
    selectedTurma: any = null;
    turmaStudents: any[] = [];
    isLoadingTurmaStudents = false;
    turmaSearchTerm = '';

    isExporting = false;

    private selectionSub?: Subscription;

    constructor(
        private dashboardService: AdminDashboardService,
        private schoolService: SchoolService,
        private exportService: ExportService,
        private schoolManagementService: SchoolManagementService
    ) { }

    async ngOnInit() {
        this.selectionSub = this.schoolService.selectedSchool$.subscribe(school => {
            this.schoolId = school?.id;
            this.loadDashboardData(school?.id);
        });
    }

    ngOnDestroy() {
        this.selectionSub?.unsubscribe();
    }

    async loadDashboardData(schoolId?: string) {
        try {
            const filter = this.activeFilter as any;
            const statsData = await this.dashboardService.getDashboardStats(schoolId, filter);
            this.updateStatsCards(statsData);
            this.updateDonutChart(statsData);

            const turmas = await this.dashboardService.getTurmaSummary(schoolId, filter);
            this.turmasSummary = turmas.map(t => ({
                id: t.id,
                name: t.name,
                students: t.students,
                invested: this.formatCurrency(t.invested),
                spent: this.formatCurrency(t.spent),
                balance: this.formatCurrency(t.balance)
            }));

            await this.loadTransactions(schoolId);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    updateStatsCards(data: DashboardStats) {
        this.stats = [
            {
                label: 'Total investido',
                value: this.formatCurrency(data.totalInvested),
                points: `${Math.floor(data.totalInvested)}pts`,
                id: 'invested', icon: 'assets/icons/total-investido.svg'
            },
            {
                label: 'Total gasto',
                value: this.formatCurrency(data.totalSpent),
                points: `${Math.floor(data.totalSpent)}pts`,
                id: 'spent', icon: 'assets/icons/total-gasto.svg'
            },
            {
                label: 'Saldo livre',
                value: this.formatCurrency(data.freeBalance),
                points: `${Math.floor(data.freeBalance)}pts`,
                id: 'freeBalance', icon: 'assets/icons/saldo-livre.svg'
            },
            {
                label: 'Saldo em propósitos',
                value: this.formatCurrency(data.purposeBalance),
                points: `${Math.floor(data.purposeBalance)}pts`,
                id: 'purposeBalance', icon: 'assets/icons/saldo-propositos.svg'
            }
        ];
    }

    updateDonutChart(data: DashboardStats) {
        const total = data.totalInvested + data.totalSpent + data.freeBalance + data.purposeBalance;

        this.hasDonutData = total > 0;

        if (total === 0) {
            this.distributionData.forEach(segment => {
                segment.percentage = 0;
                segment.dashArray = '0 100';
            });
            return;
        }

        const values = [data.totalInvested, data.totalSpent, data.freeBalance, data.purposeBalance];
        let currentOffset = 0;

        this.distributionData.forEach((segment, i) => {
            const val = values[i];
            const percentage = (val / total) * 100;
            segment.value = val;
            segment.percentage = Math.round(percentage);
            segment.dashArray = `${percentage} ${100 - percentage}`;
            segment.dashOffset = -currentOffset;
            currentOffset += percentage;
        });
    }

    formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    setFilter(filter: string) {
        this.activeFilter = filter;
        const currentSchool = this.schoolService.getSelectedSchool();
        this.loadDashboardData(currentSchool?.id);
    }

    async loadTransactions(schoolId?: string) {
        try {
            const filter = this.activeFilter as any;
            const data = await this.dashboardService.getTransactionsSummary(schoolId, filter);
            this.transactionsData = data || [];

            // Calculate max value to build the Y-axis scale dynamically
            let maxVal = 0;
            this.hasBarData = false;

            this.transactionsData.forEach(d => {
                const dayMax = Math.max(d.transacted || 0, d.transferred || 0);
                if (dayMax > 0) this.hasBarData = true;
                if (dayMax > maxVal) maxVal = dayMax;
            });

            // Give some padding at the top of the chart (e.g. 20% extra) and ensure it's at least > 0
            this.maxTransactionValue = maxVal > 0 ? (maxVal * 1.2) : 1000;

            // Generate 5 points on the scale
            this.scaleValues = [
                this.maxTransactionValue,
                this.maxTransactionValue * 0.75,
                this.maxTransactionValue * 0.5,
                this.maxTransactionValue * 0.25,
                0
            ];

        } catch (error) {
            console.error('Error loading transactions data:', error);
            this.transactionsData = [];
        }
    }

    async exportToPdf() {
        if (this.isExporting) return;
        this.isExporting = true;

        try {
            const currentSchool = this.schoolService.getSelectedSchool();
            await this.exportService.exportDashboardToPdf({
                schoolName: currentSchool?.name || 'Todas as Escolas',
                filter: this.activeFilter,
                stats: this.stats,
                turmas: this.turmasSummary,
                donutChartId: 'donutChartCard',
                barChartId: 'barChartCard'
            });
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            this.isExporting = false;
        }
    }

    async openTurmaDetails(turma: any) {
        this.selectedTurma = turma;
        this.showTurmaModal = true;
        this.isLoadingTurmaStudents = true;
        this.turmaStudents = [];
        this.turmaSearchTerm = '';

        const currentSchool = this.schoolService.getSelectedSchool();

        if (!currentSchool && !turma.id) {
            this.isLoadingTurmaStudents = false;
            return;
        }

        // Se temos escola selecionada, usa o método que filtra por escola + turma
        // Se não temos escola (admin visualizando tudo), busca direto pelo turma_id
        const schoolId = currentSchool?.id;

        if (schoolId) {
            this.schoolManagementService.getStudentsBySchool(schoolId, turma.id).subscribe({
                next: (students) => {
                    this.turmaStudents = students;
                    this.isLoadingTurmaStudents = false;
                },
                error: (err) => {
                    console.error('Error loading turma students:', err);
                    this.isLoadingTurmaStudents = false;
                }
            });
        } else {
            // Busca direta por turma_id sem filtro de escola (admin sem escola selecionada)
            import('../../../core/supabase').then(({ supabase }) => {
                supabase
                    .from('aluno')
                    .select('*, saldo_carteira, turma:turma_id(nome, serie), user:usuario_id(id, email, saldo_carteira)')
                    .eq('turma_id', turma.id)
                    .order('nome', { ascending: true })
                    .then(({ data, error }) => {
                        if (error) {
                            console.error('Error loading turma students:', error);
                        } else {
                            this.turmaStudents = (data || []).map((aluno: any) => ({
                                ...aluno,
                                saldo_carteira: Number(aluno.user?.saldo_carteira ?? aluno.saldo_carteira ?? 0)
                            }));
                        }
                        this.isLoadingTurmaStudents = false;
                    });
            });
        }
    }


    get filteredTurmaStudents() {
        if (!this.turmaSearchTerm) return this.turmaStudents;
        const term = this.turmaSearchTerm.toLowerCase();
        return this.turmaStudents.filter(s => 
            (s.nome || s.nome_completo || '').toLowerCase().includes(term) ||
            (s.email || '').toLowerCase().includes(term)
        );
    }

    closeTurmaModal() {
        this.showTurmaModal = false;
        this.selectedTurma = null;
        this.turmaStudents = [];
    }
}
