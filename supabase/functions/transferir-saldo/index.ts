
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        const body = await req.json()
        const { user_id, valor, origem, destino } = body;

        // ValidaÃ§Ãµes BÃ¡sicas
        if (!user_id || !valor || valor <= 0 || !origem || !destino) {
            throw new Error("ParÃ¢metros invÃ¡lidos. NecessÃ¡rio: user_id, valor (>0), origem (nome ou 'Saldo'), destino (nome ou 'Saldo').")
        }

        if (origem === destino) {
            throw new Error("Origem e destino nÃ£o podem ser iguais.")
        }

        // Helper para limpar saldo
        const parseSaldo = (valor: any): number => {
            if (!valor) return 0;
            let clean = String(valor).replace(/[^0-9.,-]/g, "");
            if (clean.includes(',')) {
                clean = clean.replace(/\./g, '');
                clean = clean.replace(',', '.');
            }
            const parsed = parseFloat(clean);
            return isNaN(parsed) ? 0 : parsed;
        };

        // Converter valor para nÃºmero float
        const valorTransferencia = parseFloat(valor);

        console.log(`[TRANSFER] User: ${user_id} | Valor: ${valorTransferencia} | De: ${origem} -> Para: ${destino}`);

        // --- PASSO 1: SACAR DA ORIGEM ---
        const isOrigemSaldo = origem.toLowerCase() === 'saldo';

        if (isOrigemSaldo) {
            // Sacar da Carteira Principal
            const { data: usuario, error: userError } = await supabaseClient
                .from('usuarios')
                .select('saldo_carteira')
                .eq('UserID', user_id)
                .single()

            if (userError || !usuario) throw new Error("UsuÃ¡rio nÃ£o encontrado.")

            const saldoAtual = Number(usuario.saldo_carteira) || 0;
            if (saldoAtual < valorTransferencia) {
                throw new Error(`Saldo insuficiente na carteira. DisponÃ­vel: ${saldoAtual}`);
            }

            const { error: updateOrigem } = await supabaseClient
                .from('usuarios')
                .update({ saldo_carteira: saldoAtual - valorTransferencia })
                .eq('UserID', user_id)

            if (updateOrigem) throw new Error("Erro ao debitar da carteira.")

        } else {
            // Sacar de um PropÃ³sito (Busca por NOME + USER_ID)
            const { data: proposito, error: propError } = await supabaseClient
                .from('propositos')
                .select('id, saldo, nome')
                .ilike('nome', origem) // Case insensitive
                .eq('usuario_id', user_id)
                .single()

            if (propError || !proposito) throw new Error(`PropÃ³sito de origem '${origem}' nÃ£o encontrado.`)

            const saldoProp = parseSaldo(proposito.saldo);
            console.log(`[DEBUG] Saldo Origem Atual (${proposito.nome}): ${saldoProp} (Raw: ${proposito.saldo})`);

            if (saldoProp < valorTransferencia) {
                throw new Error(`Saldo insuficiente no propÃ³sito '${proposito.nome}'. DisponÃ­vel: ${saldoProp}`);
            }

            const novoSaldoOrigem = saldoProp - valorTransferencia;

            const { error: updatePropOrigem } = await supabaseClient
                .from('propositos')
                .update({ saldo: novoSaldoOrigem.toFixed(2) })
                .eq('id', proposito.id)

            if (updatePropOrigem) throw new Error("Erro ao debitar do propÃ³sito de origem.")
        }


        // --- PASSO 2: CREDITAR NO DESTINO ---
        const isDestinoSaldo = destino.toLowerCase() === 'saldo';

        if (isDestinoSaldo) {
            // Depositar na Carteira Principal
            const { data: usuarioDest, error: userDestError } = await supabaseClient
                .from('usuarios')
                .select('saldo_carteira')
                .eq('UserID', user_id)
                .single()

            if (userDestError) throw new Error("Erro ao ler destino (UsuÃ¡rio).")

            const saldoDestAtual = Number(usuarioDest.saldo_carteira) || 0;

            const { error: updateDest } = await supabaseClient
                .from('usuarios')
                .update({ saldo_carteira: saldoDestAtual + valorTransferencia })
                .eq('UserID', user_id)

            if (updateDest) throw new Error("Erro ao creditar na carteira principal.")

        } else {
            // Depositar num PropÃ³sito (Busca por NOME + USER_ID)
            const { data: propDest, error: propDestError } = await supabaseClient
                .from('propositos')
                .select('id, saldo, nome')
                .ilike('nome', destino) // Case insensitive
                .eq('usuario_id', user_id)
                .single()

            if (propDestError || !propDest) throw new Error(`PropÃ³sito de destino '${destino}' nÃ£o encontrado.`)

            const saldoPropDest = parseSaldo(propDest.saldo);
            const novoSaldoDestino = saldoPropDest + valorTransferencia;

            console.log(`[DEBUG] Saldo Destino Antes: ${saldoPropDest} | Depois: ${novoSaldoDestino}`);

            const { error: updatePropDest } = await supabaseClient
                .from('propositos')
                .update({ saldo: novoSaldoDestino.toFixed(2) })
                .eq('id', propDest.id)

            if (updatePropDest) throw new Error("Erro ao creditar no propÃ³sito de destino.")
        }

        // --- PASSO 3: LOG DA TRANSAÃ‡ÃƒO ---
        const { data: alunoInfo } = await supabaseClient.from('aluno').select('id, nome').eq('user_id', user_id).maybeSingle();
        
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const currentMonth = monthNames[new Date().getMonth()];

        await supabaseClient.from('movimentacao_financeira').insert({
            aluno_id: alunoInfo?.id || null,
            tipo_operacao: 'TRANSFERENCIA_INTERNA',
            categoria: destino,
            nome_operacao: `Movimentação entre ${origem} para ${destino}`,
            mes_operacao: currentMonth,
            status: 'CONCLUIDO',
            request_payload: { user_id, valor, origem, destino },
            response_payload: { 
                mensagem: `Transferido de ${origem} para ${destino}`,
                valor_total: valorTransferencia,
                item: "TransferÃªncia",
                aluno_nome: alunoInfo?.nome || "UsuÃ¡rio Interno"
            },
            http_status: 200
        })

        return new Response(JSON.stringify({
            success: true,
            message: "TransferÃªncia realizada com sucesso."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Transferencia:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400, // Bad Request para erros de validaÃ§Ã£o/saldo
        })
    }
})

