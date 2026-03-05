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
    ChevronDown,
    TrendingUp,
    Smartphone,
    Users,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Download,
    CalendarDays,
    BarChart3,
    LineChart,
    RefreshCw,
    Wallet,
    Info,
    CheckCircle2
} from 'lucide-angular';
import { ReportService, ReportMetrics, TransactionPoint, BillingPoint } from '../../../core/services/report.service';
import { SchoolService } from '../../../core/services/school.service';
import { TimeFilter } from '../../../core/services/admin-dashboard.service';
import { ExportService } from '../../../core/services/export.service';

import { MapPipe } from '../../../core/pipes/map.pipe';

@Component({
    selector: 'app-reports',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, MapPipe],
    templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit, OnDestroy {
    icons = {
        ArrowLeft, Search, Plus, X, ChevronDown, TrendingUp,
        Smartphone, Users, DollarSign, ArrowUpRight, ArrowDownRight,
        Download, CalendarDays, BarChart3, LineChart, RefreshCw, Wallet,
        Info, CheckCircle2
    };

    // State
    loading = false;
    isExporting = false;
    activeFilter: TimeFilter = '7 dias';
    filters: TimeFilter[] = ['12 meses', '30 dias', '7 dias', '24 horas'];
    searchTerm = '';
    selectedSchoolId: string | null = null;
    private schoolSub?: Subscription;

    // Metrics
    metrics?: ReportMetrics;

    // Charts Data
    transactionPoints: TransactionPoint[] = [];
    billingPoints: BillingPoint[] = [];
    transactionTab: 'Weekly' | 'Monthly' = 'Weekly';
    billingModel: 'Full' | 'Lite' = 'Full';

    // SVG Chart Constants
    chartHeight = 200;
    chartWidth = 600;

    constructor(
        private reportService: ReportService,
        private schoolService: SchoolService,
        private exportService: ExportService,
        private router: Router
    ) { }

    ngOnInit() {
        this.schoolSub = this.schoolService.selectedSchool$.subscribe(s => {
            this.selectedSchoolId = s?.id || null;
            this.loadAllData();
        });
    }

    ngOnDestroy() {
        this.schoolSub?.unsubscribe();
    }

    async loadAllData() {
        this.loading = true;
        try {
            this.metrics = await this.reportService.getReportMetrics(this.selectedSchoolId || undefined, this.activeFilter);
            this.transactionPoints = await this.reportService.getTransactionHistory(this.selectedSchoolId || undefined, this.activeFilter);
            this.billingPoints = await this.reportService.getBillingHistory(this.selectedSchoolId || undefined, this.billingModel);
        } catch (error) {
            console.error('Error loading report data:', error);
        } finally {
            this.loading = false;
        }
    }

    setFilter(filter: TimeFilter) {
        this.activeFilter = filter;
        this.loadAllData();
    }

    setTransactionTab(tab: 'Weekly' | 'Monthly') {
        this.transactionTab = tab;
        this.loadAllData();
    }

    setBillingModel(model: 'Full' | 'Lite') {
        this.billingModel = model;
        this.loadAllData();
    }

    goBack() {
        this.router.navigate(['/admin/dashboard']);
    }

    formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    formatNumber(value: number): string {
        return new Intl.NumberFormat('pt-BR').format(value);
    }

    // --- Chart Logic ---

    get maxBarValue(): number {
        const vals = this.transactionPoints.flatMap(p => [p.transacted, p.transferred]);
        return Math.max(...vals, 16000);
    }

    get maxLineValue(): number {
        const vals = this.billingPoints.flatMap(p => [p.revenue, p.totalTransfer, p.transferProvision]);
        return Math.max(...vals, 16000);
    }

    getBarHeight(value: number): number {
        return (value / this.maxBarValue) * 100;
    }

    // SVG Line generator
    getLinePath(data: number[]): string {
        if (data.length === 0) return '';
        const stepX = 100 / (data.length - 1);
        return data.reduce((path, val, i) => {
            const x = i * stepX;
            const y = 100 - (val / this.maxLineValue) * 100;
            return path + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
        }, '');
    }

    getLinePoints(data: number[]): { x: number, y: number, value: number }[] {
        if (data.length === 0) return [];
        const stepX = 100 / (data.length - 1);
        return data.map((val, i) => ({
            x: i * stepX,
            y: 100 - (val / this.maxLineValue) * 100,
            value: val
        }));
    }

    async exportReport() {
        if (this.isExporting) return;
        this.isExporting = true;
        // Logic to export via exportService
        setTimeout(() => this.isExporting = false, 2000);
    }
}
