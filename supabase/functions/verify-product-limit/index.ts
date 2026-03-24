import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isUUID(str: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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

        const { aluno_id, produto_id, quantidade_desejada } = await req.json();

        if (!aluno_id || !produto_id) {
            throw new Error("Parâmetros 'aluno_id' e 'produto_id' são obrigatórios.")
        }

        const qtdPretendida = Number(quantidade_desejada || 1);

        // 1. Identificar Aluno
        let queryAluno = supabaseClient.from('aluno').select('id, nome');
        if (isUUID(aluno_id)) {
            queryAluno = queryAluno.or(`id.eq.${aluno_id},user_id.eq.${aluno_id}`);
        } else {
            queryAluno = queryAluno.eq('usuario_id', aluno_id);
        }

        const { data: alunoData, error: alunoError } = await queryAluno.maybeSingle();
        if (alunoError || !alunoData) throw new Error("Aluno não encontrado.");

        const realAlunoId = alunoData.id;

        // 2. Obter limite do produto
        const { data: dbProd, error: prodError } = await supabaseClient
            .from('produto')
            .select('id, nome, limete_por_aluno')
            .eq('id', produto_id)
            .single();

        if (prodError || !dbProd) throw new Error("Produto não encontrado.");

        const maxLimit = dbProd.limete_por_aluno;

        // 3. Consultar quantidade já comprada
        const { data: pastPurchases, error: pastError } = await supabaseClient
            .from('produtos_aluno')
            .select('quantidade')
            .eq('aluno_id', realAlunoId)
            .eq('produto_id', produto_id);

        let qtdJaComprada = 0;
        if (!pastError && pastPurchases) {
            qtdJaComprada = pastPurchases.reduce((acc, curr) => acc + (curr.quantidade || 1), 0);
        }

        // 4. Calcular Resultado
        let podeComprar = true;
        let mensagem = "Compra permitida.";
        let restante = 999999; // Sem limite

        if (maxLimit !== null && maxLimit !== undefined && typeof maxLimit === 'number') {
            restante = Math.max(0, maxLimit - qtdJaComprada);
            if ((qtdJaComprada + qtdPretendida) > maxLimit) {
                podeComprar = false;
                mensagem = `Limite de compra excedido. O limite para este produto é de ${maxLimit} itens. Você já garantiu ${qtdJaComprada} e tentou comprar mais ${qtdPretendida}.`;
            } else {
                mensagem = `Você tem ${qtdJaComprada} itens e pode comprar mais ${restante}.`;
            }
        }

        return new Response(JSON.stringify({
            success: true,
            data: {
                pode_comprar: podeComprar,
                limite_maximo: maxLimit,
                ja_comprado: qtdJaComprada,
                quantidade_solicitada: qtdPretendida,
                restante_permitido: restante,
                mensagem: mensagem,
                aluno_nome: alunoData.nome,
                produto_nome: dbProd.nome
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
