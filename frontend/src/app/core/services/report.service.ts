import { Injectable } from '@angular/core';
import { supabase } from '../supabase';
import { TimeFilter } from './admin-dashboard.service';

export interface ReportMetrics {
    totalRevenue: number;
    totalDevices: number;
    totalStudents: number;
    transferProvision: number;
    totalTransferred: number;
    expenseProvision: number;
    transactionCount: number;
    schoolInfo: {
        razaoSocial: string;
        cnpj: string;
        modeloContratacao: string;
        periodo: string;
    };
}

export interface TransactionPoint {
    label: string;
    transacted: number;
    transferred: number;
}

export interface BillingPoint {
    month: string;
    revenue: number;
    totalTransfer: number;
    transferProvision: number;
    transactionCount?: number;
}

@Injectable({
    providedIn: 'root'
})
export class ReportService {
    private getStartDate(filter: TimeFilter): string {
        const now = new Date();
        switch (filter) {
            case '12 meses':
                now.setFullYear(now.getFullYear() - 1);
                break;
            case '30 dias':
                now.setDate(now.getDate() - 30);
                break;
            case '7 dias':
                now.setDate(now.getDate() - 7);
                break;
            case '24 horas':
                now.setHours(now.getHours() - 24);
                break;
        }
        return now.toISOString();
    }

    async getReportMetrics(escolaId?: string, filter: TimeFilter = '7 dias'): Promise<ReportMetrics> {
        const startDate = this.getStartDate(filter);

        // 1. Total de Receitas (Simulated from investment volume)
        let revenueQuery = supabase.from('investimento_aluno').select('valor_investido');
        if (escolaId) revenueQuery = revenueQuery.eq('escola_id', escolaId);
        const { data: revData } = await revenueQuery;
        const totalRevenue = revData?.reduce((acc, curr) => acc + (Number(curr.valor_investido) || 0), 0) || 152000;

        // 2. Total Dispositivos (Simulated or from relevant table)
        const totalDevices = 2345; // Placeholder based on mockup

        // 3. Total Alunos
        let studentCount = 0;
        if (escolaId) {
            const { count } = await supabase.from('aluno').select('*', { count: 'exact', head: true }).eq('escola_id', escolaId);
            studentCount = count || 0;
        } else {
            const { count } = await supabase.from('aluno').select('*', { count: 'exact', head: true });
            studentCount = count || 2345;
        }

        // 4. Repasses e Provisões (Simulated to match mockups)
        const transferProvision = totalRevenue * 0.78;
        const totalTransferred = totalRevenue * 0.58;
        const expenseProvision = totalRevenue * 0.57;
        const transactionCount = 4563;

        // 5. School Info
        let schoolInfo = {
            razaoSocial: 'Escola Caritas LTDA',
            cnpj: '12.345.678/0001-90',
            modeloContratacao: 'Full',
            periodo: 'Outubro 2025'
        };

        if (escolaId) {
            const { data: school } = await supabase.from('escola').select('nome, cnpj').eq('id', escolaId).single();
            if (school) {
                schoolInfo.razaoSocial = `${school.nome} LTDA`;
                schoolInfo.cnpj = school.cnpj || '12.345.678/0001-90';
            }
        }

        return {
            totalRevenue,
            totalDevices,
            totalStudents: studentCount,
            transferProvision,
            totalTransferred,
            expenseProvision,
            transactionCount,
            schoolInfo
        };
    }

    async getTransactionHistory(escolaId?: string, filter: TimeFilter = '7 dias'): Promise<TransactionPoint[]> {
        const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
        // Mocking values relative to transaction volumes for visual consistency
        return labels.map(label => ({
            label,
            transacted: 8000 + Math.random() * 8000,
            transferred: 4000 + Math.random() * 4000
        }));
    }

    async getBillingHistory(escolaId?: string, mode: 'Full' | 'Lite' = 'Full'): Promise<BillingPoint[]> {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
        return months.map((month, i) => {
            const base = 8000 + (i * 2000);
            return {
                month,
                revenue: base + 4000,
                totalTransfer: base + 1000,
                transferProvision: base - 2000,
                transactionCount: 3000 + (i * 500)
            };
        });
    }
}
