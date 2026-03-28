import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Configuração de CORS para chamadas do navegador/FlutterFlow
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const url = new URL(req.url);
    const paramId = url.searchParams.get('aluno_id');

    if (!paramId) {
      throw new Error('aluno_id is required');
    }

    // Resolvemos o ID: pode ser tanto o aluno_id quanto o user_id (Auth)
    const { data: alunoData, error: errAluno } = await supabaseClient
      .from('aluno')
      .select('id')
      .or(`id.eq.${paramId},user_id.eq.${paramId}`)
      .maybeSingle();

    if (errAluno) throw errAluno;
    
    // Se não encontrou o aluno, retorna vazio amigavelmente
    if (!alunoData) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const target_aluno_id = alunoData.id;

    // Buscamos itens na tabela investimento_aluno (Logs e MOEDAS)
    const { data: investimentos, error: errInv } = await supabaseClient
      .from('investimento_aluno')
      .select('titulo, descricao, valor, status_investimento, created_date, data_resgate')
      .eq('aluno_id', target_aluno_id)
      .is('data_resgate', null)
      .not('status_investimento', 'in', '("resgatado","usado","Resgatado","Usado")');

    if (errInv) throw errInv;

    // Buscamos itens na tabela produtos_aluno (Usamos apenas os valores exatos do ENUM)
    const { data: produtos, error: errProd } = await supabaseClient
      .from('produtos_aluno')
      .select('nome_item, descricao, valor_compra, status_item, data_compra, imagem_url')
      .eq('aluno_id', target_aluno_id)
      .not('status_item', 'in', '("Resgatado","Usado")');

    if (errProd) throw errProd;

    // Juntamos os dois e padronizamos
    const combinedData = [
      ...investimentos.map(item => ({
        nome: item.titulo === 'COMPRA_PRODUTO' ? item.descricao.replace('Compra de produto: ', '') : item.titulo,
        descricao: item.descricao,
        valor: item.valor,
        imagem_url: null, // investimento_aluno não possui imagem direta
        data_criacao: item.created_date
      })),
      ...produtos.map(item => ({
        nome: item.nome_item,
        descricao: item.descricao,
        valor: item.valor_compra,
        imagem_url: item.imagem_url,
        data_criacao: item.data_compra
      }))
    ];

    return new Response(JSON.stringify(combinedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
