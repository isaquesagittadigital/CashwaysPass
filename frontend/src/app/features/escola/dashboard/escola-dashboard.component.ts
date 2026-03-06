import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RouterModule } from '@angular/router';
import {
    LucideAngularModule,
    Building2,
    Users,
    CreditCard,
    TrendingUp,
    TrendingDown,
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
    Wallet
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
    selector: 'app-escola-dashboard',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, RouterModule],
    templateUrl: './escola-dashboard.component.html',
    styleUrls: ['./escola-dashboard.component.css']
})
export class EscolaDashboardComponent implements OnInit, OnDestroy {
    icons = {
        Building2, Users, CreditCard, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, CalendarDays, Clock,
        Share2, Plus, ShoppingBag, Unlock, Tag, Download, ChevronDown, ArrowUpDown, Eye, Wallet
    };

    activeFilter = '7 dias';
    filters = ['12 meses', '30 dias', '7 dias', '24 horas'];

    stats = [
        { label: 'Total investido', value: 'R$ 0,00', points: '0pts', id: 'invested', icon: TrendingUp, color: '#00609B' },
        { label: 'Total gasto', value: 'R$ 0,00', points: '0pts', id: 'spent', icon: TrendingDown, color: '#fca5a5' },
        { label: 'Saldo livre', value: 'R$ 0,00', points: '0pts', id: 'freeBalance', icon: Wallet, color: '#00609B' },
        { label: 'Saldo em propósitos', value: 'R$ 0,00', points: '0pts', id: 'purposeBalance', icon: Tag, color: '#Bdec24' }
    ];

    turmasSummary: any[] = [];

    // Dynamic Donut Data
    distributionData: ChartSegment[] = [
        { label: 'Total investido', value: 0, percentage: 0, color: '#00a8e8', dashArray: '0 100', dashOffset: 0 },
        { label: 'Total gasto', value: 0, percentage: 0, color: '#ffb088', dashArray: '0 100', dashOffset: 0 },
        { label: 'Saldo livre', value: 0, percentage: 0, color: '#7a5af8', dashArray: '0 100', dashOffset: 0 },
        { label: 'Saldo em propósitos', value: 0, percentage: 0, color: '#Bdec24', dashArray: '0 100', dashOffset: 0 }
    ];

    // Bar chart data
    transactionsData: TransactionDay[] = [
        { day: 'Seg', transacted: 8200, transferred: 4100 },
        { day: 'Ter', transacted: 6700, transferred: 3350 },
        { day: 'Qua', transacted: 6700, transferred: 3350 },
        { day: 'Qui', transacted: 7800, transferred: 3900 },
        { day: 'Sex', transacted: 7800, transferred: 3900 },
        { day: 'Sáb', transacted: 9800, transferred: 4900 },
        { day: 'Dom', transacted: 7100, transferred: 3550 }
    ];
    maxTransactionValue = 16000;
    scaleValues = [16000, 12800, 8000, 4000, 0];

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
                id: 'invested', icon: TrendingUp, color: '#00609B'
            },
            {
                label: 'Total gasto',
                value: this.formatCurrency(data.totalSpent),
                points: `${Math.floor(data.totalSpent)}pts`,
                id: 'spent', icon: TrendingDown, color: '#fca5a5'
            },
            {
                label: 'Saldo livre',
                value: this.formatCurrency(data.freeBalance),
                points: `${Math.floor(data.freeBalance)}pts`,
                id: 'freeBalance', icon: Wallet, color: '#00609B'
            },
            {
                label: 'Saldo em propósitos',
                value: this.formatCurrency(data.purposeBalance),
                points: `${Math.floor(data.purposeBalance)}pts`,
                id: 'purposeBalance', icon: Tag, color: '#Bdec24'
            }
        ];
    }

    updateDonutChart(data: DashboardStats) {
        const total = data.freeBalance + data.purposeBalance;

        if (total === 0) {
            this.distributionData = [
                { label: 'Saldo livre', value: 0, percentage: 0, color: '#00609B', dashArray: '0 100', dashOffset: 0 },
                { label: 'Saldo em propósitos', value: 0, percentage: 0, color: '#Bdec24', dashArray: '0 100', dashOffset: 0 }
            ];
            return;
        }

        const stats = [
            { label: 'Saldo livre', value: data.freeBalance, color: '#00609B' },
            { label: 'Saldo em propósitos', value: data.purposeBalance, color: '#Bdec24' }
        ];

        let currentOffset = 0;
        this.distributionData = stats.map(s => {
            const percentage = (s.value / total) * 100;
            const segment = {
                label: s.label,
                value: s.value,
                percentage: Math.round(percentage),
                color: s.color,
                dashArray: `${percentage} ${100 - percentage}`,
                dashOffset: -currentOffset
            };
            currentOffset += percentage;
            return segment;
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
}
