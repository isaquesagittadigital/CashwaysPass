import { Injectable } from '@angular/core';
import { supabase } from '../supabase';

export interface DashboardStats {
    totalInvested: number;
    totalSpent: number;
    freeBalance: number;
    purposeBalance: number;
    totalStudents: number;
    saldo_livre?: number;     // For template compatibility
    saldo_propositos?: number; // For template compatibility
}

export interface TurmaSummary {
    id: string;
    name: string;
    students: number;
    invested: number;
    spent: number;
    balance: number;
}

export interface TransactionDay {
    label: string;
    pix: number;
    manual: number;
    transfer: number;
    market: number;
    total: number;
    day?: string; // Compatibilidade
}

export type TimeFilter = '12 meses' | '30 dias' | '7 dias' | '24 horas';

@Injectable({
    providedIn: 'root'
})
export class AdminDashboardService {
    private cachedTurmas: TurmaSummary[] = [];
    private cachedChart: TransactionDay[] = [];

    async getConsolidatedStats(escolaId?: string, filter: TimeFilter = '7 dias'): Promise<{metrics: DashboardStats, turmas: TurmaSummary[], chart: TransactionDay[]}> {
        try {
            const { data, error } = await supabase.functions.invoke('get-school-dashboard-report', {
                body: { 
                    id: escolaId,
                    period: filter 
                }
            });

            if (error) throw error;

            const metrics = data.metrics;
            const stats: DashboardStats = {
                totalInvested: metrics.total_invested,
                totalSpent: metrics.total_spent,
                freeBalance: metrics.free_balance,
                purposeBalance: metrics.purpose_balance,
                totalStudents: 0 
            };

            const turmas: TurmaSummary[] = (data.turmas || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                students: t.students,
                invested: t.invested,
                spent: t.spent,
                balance: t.balance
            }));

            const chart: TransactionDay[] = (data.chart_data || []).map((c: any) => ({
                label: c.label,
                pix: c.pix,
                manual: c.manual,
                transfer: c.transfer,
                market: c.market,
                total: c.total,
                day: c.label
            }));

            this.cachedTurmas = turmas;
            this.cachedChart = chart;

            return { metrics: stats, turmas, chart };
        } catch (error) {
            console.error('Error calling get-school-dashboard-report:', error);
            throw error;
        }
    }

    async getDashboardStats(escolaId?: string, filter: TimeFilter = '7 dias'): Promise<DashboardStats> {
        try {
            const { metrics, turmas } = await this.getConsolidatedStats(escolaId, filter);
            const totalStudents = turmas.reduce((acc, t) => acc + t.students, 0);

            return {
                ...metrics,
                totalStudents,
                saldo_livre: metrics.freeBalance,
                saldo_propositos: metrics.purposeBalance
            };
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            return {
                totalInvested: 0,
                totalSpent: 0,
                freeBalance: 0,
                purposeBalance: 0,
                totalStudents: 0
            };
        }
    }

    async getTransactionsSummary(escolaId?: string, filter: TimeFilter = '7 dias'): Promise<TransactionDay[]> {
        if (this.cachedChart && this.cachedChart.length > 0) {
            return this.cachedChart;
        }
        try {
            const { chart } = await this.getConsolidatedStats(escolaId, filter);
            return chart;
        } catch (error) {
            console.error('Error fetching transactions summary:', error);
            return [];
        }
    }

    async getTurmaSummary(escolaId?: string, filter: TimeFilter = '7 dias'): Promise<TurmaSummary[]> {
        if (this.cachedTurmas && this.cachedTurmas.length > 0) {
            return this.cachedTurmas;
        }

        try {
            const { turmas } = await this.getConsolidatedStats(escolaId, filter);
            return turmas;
        } catch (error) {
            console.error('Error fetching turma summary:', error);
            return [];
        }
    }
}
