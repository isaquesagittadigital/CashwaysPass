import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        const { record_id, novo_status } = await req.json();

        if (!record_id) {
            throw new Error("O parâmetro 'record_id' (ID do registro na tabela produtos_aluno) é obrigatório.");
        }

        // 1. Buscar o registro atual
        const { data: record, error: fetchError } = await supabaseClient
            .from('produtos_aluno')
            .select('id, quantidade, status_item, nome_item')
            .eq('id', record_id)
            .single();

        if (fetchError || !record) {
            throw new Error(`Registro não encontrado (ID: ${record_id}).`);
        }

        const qtdAtual = Number(record.quantidade || 0);

        if (qtdAtual <= 0) {
            throw new Error(`Este item (${record.nome_item}) já foi totalmente utilizado.`);
        }

        // 2. Calcular nova quantidade e novo status
        const novaQtd = qtdAtual - 1;
        
        // Se a quantidade chegar a 0, o status obrigatoriamente vira 'Usado' 
        // a menos que o usuário tenha enviado um status específico.
        const statusFinal = (novaQtd === 0) ? 'Usado' : (novo_status || record.status_item);

        // 3. Atualizar o registro
        const { data: updatedRecord, error: updateError } = await supabaseClient
            .from('produtos_aluno')
            .update({
                quantidade: novaQtd,
                status_item: statusFinal,
                data_acao: new Date().toISOString()
            })
            .eq('id', record_id)
            .select()
            .single();

        if (updateError) {
            throw new Error("Erro ao atualizar o registro: " + updateError.message);
        }

        // 4. Log opcional na movimentação financeira (opcional, mas bom para auditoria)
        // Aqui poderíamos adicionar um log se necessário.

        return new Response(JSON.stringify({
            success: true,
            message: `1 unidade de '${record.nome_item}' utilizada com sucesso.`,
            data: {
                final_quantidade: novaQtd,
                final_status: statusFinal,
                record: updatedRecord
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
