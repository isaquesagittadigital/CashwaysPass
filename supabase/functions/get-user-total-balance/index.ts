
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        
        // Usamos Service Role para garantir leitura sem bloqueio de RLS
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Tenta pegar usuario do Auth (prioridade)
        let userId = null;
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader ?? undefined)
        
        if (user) {
            userId = user.id;
        } else {
            // Se não tem token, tenta ler do body (para testes ou chamadas admin)
            try {
                const body = await req.json();
                userId = body.user_id;
            } catch (e) {
                // body vazio
            }
        }

        if (!userId) {
            throw new Error("Usuário não identificado (Envie Token ou user_id no body).");
        }

        console.log(`Calculando total para UserID: ${userId}`);

        // 2. [REMOVIDO] Buscar Saldos Principais (não necessário mais)

        // 3. Buscar e Somar Propósitos
        const { data: propositosData, error: propError } = await supabaseClient
            .from('propositos')
            .select('saldo, nome')
            .eq('usuario_id', userId);

        if (propError) throw new Error("Erro ao buscar propósitos.");

        // Helper de conversão
        const parseSaldo = (valor: any): number => {
            if (!valor) return 0;
            let clean = String(valor).replace(/[^0-9.,-]/g, "");
            
            // Lógica para detectar e limpar formato BR (1.000,00) vs US
            if (clean.includes(',')) {
                clean = clean.replace(/\./g, '');
                clean = clean.replace(',', '.');
            }
            const parsed = parseFloat(clean);
            return isNaN(parsed) ? 0 : parsed;
        };

        let totalPropositos = 0;
        const propositosDetalhados = propositosData?.map(p => {
            const val = parseSaldo(p.saldo);
            totalPropositos += val;
            return { nome: p.nome, valor_original: p.saldo, valor_numerico: val };
        });

        // 4. Calcular Total Apenas dos Propositos
        
        return new Response(JSON.stringify({ 
            success: true, 
            user_id: userId,
            total_propositos: totalPropositos, // Foco principal
            detalhes: {
                // carteira: saldoCarteira, // Comentado pois o foco é propósitos
                // investido: saldoInvestido,
                lista_propositos: propositosDetalhados
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
