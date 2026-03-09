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
        const {
            lojista_id,
            filter_month,  // 'JAN', 'FEV', ... 'NOV', 'DEZ'
            filter_period, // 'Hoje', 'Ontem', 'Todos os dias'
            filter_type,   // 'Vendas', 'Devolução', 'Todas'
            search,        // Nome ou RA
            page = 1,
            limit = 10,
            year           // Opcional, default ano atual
        } = body;

        if (!lojista_id) {
            throw new Error("lojista_id é obrigatório.")
        }

        // --- 1. LÓGICA DE DATAS (O "Cérebro" da Função) ---

        const now = new Date();
        // Ajuste fuso Brasil (UTC-3) "na mão" para garantir o dia correto
        const brazilOffset = 3 * 60 * 60 * 1000; // 3 horas em ms
        const nowBrazil = new Date(now.getTime() - brazilOffset);

        let startDateStr = "";
        let endDateStr = "";

        // Mapa de Meses
        const monthMap: { [key: string]: number } = {
            'JAN': 0, 'FEV': 1, 'MAR': 2, 'ABR': 3, 'MAI': 4, 'JUN': 5,
            'JUL': 6, 'AGO': 7, 'SET': 8, 'OUT': 9, 'NOV': 10, 'DEZ': 11
        };

        const currentYear = year || nowBrazil.getFullYear();

        // Normalizar filtros para garantir match
        const periodNormalized = filter_period ? filter_period.toLowerCase() : "";

        if (periodNormalized === 'hoje') {
            // Início do dia (00:00) e Fim do dia (23:59) HOJE
            startDateStr = new Date(nowBrazil.getFullYear(), nowBrazil.getMonth(), nowBrazil.getDate(), 0, 0, 0).toISOString();
            endDateStr = new Date(nowBrazil.getFullYear(), nowBrazil.getMonth(), nowBrazil.getDate(), 23, 59, 59).toISOString();

        } else if (periodNormalized === 'ontem') {
            // Ontem
            const yesterday = new Date(nowBrazil);
            yesterday.setDate(yesterday.getDate() - 1);
            startDateStr = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0).toISOString();
            endDateStr = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59).toISOString();

        } else {
            // "Todos os dias" OU Default -> Respeita o Mês da Aba (filter_month)
            // Se filter_month for passado ("NOV"), usa ele. Se não, usa mês atual.
            let targetMonth = nowBrazil.getMonth();

            if (filter_month && monthMap[filter_month.toUpperCase()] !== undefined) {
                targetMonth = monthMap[filter_month.toUpperCase()];
            }

            // Dia 1 do mês alvo
            const start = new Date(currentYear, targetMonth, 1, 0, 0, 0);
            // Subtrai o offset pra garantir que begin-of-month em UTC bata com Brasil?
            // Na verdade, ISO String é UTC. Se queremos 00:00 Brasil, temos que adicionar 3h ao UTC.
            // Mas para simplificar, vamos criar a data local e converter.
            // Melhor abordagem simples: Criar data string YYYY-MM-DD e buscar gte/lte

            // Abordagem Segura:
            const startMonth = new Date(Date.UTC(currentYear, targetMonth, 1, 3, 0, 0)); // 00:00 BRT = 03:00 UTC
            const endMonth = new Date(Date.UTC(currentYear, targetMonth + 1, 0, 23 + 3, 59, 59)); // Ultimo dia

            startDateStr = startMonth.toISOString();
            endDateStr = endMonth.toISOString();
        }

        // --- 2. LÓGICA DE TIPO ---
        let dbType = "";
        const typeNormalized = filter_type ? filter_type.toLowerCase() : "";

        if (typeNormalized.includes('venda')) dbType = 'VENDA';
        else if (typeNormalized.includes('devolu')) dbType = 'DEVOLUCAO';
        // Se for 'Todas' ou vazio, dbType continua vazio e traz tudo.

        // --- 3. CONSTRUÇÃO DA QUERY ---
        let query = supabaseClient
            .from('lojista_historico')
            .select('*', { count: 'exact' })
            .eq('lojista_id', lojista_id)

        // Aplica Datas
        if (startDateStr && endDateStr) {
            query = query.gte('data_hora', startDateStr).lte('data_hora', endDateStr)
        }

        // Aplica Tipo
        if (dbType) {
            query = query.eq('tipo_operacao', dbType)
        }

        // Aplica Busca Texto
        if (search) {
            query = query.or(`aluno_nome.ilike.%${search}%,descricao.ilike.%${search}%`)
        }

        // Ordenação e Paginação
        query = query.order('data_hora', { ascending: false })

        const p = Number(page) || 1;
        const l = Number(limit) || 10;
        const from = (p - 1) * l
        const to = from + l - 1
        query = query.range(from, to)

        // --- EXECUÇÃO ---
        const { data, error, count } = await query

        if (error) {
            console.error("Erro SQL:", error)
            throw new Error("Erro ao consultar histórico.")
        }

        // Retornamos também os filtros aplicados para debug do front se precisar
        return new Response(JSON.stringify({
            success: true,
            data: data,
            meta: {
                page: p,
                limit: l,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / l),
                applied_filters: { startDate: startDateStr, endDate: endDateStr, type: dbType }
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Get Transactions:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})