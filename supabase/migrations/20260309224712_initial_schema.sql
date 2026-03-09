-- Migration File: Initial Schema
-- Generated automatically from OpenAPI schema

CREATE TABLE IF NOT EXISTS public."historico_investimento" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "investimento_aluno_id" uuid,
  "data_transacao" text DEFAULT now(),
  "tipo_operacao" text,
  "valor_movimento" numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."investimento_aluno" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "aluno_id" uuid,
  "investimento_id" uuid,
  "escola_id" uuid,
  "data_inicio" date,
  "data_resgate" date,
  "valor_investido" numeric DEFAULT 0,
  "saldo_atual" numeric DEFAULT 0,
  "quantidade_ativos" numeric,
  "rentabilidade_acumulada" numeric DEFAULT 0,
  "valor_resgate" numeric,
  "status_investimento" text DEFAULT 'Ativo',
  "titulo" text,
  "created_date" text DEFAULT now(),
  "descricao" text,
  "valor" numeric,
  "id_user" uuid,
  "id_pix_transfeera" text
);

CREATE TABLE IF NOT EXISTS public."logs_missao" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "missao_id" uuid,
  "aluno_id" uuid,
  "log_texto" text,
  "data_log" text DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."escola" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "razao_social" text,
  "nome_fantasia" text,
  "cnpj" text,
  "email_contato" text,
  "telefone_contato" text,
  "whatsapp" text,
  "endereco" text,
  "responsavel_pedagogico" text,
  "responsavel_direcao" text,
  "tipo_escola" text,
  "ordenacao" integer DEFAULT 0,
  "created_at" text DEFAULT now(),
  "modelo_contratacao" text,
  "dias_repasse" integer,
  "possui_equipamentos" boolean DEFAULT false,
  "quantidade_equipamentos" integer DEFAULT 0,
  "valor_unitario_equipamento" numeric DEFAULT 0,
  "cobra_transacoes" boolean DEFAULT false,
  "valor_unitario_transacao" numeric DEFAULT 0,
  "valor_carteira" numeric DEFAULT 0,
  "valor_transferencia" numeric DEFAULT 0,
  "nome_secretariado" text,
  "email_secretaria_admin" text,
  "cep" text,
  "complemento" text,
  "status" text DEFAULT 'active',
  "deletado" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."propositos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "saldo" text,
  "created_at" text DEFAULT now(),
  "usuario_id" uuid
);

CREATE TABLE IF NOT EXISTS public."pedidos_compra_itens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pedido_id" uuid,
  "produto_id" uuid,
  "nome_produto" text,
  "quantidade_solicitada" numeric DEFAULT 0,
  "unidade_medida" text DEFAULT 'UN',
  "estoque_atual" numeric DEFAULT 0,
  "estoque_minimo" numeric DEFAULT 0,
  "sugestao_compra" numeric DEFAULT 0,
  "created_at" text DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."versionamento" (
  "id" integer PRIMARY KEY,
  "commits_count" integer DEFAULT 0,
  "version_string" text,
  "updated_at" text DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."professor" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "escola_id" uuid,
  "nome" text,
  "especialidade" text
);

CREATE TABLE IF NOT EXISTS public."usuarios" (
  "id" integer PRIMARY KEY,
  "created_at" text DEFAULT now(),
  "nome" text,
  "data_nascimento" date,
  "escola_id" uuid,
  "foto_perfil" text,
  "nome_completo" text,
  "nome_mae" text,
  "ra" text,
  "saldo_carteira" numeric DEFAULT 0,
  "saldo_investido" numeric DEFAULT 0,
  "temp_pass" text,
  "email" text,
  "UserID" uuid DEFAULT auth.uid(),
  "cpf" text,
  "turmaID" uuid,
  "tipo_acesso" text,
  "ultimo_login" date,
  "status" text DEFAULT 'active',
  "senha" text,
  "deleted" boolean DEFAULT false,
  "Proposito_Lojista" text,
  "total_vendas" numeric,
  "total_devolucao" numeric,
  "reset_code" text,
  "reset_expires_at" text,
  "grau_escolaridade" text
);

CREATE TABLE IF NOT EXISTS public."investimento" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "descricao" text,
  "tipo" text
);

