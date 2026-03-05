import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
    LucideAngularModule,
    GraduationCap,
    Users,
    Wallet,
    ShoppingBag,
    ArrowUpRight,
    ArrowDownRight,
    CalendarDays,
    Clock,
    TrendingUp,
    Store,
    Download,
    ChevronDown,
    PiggyBank,
    Eye
} from 'lucide-angular';
import { AdminDashboardService, DashboardStats, TurmaSummary, TimeFilter } from '../../../core/services/admin-dashboard.service';
import { SchoolService } from '../../../core/services/school.service';

interface ChartSegment {
    label: string;
    value: number;
    percentage: number;
    color: string;
}

@Component({
    selector: 'app-escola-dashboard',
    standalone: true,
    imports: [CommonModule, LucideAngularModule],
    templateUrl: './escola-dashboard.component.html',
})
export class EscolaDashboardComponent implements OnInit, OnDestroy {
    icons = {
        GraduationCap, Users, Wallet, ShoppingBag, ArrowUpRight, ArrowDownRight,
        CalendarDays, Clock, TrendingUp, Store, Download, ChevronDown, PiggyBank, Eye
    };

    // State
    loading = true;
    activeFilter: TimeFilter = '12 meses';
    filters: TimeFilter[] = ['12 meses', '30 dias', '7 dias', '24 horas'];
    schoolId: string | null = null;
    private schoolSub?: Subscription;

    // Data
    stats?: DashboardStats;
    turmaSummaries: TurmaSummary[] = [];
    chartSegments: ChartSegment[] = [];

    constructor(
        private dashboardService: AdminDashboardService,
        private schoolService: SchoolService
    ) { }

    ngOnInit() {
        // Enforce school scope
        this.schoolSub = this.schoolService.selectedSchool$.subscribe(s => {
            this.schoolId = s?.id || null;
            this.loadDashboardData();
        });
    }

    ngOnDestroy() {
        this.schoolSub?.unsubscribe();
    }

    async loadDashboardData() {
        if (!this.schoolId) return;
        this.loading = true;
        try {
            this.stats = await this.dashboardService.getDashboardStats(this.schoolId, this.activeFilter);
            this.turmaSummaries = await this.dashboardService.getTurmaSummary(this.schoolId, this.activeFilter);
            this.updateChartData();
        } catch (error) {
            console.error('Error loading school dashboard:', error);
        } finally {
            this.loading = false;
        }
    }

    setFilter(filter: TimeFilter) {
        this.activeFilter = filter;
        this.loadDashboardData();
    }

    updateChartData() {
        if (!this.stats) return;
        const total = this.stats.freeBalance + this.stats.purposeBalance;
        if (total === 0) {
            this.chartSegments = [
                { label: 'Saldo livre', value: 0, percentage: 50, color: '#005bb5' },
                { label: 'Saldo em propósitos', value: 0, percentage: 50, color: '#a3cf00' }
            ];
            return;
        }

        this.chartSegments = [
            {
                label: 'Saldo livre',
                value: this.stats.freeBalance,
                percentage: (this.stats.freeBalance / total) * 100,
                color: '#005bb5'
            },
            {
                label: 'Saldo em propósitos',
                value: this.stats.purposeBalance,
                percentage: (this.stats.purposeBalance / total) * 100,
                color: '#a3cf00'
            }
        ];
    }

    // Chart SVG Utils
    getStrokeDashArray(percentage: number): string {
        const circumference = 2 * Math.PI * 15.9155;
        const dashValue = (percentage * circumference) / 100;
        return `${dashValue} ${circumference}`;
    }

    getStrokeDashOffset(index: number): number {
        const circumference = 2 * Math.PI * 15.9155;
        let offset = 0;
        for (let i = 0; i < index; i++) {
            offset += (this.chartSegments[i].percentage * circumference) / 100;
        }
        return circumference - offset + 25; // 25 is to start from top
    }

    formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    formatPoints(value: number): string {
        return new Intl.NumberFormat('pt-BR').format(Math.floor(value)) + 'pts';
    }
}
