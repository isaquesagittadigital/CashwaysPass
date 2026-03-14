import { Injectable } from '@angular/core';
import { supabase } from '../supabase';

export interface LojistaStats {
    total_vendas: number;
    total_devolucao: number;
}

export interface LojistaHistorico {
    id: string;
    aluno_nome: string;
    aluno_turma: string;
    valor: number;
    tipo_operacao: 'VENDA' | 'DEVOLUCAO' | 'RETIRADA' | 'REPOSICAO';
    data_hora: string;
    descricao?: string;
}

@Injectable({
    providedIn: 'root'
})
export class LojistaService {

    async getStats(id: number): Promise<LojistaStats> {
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('total_vendas, total_devolucao')
                .eq('id', id)
                .single();

            if (error) throw error;

            return {
                total_vendas: data.total_vendas || 0,
                total_devolucao: data.total_devolucao || 0
            };
        } catch (error) {
            console.error('Error fetching lojista stats:', error);
            return { total_vendas: 0, total_devolucao: 0 };
        }
    }

    async getHistorico(userID: string, limit: number = 20): Promise<LojistaHistorico[]> {
        try {
            const { data, error } = await supabase
                .from('lojista_historico')
                .select('*')
                .eq('lojista_id', userID)
                .order('data_hora', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return (data || []) as LojistaHistorico[];
        } catch (error) {
            console.error('Error fetching lojista history:', error);
            return [];
        }
    }

    async registrarVenda(payload: {
        lojista_id: string;
        aluno_id: string;
        valor: number;
        descricao?: string;
    }) {
        // Implementação futura enviando para RPC ou lógica direta
        // Idealmente isso seria um RPC para garantir atomicidade (deduzir saldo do aluno + incrementar vendas lojista)
        console.log('Registrando venda:', payload);
    }
}
