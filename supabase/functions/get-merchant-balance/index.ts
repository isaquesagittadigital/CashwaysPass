import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Obter o usuario_id (UserID/UUID) do body (POST) ou da URL (GET)
        let usuario_id: string | null = null;
        
        if (req.method === 'POST') {
            const body = await req.json();
            usuario_id = body.usuario_id || body.UserID || body.lojista_id; 
        } else {
            const url = new URL(req.url);
            usuario_id = url.searchParams.get("usuario_id") || url.searchParams.get("UserID") || url.searchParams.get("lojista_id");
        }

        if (!usuario_id) {
            throw new Error("Parâmetro 'usuario_id' (UserID) é obrigatório.");
        }

        // Validação estrita de UUID para UserID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuario_id);

        if (!isUUID) {
            throw new Error("O ID fornecido deve ser um UUID (UserID) válido.");
        }

        // Buscar dados do lojista na tabela usuarios filtrando sempre pelo UserID (UUID)
        const { data: user, error } = await supabaseClient
            .from('usuarios')
            .select('nome, total_vendas, total_devolucao, UserID, id')
            .eq('tipo_acesso', 'Lojista')
            .eq('UserID', usuario_id)
            .maybeSingle();

        if (error) {
            console.error("Erro SQL:", error);
            throw new Error("Erro ao consultar dados do lojista.");
        }

        if (!user) {
            throw new Error("Lojista não encontrado com o UserID fornecido.");
        }

        const totalVendas = Number(user.total_vendas || 0);
        const totalDevolucao = Number(user.total_devolucao || 0);
        const saldoLiquido = totalVendas - totalDevolucao;

        return new Response(JSON.stringify({
            success: true,
            data: {
                UserID: user.UserID, // Retornando explicitamente como UserID
                id_interno: user.id,
                nome: user.nome,
                total_vendas: totalVendas,
                total_devolucao: totalDevolucao,
                saldo_liquido: saldoLiquido,
                moeda: "R$"
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Get Balance:", error.message);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
