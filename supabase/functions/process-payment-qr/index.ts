import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para normalizar strings
function normalizeString(str: string) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { qr_code, lojista_id, valor_debito } = await req.json();

        if (!qr_code || !lojista_id || valor_debito === undefined) {
             throw new Error("Parâmetros inválidos. Necessário: qr_code, lojista_id e valor_debito.")
        }

        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str));
        const valorDebitoNum = parseFloat(String(valor_debito).replace(',', '.'));

        console.log(`[QR-PAYMENT] Iniciando Pagamento via QR: ${qr_code}, Lojista: ${lojista_id}, Valor: ${valorDebitoNum}`);

        // --- PASSO 1: Localizar a Carteira e o Usuário via QR Code ---
        const { data: dispositivo, error: dispError } = await supabaseClient
            .from('dispositivos_carteira')
            .select('carteira_id, status, carteira(Usuario)')
            .eq('qr_code', qr_code)
            .single();

        if (dispError || !dispositivo) {
            throw new Error(`QR Code não reconhecido (${qr_code}).`);
        }

        if (dispositivo.status !== 'ativo') {
            throw new Error("Este dispositivo/QR Code está bloqueado ou inativo.");
        }

        const finalAlunoUserId = dispositivo.carteira.Usuario; // ID BigInt do aluno

        // --- PASSO 2: Obter Dados do Lojista ---
        let queryLojista = supabaseClient.from('usuarios').select('Proposito_Lojista, nome, total_vendas, UserID, id');
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
        const totalVendasAtual = Number(lojista.total_vendas || 0);

        if (!nomeProposito) {
             throw new Error("Este lojista não possui um propósito configurado.");
        }

        // --- PASSO 3: Verificar Saldo do Aluno ---
        const { data: todosPropositos, error: propError } = await supabaseClient
            .from('propositos')
            .select('id, saldo, nome')
            .eq('usuario_id', finalAlunoUserId); // Usa BigInt

        if (propError) throw new Error("Erro ao buscar saldos do aluno.");

        const targetNameNormalized = normalizeString(nomeProposito);
        const propositoAluno = todosPropositos?.find(p => normalizeString(p.nome || '') === targetNameNormalized);

        if (!propositoAluno) {
             throw new Error(`Propósito '${nomeProposito}' não encontrado na conta do aluno.`);
        }

        const saldoAtual = parseFloat(String(propositoAluno.saldo || '0').replace(',', '.'));

        if (saldoAtual < valorDebitoNum) {
            throw new Error(`Saldo insuficiente. Disponível: R$ ${saldoAtual.toFixed(2)}.`);
        }

        // --- PASSO 4: Executar Transação ---
        
        // 4.1. Debitar Aluno
        const novoSaldoAluno = saldoAtual - valorDebitoNum;
        await supabaseClient
            .from('propositos')
            .update({ saldo: novoSaldoAluno.toString() }) 
            .eq('id', propositoAluno.id);

        // 4.2. Atualizar Lojista
        const novoTotalVendas = totalVendasAtual + valorDebitoNum;
        await supabaseClient
            .from('usuarios')
            .update({ total_vendas: novoTotalVendas })
            .eq('id', lojista.id);

        // 4.3. Logs (Busca robusta do Aluno p/ Log)
        const { data: alunoInfoLog } = await supabaseClient
            .from('aluno')
            .select('id, nome')
            .or(`usuario_id.eq.${finalAlunoUserId},user_id.eq.${finalAlunoUserId}`)
            .maybeSingle();

        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const currentMonth = monthNames[new Date().getMonth()];

        await supabaseClient.from('movimentacao_financeira').insert({
            aluno_id: alunoInfoLog?.id || null,
            tipo_operacao: 'COMPRA_QRCODE',
            categoria: 'Venda',
            nome_operacao: `Compra QR Code: ${lojista.nome}`,
            mes_operacao: currentMonth,
            status: 'CONCLUIDO',
            valor: valorDebitoNum,
            request_payload: { qr_code, lojista_id, valor: valorDebitoNum },
            response_payload: { aluno_nome: alunoInfoLog?.nome || "Aluno", novo_saldo: novoSaldoAluno },
            http_status: 200
        });

        // Histórico Lojista
        try {
            await supabaseClient.from('lojista_historico').insert({
                lojista_id: lojista.UserID,
                aluno_id: finalAlunoUserId,
                aluno_nome: alunoInfoLog?.nome || "Aluno",
                valor: valorDebitoNum,
                tipo_operacao: 'VENDA_QR',
                saldo_vendas_pos: novoTotalVendas,
                descricao: `Venda QR - ${alunoInfoLog?.nome || "Aluno"}`
            });
        } catch(e) {}

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Pagamento via QR Code realizado!",
            data: { novo_saldo_aluno: novoSaldoAluno }
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
