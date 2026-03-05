import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
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
    ChevronDown
} from 'lucide-angular';
import { AdminDashboardService, DashboardStats, TransactionDay } from '../../../core/services/admin-dashboard.service';
import { SchoolService } from '../../../core/services/school.service';
import { ExportService } from '../../../core/services/export.service';

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
    imports: [CommonModule, LucideAngularModule],
    templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    icons = {
        Building2, Users, CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight, CalendarDays, Clock,
        Share2, Plus, ShoppingBag, Unlock, Tag, Download, ChevronDown
    };

    activeFilter = '7 dias';
    filters = ['12 meses', '30 dias', '7 dias', '24 horas'];

    stats = [
        { label: 'Total investido', value: 'R$ 0,00', points: '0pts', icon: TrendingUp, color: 'blue', bg: 'bg-blue-50', iconColor: 'text-blue-600' },
        { label: 'Total gasto', value: 'R$ 0,00', points: '0pts', icon: ShoppingBag, color: 'coral', bg: 'bg-orange-50', iconColor: 'text-orange-600' },
        { label: 'Saldo livre', value: 'R$ 0,00', points: '0pts', icon: Unlock, color: 'purple', bg: 'bg-purple-50', iconColor: 'text-purple-600' },
        { label: 'Saldo em propósitos', value: 'R$ 0,00', points: '0pts', icon: Tag, color: 'green', bg: 'bg-green-50', iconColor: 'text-green-600' },
        { label: 'Total de Alunos', value: '0', points: '0 cadastros', icon: Users, color: 'indigo', bg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
    ];

    turmasSummary: any[] = [];

    // Dynamic Donut Data
    distributionData: ChartSegment[] = [
        { label: 'Total investido', value: 0, percentage: 0, color: '#4facfe', dashArray: '0 100', dashOffset: 0 },
        { label: 'Total gasto', value: 0, percentage: 0, color: '#fbc2eb', dashArray: '0 100', dashOffset: 0 },
        { label: 'Saldo livre', value: 0, percentage: 0, color: '#a18cd1', dashArray: '0 100', dashOffset: 0 },
        { label: 'Saldo em propósito', value: 0, percentage: 0, color: '#84fab0', dashArray: '0 100', dashOffset: 0 }
    ];

    // Dynamic Bar Data
    transactionsData: any[] = [];
    maxTransactionValue = 16000;
    isExporting = false;

    private selectionSub?: Subscription;

    constructor(
        private dashboardService: AdminDashboardService,
        private schoolService: SchoolService,
        private exportService: ExportService
    ) { }

    async ngOnInit() {
        this.selectionSub = this.schoolService.selectedSchool$.subscribe(school => {
            if (school) {
                this.loadDashboardData(school.id);
            }
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
                name: t.name,
                students: t.students,
                invested: this.formatCurrency(t.invested),
                spent: this.formatCurrency(t.spent),
                balance: this.formatCurrency(t.balance)
            }));

            const transactions = await this.dashboardService.getTransactionsSummary(schoolId, filter);
            this.updateBarChart(transactions);
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
                icon: TrendingUp, color: 'blue', bg: 'bg-blue-50', iconColor: 'text-blue-600'
            },
            {
                label: 'Total gasto',
                value: this.formatCurrency(data.totalSpent),
                points: `${Math.floor(data.totalSpent)}pts`,
                icon: ShoppingBag, color: 'coral', bg: 'bg-orange-50', iconColor: 'text-orange-600'
            },
            {
                label: 'Saldo livre',
                value: this.formatCurrency(data.freeBalance),
                points: `${Math.floor(data.freeBalance)}pts`,
                icon: Unlock, color: 'purple', bg: 'bg-purple-50', iconColor: 'text-purple-600'
            },
            {
                label: 'Saldo em propósitos',
                value: this.formatCurrency(data.purposeBalance),
                points: `${Math.floor(data.purposeBalance)}pts`,
                icon: Tag, color: 'green', bg: 'bg-green-50', iconColor: 'text-green-600'
            },
            {
                label: 'Total de Alunos',
                value: data.totalStudents.toString(),
                points: `${data.totalStudents} cadastros`,
                icon: Users, color: 'indigo', bg: 'bg-indigo-50', iconColor: 'text-indigo-600'
            },
        ];
    }

    updateDonutChart(data: DashboardStats) {
        const total = data.totalInvested + data.totalSpent + data.freeBalance + data.purposeBalance;

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

    updateBarChart(transactions: TransactionDay[]) {
        // Calculate max value for scale
        const maxDayTotal = Math.max(...transactions.map(t => t.transferred + t.transacted), 100);
        this.maxTransactionValue = Math.ceil(maxDayTotal / 1000) * 1000;
        if (this.maxTransactionValue < 4000) this.maxTransactionValue = 4000;

        this.transactionsData = transactions.map(t => ({
            ...t,
            transferredHeight: (t.transferred / this.maxTransactionValue) * 100,
            transactedHeight: (t.transacted / this.maxTransactionValue) * 100
        }));
    }

    formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    setFilter(filter: string) {
        this.activeFilter = filter;
        const currentSchool = this.schoolService.getSelectedSchool();
        this.loadDashboardData(currentSchool?.id);
    }

    get scaleValues() {
        const step = this.maxTransactionValue / 4;
        return [
            this.formatNumber(this.maxTransactionValue),
            this.formatNumber(this.maxTransactionValue - step),
            this.formatNumber(this.maxTransactionValue - 2 * step),
            this.formatNumber(this.maxTransactionValue - 3 * step),
            '0'
        ];
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

    private formatNumber(val: number): string {
        return val >= 1000 ? (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + 'k' : val.toString();
    }
}
