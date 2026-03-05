import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to bypass RLS securely in backend
const supabaseUrl = process.env.SUPABASE_URL || 'https://xxxxxxxxxxxxxxxxxxxx.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'xxxxxxxxxxxxxxxxxxxx';

const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/api/admin/dashboard', async (req, res) => {
    try {
        // 1. Total Investido (soma do valor investido de todos os alunos)
        const { data: investimentos, error: erroInvestimentos } = await supabase
            .from('investimento_aluno')
            .select('valor_investido');

        // 2. Transações (Valor transferido vs transacionado)
        // Buscando de transfeera_log ou lojista_historico como base para as métricas.
        const { data: vendas, error: erroVendas } = await supabase
            .from('lojista_historico')
            .select('valor, data_hora, tipo_operacao');

        const totalInvestido = investimentos?.reduce((acc, curr) => acc + (Number(curr.valor_investido) || 0), 0) || 0;

        // Simplificando o cálculo de "Total gasto" para o Dashboard
        const totalGasto = vendas?.filter(v => v.tipo_operacao === 'VENDA').reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0) || 0;

        // Retornando a estrutura para o React
        res.json({
            success: true,
            data: {
                distribuicao_saldo: {
                    total_investido: totalInvestido,
                    total_gasto: totalGasto,
                    saldo_livre: 15000,       // Mocked - needs logic per user summation
                    saldo_propositos: 8000    // Mocked - needs logic per propositos table
                },
                transacoes: vendas || [],
                resumo_turma: []
            }
        });

    } catch (err: any) {
        console.error('API Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 Cashways Pass Backend running on port ${PORT}`);
});
