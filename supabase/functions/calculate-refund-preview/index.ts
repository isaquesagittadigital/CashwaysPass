import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função de normalização para busca exata de propósito
function normalizeString(str: string) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

Deno.serve(async (req) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // --- BODY PARSER ---
        const rawBody = await req.text();
        let body;
        
        try {
            body = JSON.parse(rawBody);
        } catch (e: any) {
            const fixedBody = rawBody.replace(/:\s*(\d+),(\d+)/g, ': $1.$2');
            try {
                body = JSON.parse(fixedBody);
            } catch (e2: any) {
                throw new Error(`O JSON enviado está inválido. Erro: ${e.message}`);
            }
        }

        // Parâmetros: aluno_id, lojista_id, valor, tipo ('VENDA' ou 'DEVOLUCAO')
        const { aluno_id, lojista_id, valor, valor_devolucao, valor_debito, tipo = 'DEVOLUCAO' } = body;
        
        // Valor Final (suporte a múltiplas nomenclaturas para compatibilidade)
        const valorFinal = valor || valor_devolucao || valor_debito;
        const tipoFinal = String(tipo).toUpperCase();

        if (!aluno_id || !lojista_id || valorFinal === undefined) {
            throw new Error("Parâmetros inválidos. Necessário: aluno_id, lojista_id, valor e tipo.");
        }

        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str));
        const valorNum = parseFloat(String(valorFinal).replace(',', '.'));

        // --- PASSO 1: Obter Dados do Lojista ---
        let queryLojista = supabaseClient.from('usuarios').select('id, Proposito_Lojista, nome, total_vendas, total_devolucao, UserID');
        if (isUUID(lojista_id)) {
            queryLojista = queryLojista.eq('UserID', lojista_id);
        } else {
            queryLojista = queryLojista.eq('id', lojista_id);
        }

        const { data: lojista, error: lojistaError } = await queryLojista.single();

        if (lojistaError || !lojista) {
            throw new Error(`Lojista não encontrado.`);
        }

        const nomeProposito = lojista.Proposito_Lojista;
        const vendasLojista = Number(lojista.total_vendas || 0);
        const devolucoesLojista = Number(lojista.total_devolucao || 0);
        const saldoAtualLojista = vendasLojista - devolucoesLojista;

        if (!nomeProposito) {
            throw new Error("Este lojista não possui um propósito configurado.");
        }

        // --- PASSO 2: Resolver Aluno ID e Nome ---
        let finalAlunoUserId = aluno_id;
        let nomeAluno = "Aluno";
        
        const { data: userRecord } = await supabaseClient.from('usuarios').select('UserID, nome').or(`UserID.eq.${isUUID(aluno_id) ? aluno_id : '00000000-0000-0000-0000-000000000000'},id.eq.${!isNaN(Number(aluno_id)) ? aluno_id : -1}`).single();
        
        if (userRecord) {
            finalAlunoUserId = userRecord.UserID;
            nomeAluno = userRecord.nome || "Aluno";
        } else {
            const { data: alunoRecord } = await supabaseClient.from('aluno').select('user_id, nome').or(`user_id.eq.${isUUID(aluno_id) ? aluno_id : '00000000-0000-0000-0000-000000000000'},usuario_id.eq.${!isNaN(Number(aluno_id)) ? aluno_id : -1}`).single();
            if (alunoRecord) {
                finalAlunoUserId = alunoRecord.user_id;
                nomeAluno = alunoRecord.nome || "Aluno";
            }
        }

        // --- PASSO 3: Buscar Saldo do Aluno no Propósito correto ---
        const { data: todosPropositos } = await supabaseClient
            .from('propositos')
            .select('saldo, nome')
            .eq('usuario_id', finalAlunoUserId);

        const targetNameNormalized = normalizeString(nomeProposito);
        const propositoAluno = todosPropositos?.find(p => normalizeString(p.nome || '') === targetNameNormalized);

        let saldoAtualAluno = 0;
        if (propositoAluno) {
            saldoAtualAluno = parseFloat(String(propositoAluno.saldo || '0').replace(',', '.'));
        }

        // --- PASSO 4: Calcular Previews ---
        let novoSaldoAluno = saldoAtualAluno;
        let novoSaldoLojista = saldoAtualLojista;
        let novoTotalVendasLojista = vendasLojista;

        if (tipoFinal === 'VENDA') {
            novoSaldoAluno = saldoAtualAluno - valorNum;
            novoTotalVendasLojista = vendasLojista + valorNum;
            novoSaldoLojista = novoTotalVendasLojista - devolucoesLojista;
        } else if (tipoFinal === 'DEVOLUCAO') {
            novoSaldoAluno = saldoAtualAluno + valorNum;
            novoTotalVendasLojista = vendasLojista - valorNum;
            novoSaldoLojista = novoTotalVendasLojista - devolucoesLojista;
        } else {
            throw new Error("Tipo de transação inválido. Use 'VENDA' ou 'DEVOLUCAO'.");
        }

        return new Response(JSON.stringify({
            success: true,
            tipo: tipoFinal,
            data: {
                detalhes_lojista: {
                    nome: lojista.nome,
                    proposito: nomeProposito,
                    saldo_atual_liquido: saldoAtualLojista,
                    total_vendas_atual: vendasLojista,
                    novo_total_vendas_confirmado: novoTotalVendasLojista,
                    novo_saldo_liquido_previsão: novoSaldoLojista
                },
                detalhes_aluno: {
                    nome: nomeAluno,
                    saldo_atual: saldoAtualAluno,
                    novo_saldo_previsao: novoSaldoAluno,
                    saldo_suficiente: (tipoFinal === 'VENDA' ? novoSaldoAluno >= 0 : true)
                },
                valor_transacao: valorNum
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
