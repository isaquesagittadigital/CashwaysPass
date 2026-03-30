import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
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

import { GoogleChartsModule } from 'angular-google-charts';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, RouterModule, FormsModule, GoogleChartsModule],
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
    hoveredDonutIndex: number | null = null;
    hoveredBarIndex: number | null = null;

    // Google Chart - Donut Config
    donutChartType: any = 'PieChart';
    donutChartData: any[] = [];
    donutChartColumns: string[] = ['Categoria', 'Valor'];
    donutChartOptions = {
        pieHole: 0.6,
        colors: ['#00a8e8', '#ffb088', '#7a5af8', '#Bdec24'],
        legend: 'none',
        pieSliceText: 'none',
        chartArea: { left: 10, right: 10, top: 10, bottom: 10 },
        backgroundColor: 'transparent',
        animation: { startup: true, duration: 1000, easing: 'out' },
        tooltip: {
            text: 'value',
            showColorCode: true,
            textStyle: { color: '#000', fontName: 'Inter', fontSize: 13, bold: true }
        }
    };

    // Google Chart - Bar Chart Config
    barChartType: any = 'ColumnChart';
    barChartData: any[] = [];
    barChartColumns: string[] = ['Dia da semana', 'Transferido', 'Transacionado'];
    barChartOptions = {
        isStacked: true,
        colors: ['#00609b', '#Bdec24'],
        legend: { position: 'top', alignment: 'end', textStyle: { color: '#6fb0d2', fontName: 'Inter', fontSize: 13, bold: true } },
        backgroundColor: 'transparent',
        chartArea: { width: '85%', height: '70%', top: 35, bottom: 40 },
        vAxis: {
            title: 'Valor',
            titleTextStyle: { color: '#64748b', fontName: 'Inter', fontSize: 11, bold: true, italic: false },
            minValue: 0,
            gridlines: { color: '#f1f5f9', count: 5 },
            baselineColor: '#e2e8f0',
            textStyle: { color: '#94a3b8', fontName: 'Inter', fontSize: 10, bold: true },
            format: 'decimal'
        },
        hAxis: {
            title: 'Dia da semana',
            titleTextStyle: { color: '#64748b', fontName: 'Inter', fontSize: 11, bold: true, italic: false },
            textStyle: { color: '#94a3b8', fontName: 'Inter', fontSize: 10, bold: true },
            gridlines: { color: 'transparent' }
        },
        animation: { startup: true, duration: 800, easing: 'out' },
        tooltip: { isHtml: false, textStyle: { fontName: 'Inter', fontSize: 12 } },
        bar: { groupWidth: '35%' }
    };

    // Distribution Legend
    distributionData: ChartSegment[] = [
        { label: 'Total investido', value: 0, percentage: 0, color: '#00a8e8', dashArray: '0 100', dashOffset: 0 },
        { label: 'Total gasto', value: 0, percentage: 0, color: '#ffb088', dashArray: '0 100', dashOffset: 0 },
        { label: 'Saldo livre', value: 0, percentage: 0, color: '#7a5af8', dashArray: '0 100', dashOffset: 0 },
        { label: 'Saldo em propósitos', value: 0, percentage: 0, color: '#Bdec24', dashArray: '0 100', dashOffset: 0 }
    ];

    // Bar chart data
    transactionsData: TransactionDay[] = [];
    maxTransactionValue = 100;
    scaleValues = [100, 75, 50, 25, 0];

    // Turma Details Modal
    showTurmaModal = false;
    selectedTurma: any = null;
    turmaStudents: any[] = [];
    isLoadingTurmaStudents = false;
    turmaSearchTerm = '';

    isExporting = false;

    private selectionSub?: Subscription;
    private refreshSubscription?: Subscription;

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

        // Configura atualização automática a cada 30 segundos
        this.refreshSubscription = interval(30000).subscribe(() => {
            this.loadDashboardData(this.schoolId);
        });
    }

    ngOnDestroy() {
        this.selectionSub?.unsubscribe();
        this.refreshSubscription?.unsubscribe();
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
            segment.value = val;
            segment.percentage = total > 0 ? Math.round((val / total) * 100) : 0;
        });

        // Update Google Chart Data
        this.donutChartData = [
            ['Total investido', data.totalInvested],
            ['Total gasto', data.totalSpent],
            ['Saldo livre', data.freeBalance],
            ['Saldo em propósitos', data.purposeBalance]
        ];
    }

    formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    setDonutHover(index: number | null) {
        this.hoveredDonutIndex = index;
    }

    setBarHover(index: number | null) {
        this.hoveredBarIndex = index;
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
                const dayMax = d.total || 0;
                if (dayMax > 0) this.hasBarData = true;
                if (dayMax > maxVal) maxVal = dayMax;
            });

            // Escala em centena
            const baseMax = maxVal > 0 ? maxVal : 100;
            this.maxTransactionValue = Math.ceil(baseMax / 100) * 100;

            // Generate 5 points on the scale
            this.scaleValues = [
                this.maxTransactionValue,
                this.maxTransactionValue * 0.75,
                this.maxTransactionValue * 0.5,
                this.maxTransactionValue * 0.25,
                0
            ];

            // Mapping to Google Charts format combining into Transacionado vs Transferido
            this.barChartData = this.transactionsData.map(d => [
                d.label,
                d.transfer || 0, // Transferido (bottom blue)
                (d.pix || 0) + (d.manual || 0) + (d.market || 0) // Transacionado (top green)
            ]);

            // Updating options max value
            this.barChartOptions = {
                ...this.barChartOptions,
                vAxis: {
                    ...(this.barChartOptions.vAxis as any),
                    viewWindow: { min: 0, max: this.maxTransactionValue }
                }
            } as any;

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