CREATE TABLE IF NOT EXISTS public."pedidos_compra" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "numero" text,
  "ong_id" uuid,
  "data_solicitacao" text DEFAULT now(),
  "prioridade" text DEFAULT 'Normal',
  "status" text DEFAULT 'Pendente',
  "solicitante" text,
  "fornecedor_sugerido" text,
  "observacao" text,
  "deletado" boolean DEFAULT false,
  "created_at" text DEFAULT now(),
  "updated_at" text DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."whatsapp_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "instance_name" text,
  "status" text DEFAULT 'disconnected',
  "qrcode" text,
  "last_updated" text DEFAULT now(),
  "created_at" text DEFAULT now(),
  "updated_at" text DEFAULT now(),
  "integration_config" text
);

CREATE TABLE IF NOT EXISTS public."missao" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "descricao" text,
  "data_inicio" text,
  "data_termino" text,
  "recompensa" text
);

CREATE TABLE IF NOT EXISTS public."Carteira" (
  "id" integer PRIMARY KEY,
  "created_at" text DEFAULT now(),
  "Usuario" integer,
  "carteira_code" text,
  "turmaID" uuid DEFAULT gen_random_uuid(),
  "escola_id" uuid DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public."log_valorizacao_dinamica" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "investimento_id" uuid,
  "valor_aplicado" numeric,
  "sequencia" integer,
  "log_detalhes" text,
  "data_registro" text DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."transfeera_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "aluno_id" uuid,
  "tipo_operacao" text,
  "endpoint_url" text,
  "request_payload" text,
  "response_payload" text,
  "http_status" integer,
  "external_id" text,
  "status" text,
  "created_date" text DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."aluno_inventario" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "aluno_id" uuid,
  "produto_id" uuid,
  "nome_item" text,
  "descricao" text,
  "imagem_url" text,
  "data_aquisicao" text DEFAULT now(),
  "data_expiracao" text,
  "valor_aquisicao" numeric,
  "quantidade" integer DEFAULT 1,
  "status_item" text
);

CREATE TABLE IF NOT EXISTS public."noticia" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "escola_id" uuid,
  "titulo" text,
  "conteudo" text,
  "data_publicacao" text DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."turma" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "escola_id" uuid,
  "nome" text,
  "ano_semestre" text,
  "Periodos" text,
  "estagio" text,
  "serie" text,
  "professor" text,
  "quantidade_alunos" integer DEFAULT 0,
  "data_entrada" date DEFAULT 'CURRENT_DATE',
  "status" boolean DEFAULT true,
  "nome_filtro" text,
  "data_inicio" date DEFAULT 'CURRENT_DATE'
);

CREATE TABLE IF NOT EXISTS public."aluno" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "escola_id" uuid,
  "turma_id" uuid,
  "nome" text,
  "email" text,
  "cpf" text,
  "transfeera_recipient_id" text,
  "transfeera_status" text,
  "transfeera_key_type" text,
  "transfeera_key_value" text,
  "user_id" uuid,
  "primeiro_acesso" boolean,
  "data_nascimento" date,
  "foto_perfil" text,
  "nome_completo" text,
  "nome_mae" text,
  "ra" text,
  "saldo_carteira" numeric DEFAULT 0,
  "saldo_investido" numeric DEFAULT 0,
  "temp_pass" text,
  "usuario_id" integer
);

CREATE TABLE IF NOT EXISTS public."whatsapp_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "patient_name" text,
  "phone" text,
  "content" text,
  "status" text DEFAULT 'pending',
  "error_message" text,
  "sent_at" text DEFAULT now(),
  "created_at" text DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."lojista_historico" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lojista_id" uuid,
  "aluno_id" uuid,
  "aluno_nome" text,
  "aluno_turma" text,
  "valor" numeric,
  "tipo_operacao" text,
  "saldo_vendas_pos" numeric,
  "data_hora" text DEFAULT now(),
  "descricao" text
);

CREATE TABLE IF NOT EXISTS public."produto" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "escola_id" uuid,
  "nome" text,
  "descricao" text,
  "preco" numeric,
  "url_imagem" text,
  "Data_vigencia_incio" date,
  "Data_vigencia_final" date,
  "limete_por_aluno" numeric,
  "Status" boolean
);

CREATE TABLE IF NOT EXISTS public."eventos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "escola_id" uuid,
  "capa_url" text,
  "ativo" boolean DEFAULT false,
  "nome" text,
  "descricao_curta" text,
  "data_evento" date,
  "lojistas_convidados" jsonb,
  "created_at" text DEFAULT timezone('utc'::text, now()),
  "updated_at" text DEFAULT timezone('utc'::text, now()),
  "turma_id" uuid,
  "turma_ids" jsonb
);

