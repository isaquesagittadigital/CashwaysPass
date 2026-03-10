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

        // 1. Total de Receitas (from investimento_aluno sum)
        let revenueQuery = supabase.from('investimento_aluno').select('valor_investido').gte('created_date', startDate);
        if (escolaId) revenueQuery = revenueQuery.eq('escola_id', escolaId);
        const { data: revData } = await revenueQuery;
        const totalRevenue = revData?.reduce((acc, curr) => acc + (Number(curr.valor_investido) || 0), 0) || 0;

        // 2. Transaction Count (from investimento_aluno count as proxy)
        let transQuery = supabase.from('investimento_aluno').select('id', { count: 'exact', head: true }).gte('created_date', startDate);
        if (escolaId) transQuery = transQuery.eq('escola_id', escolaId);
        const { count: transCount } = await transQuery;
        const transactionCount = transCount || 0;

        // 3. Total Alunos
        let studentQuery = supabase.from('aluno').select('id', { count: 'exact', head: true });
        if (escolaId) studentQuery = studentQuery.eq('escola_id', escolaId);
        const { count: studentCount } = await studentQuery;
        const totalStudents = studentCount || 0;

        // 4. Total Dispositivos (from escola.quantidade_equipamentos)
        let deviceQuery = supabase.from('escola').select('quantidade_equipamentos');
        if (escolaId) deviceQuery = deviceQuery.eq('id', escolaId);
        const { data: devData } = await deviceQuery;
        const totalDevices = devData?.reduce((acc, curr) => acc + (Number(curr.quantidade_equipamentos) || 0), 0) || 0;

        // 5. Repasses e Provisões (Percentages based on real revenue, pending real tables)
        const transferProvision = totalRevenue * 0.78;
        const totalTransferred = totalRevenue * 0.58;
        const expenseProvision = totalRevenue * 0.57;

        // 6. School Info
        let schoolInfo = {
            razaoSocial: 'Escolas Selecionadas',
            cnpj: 'Não aplicável',
            modeloContratacao: 'Misto',
            periodo: 'Atual'
        };

        if (escolaId) {
            const { data: school } = await supabase.from('escola').select('nome, cnpj, modelo_contratacao').eq('id', escolaId).single();
            if (school) {
                schoolInfo.razaoSocial = `${school.nome} LTDA`;
                schoolInfo.cnpj = school.cnpj || '12.345.678/0001-90';
                schoolInfo.modeloContratacao = school.modelo_contratacao || 'Full';
                
                const dateOptions: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
                schoolInfo.periodo = new Date().toLocaleDateString('pt-BR', dateOptions).replace(/^\w/, c => c.toUpperCase());
            }
        }

        return {
            totalRevenue,
            totalDevices,
            totalStudents,
            transferProvision,
            totalTransferred,
            expenseProvision,
            transactionCount,
            schoolInfo
        };
    }

    async getTransactionHistory(escolaId?: string, filter: TimeFilter = '7 dias'): Promise<TransactionPoint[]> {
        const startDate = this.getStartDate(filter);
        let labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
        
        if (filter === '24 horas') labels = ['00h', '04h', '08h', '12h', '16h', '20h'];
        else if (filter === '30 dias') labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
        else if (filter === '12 meses') labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        // Init buckets
        const points: TransactionPoint[] = labels.map(label => ({
            label,
            transacted: 0,
            transferred: 0
        }));

        // Fetch real data
        let query = supabase.from('investimento_aluno').select('created_date, valor_investido').gte('created_date', startDate);
        if (escolaId) query = query.eq('escola_id', escolaId);
        const { data } = await query;

        // Populate buckets
        if (data) {
            data.forEach(row => {
                const date = new Date(row.created_date || new Date());
                let bucketIndex = 0;

                if (filter === '24 horas') {
                    bucketIndex = Math.floor(date.getHours() / 4);
                } else if (filter === '7 dias') {
                    bucketIndex = (date.getDay() + 6) % 7; // Seg = 0
                } else if (filter === '30 dias') {
                     const diffDays = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 3600 * 24));
                     bucketIndex = 3 - Math.min(3, Math.floor(diffDays / 7)); // Sem 4 is latest
                } else if (filter === '12 meses') {
                    bucketIndex = date.getMonth();
                }
                
                if (points[bucketIndex]) {
                    const val = Number(row.valor_investido) || 0;
                    points[bucketIndex].transacted += val;
                    // Provisory simulation logic for transferred vs transacted as we don't have separate distinct records mapped
                    points[bucketIndex].transferred += val * 0.58; 
                }
            });
        }

        return points;
    }

    async getBillingHistory(escolaId?: string, mode: 'Full' | 'Lite' = 'Full', filter: TimeFilter = '7 dias'): Promise<BillingPoint[]> {
        const startDate = this.getStartDate(filter);
        let months = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
        
        if (filter === '24 horas') months = ['00h', '04h', '08h', '12h', '16h', '20h'];
        else if (filter === '30 dias') months = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
        else if (filter === '12 meses') months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        const points: BillingPoint[] = months.map(month => ({
            month,
            revenue: 0,
            totalTransfer: 0,
            transferProvision: 0,
            transactionCount: 0
        }));

        let query = supabase.from('investimento_aluno').select('created_date, valor_investido').gte('created_date', startDate);
        if (escolaId) query = query.eq('escola_id', escolaId);
        const { data } = await query;

        if (data) {
            data.forEach(row => {
                const date = new Date(row.created_date || new Date());
                let bucketIndex = 0;

                if (filter === '24 horas') {
                    bucketIndex = Math.floor(date.getHours() / 4);
                } else if (filter === '7 dias') {
                    bucketIndex = (date.getDay() + 6) % 7; 
                } else if (filter === '30 dias') {
                     const diffDays = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 3600 * 24));
                     bucketIndex = 3 - Math.min(3, Math.floor(diffDays / 7));
                } else if (filter === '12 meses') {
                    bucketIndex = date.getMonth();
                }
                
                if (points[bucketIndex]) {
                    const val = Number(row.valor_investido) || 0;
                    points[bucketIndex].revenue += val;
                    points[bucketIndex].totalTransfer += val * 0.58;
                    points[bucketIndex].transferProvision += val * 0.78;
                    points[bucketIndex].transactionCount = (points[bucketIndex].transactionCount || 0) + 1;
                }
            });
        }

        return points;
    }
}
