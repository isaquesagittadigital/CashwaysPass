-- Full Migration File
-- Generated from Supabase Project Metadata

-- 1. Create Custom Types / Enums
DO $$ BEGIN
    CREATE TYPE public."status" AS ENUM ('invited', 'active', 'blocked', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE public."tipo_user" AS ENUM ('Admin', 'Escola', 'Lojista', 'Aluno', 'Responsavel', 'Convidado', 'Professor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE public."Propositos" AS ENUM ('Alimentação', 'Entretenimento', 'Mercado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Tables
CREATE TABLE IF NOT EXISTS public."escola" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "razao_social" varchar,
    "nome_fantasia" varchar,
    "cnpj" varchar,
    "email_contato" varchar,
    "telefone_contato" varchar,
    "whatsapp" varchar,
    "endereco" text,
    "responsavel_pedagogico" varchar,
    "responsavel_direcao" varchar,
    "tipo_escola" varchar,
    "ordenacao" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "modelo_contratacao" varchar,
    "dias_repasse" integer,
    "possui_equipamentos" boolean DEFAULT false,
    "quantidade_equipamentos" integer DEFAULT 0,
    "valor_unitario_equipamento" numeric DEFAULT 0,
    "cobra_transacoes" boolean DEFAULT false,
    "valor_unitario_transacao" numeric DEFAULT 0,
    "valor_carteira" numeric DEFAULT 0,
    "valor_transferencia" numeric DEFAULT 0,
    "nome_secretariado" varchar,
    "email_secretaria_admin" varchar,
    "cep" varchar,
    "complemento" varchar,
    "status" public."status" DEFAULT 'active'::status,
    "deletado" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."turma" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "escola_id" uuid,
    "nome" varchar,
    "ano_semestre" varchar,
    "Periodos" varchar,
    "estagio" text,
    "serie" text,
    "professor" text,
    "quantidade_alunos" integer DEFAULT 0,
    "data_entrada" date DEFAULT CURRENT_DATE,
    "status" boolean DEFAULT true,
    "nome_filtro" varchar,
    "data_inicio" date DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS public."aluno" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "escola_id" uuid,
    "turma_id" uuid,
    "nome" varchar,
    "email" varchar,
    "cpf" varchar,
    "transfeera_recipient_id" varchar,
    "transfeera_status" varchar,
    "transfeera_key_type" varchar,
    "transfeera_key_value" varchar,
    "user_id" uuid,
    "primeiro_acesso" boolean,
    "data_nascimento" date,
    "foto_perfil" text,
    "nome_completo" text,
    "nome_mae" text,
    "ra" varchar,
    "saldo_carteira" numeric DEFAULT 0.00,
    "saldo_investido" numeric DEFAULT 0.00,
    "temp_pass" text,
    "usuario_id" bigint
);

CREATE TABLE IF NOT EXISTS public."professor" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "escola_id" uuid,
    "nome" varchar,
    "especialidade" varchar
);

CREATE TABLE IF NOT EXISTS public."noticia" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "escola_id" uuid,
    "titulo" varchar,
    "conteudo" text,
    "data_publicacao" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."produto" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "escola_id" uuid,
    "nome" varchar,
    "descricao" text,
    "preco" numeric,
    "url_imagem" varchar,
    "Data_vigencia_incio" date,
    "Data_vigencia_final" date,
    "limete_por_aluno" numeric,
    "Status" boolean
);

CREATE TABLE IF NOT EXISTS public."investimento" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "nome" varchar,
    "descricao" text,
    "tipo" varchar
);

CREATE TABLE IF NOT EXISTS public."investimento_aluno" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
    "status_investimento" varchar DEFAULT 'Ativo'::character varying,
    "titulo" varchar,
    "created_date" timestamp with time zone DEFAULT now(),
    "descricao" text,
    "valor" numeric,
    "id_user" uuid,
    "id_pix_transfeera" text
);

CREATE TABLE IF NOT EXISTS public."historico_investimento" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "investimento_aluno_id" uuid,
    "data_transacao" timestamp with time zone DEFAULT now(),
    "tipo_operacao" varchar,
    "valor_movimento" numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."log_valorizacao_dinamica" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "investimento_id" uuid,
    "valor_aplicado" numeric,
    "sequencia" integer,
    "log_detalhes" text,
    "data_registro" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."aluno_inventario" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "aluno_id" uuid,
    "produto_id" uuid,
    "nome_item" varchar,
    "descricao" text,
    "imagem_url" varchar,
    "data_aquisicao" timestamp with time zone DEFAULT now(),
    "data_expiracao" timestamp with time zone,
    "valor_aquisicao" numeric,
    "quantidade" integer DEFAULT 1,
    "status_item" varchar
);

CREATE TABLE IF NOT EXISTS public."missao" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "descricao" text,
    "data_inicio" timestamp with time zone,
    "data_termino" timestamp with time zone,
    "recompensa" text
);

CREATE TABLE IF NOT EXISTS public."logs_missao" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "missao_id" uuid,
    "aluno_id" uuid,
    "log_texto" text,
    "data_log" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."usuarios" (
    "id" bigint PRIMARY KEY NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "nome" varchar,
    "data_nascimento" date,
    "escola_id" uuid,
    "foto_perfil" text,
    "nome_completo" text,
    "nome_mae" text,
    "ra" varchar,
    "saldo_carteira" numeric DEFAULT 0.00,
    "saldo_investido" numeric DEFAULT 0.00,
    "temp_pass" text,
    "email" varchar,
    "UserID" uuid DEFAULT auth.uid(),
    "cpf" varchar,
    "turmaID" uuid,
    "tipo_acesso" public."tipo_user",
    "ultimo_login" date,
    "status" public."status" DEFAULT 'active'::status,
    "senha" varchar,
    "deleted" boolean DEFAULT false,
    "Proposito_Lojista" public."Propositos",
    "total_vendas" numeric,
    "total_devolucao" numeric,
    "reset_code" text,
    "reset_expires_at" timestamp with time zone,
    "grau_escolaridade" text
);

CREATE TABLE IF NOT EXISTS public."transfeera_log" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "aluno_id" uuid,
    "tipo_operacao" varchar,
    "endpoint_url" varchar,
    "request_payload" jsonb,
    "response_payload" jsonb,
    "http_status" integer,
    "external_id" varchar,
    "status" varchar,
    "created_date" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."propositos" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "nome" text NOT NULL,
    "saldo" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "usuario_id" uuid
);

CREATE TABLE IF NOT EXISTS public."whatsapp_instances" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "instance_name" text NOT NULL,
    "status" text DEFAULT 'disconnected'::text,
    "qrcode" text,
    "last_updated" timestamp with time zone DEFAULT now(),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "integration_config" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public."whatsapp_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "patient_name" text,
    "phone" text NOT NULL,
    "content" text,
    "status" text DEFAULT 'pending'::text NOT NULL,
    "error_message" text,
    "sent_at" timestamp with time zone DEFAULT now(),
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Carteira" (
    "id" bigint PRIMARY KEY NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "Usuario" bigint,
    "carteira_code" varchar,
    "turmaID" uuid DEFAULT gen_random_uuid(),
    "escola_id" uuid DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public."lojista_historico" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "lojista_id" uuid NOT NULL,
    "aluno_id" uuid,
    "aluno_nome" text,
    "aluno_turma" text,
    "valor" numeric NOT NULL,
    "tipo_operacao" text,
    "saldo_vendas_pos" numeric,
    "data_hora" timestamp with time zone DEFAULT now(),
    "descricao" text,
    CONSTRAINT "lojista_historico_tipo_operacao_check" CHECK (tipo_operacao = ANY (ARRAY['VENDA'::text, 'DEVOLUCAO'::text, 'RETIRADA'::text]))
);

CREATE TABLE IF NOT EXISTS public."pedidos_compra" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "numero" text NOT NULL,
    "ong_id" uuid NOT NULL,
    "data_solicitacao" timestamp with time zone DEFAULT now(),
    "prioridade" text DEFAULT 'Normal'::text,
    "status" text DEFAULT 'Pendente'::text,
    "solicitante" text,
    "fornecedor_sugerido" text,
    "observacao" text,
    "deletado" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."pedidos_compra_itens" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "pedido_id" uuid NOT NULL,
    "produto_id" uuid,
    "nome_produto" text NOT NULL,
    "quantidade_solicitada" numeric DEFAULT 0,
    "unidade_medida" text DEFAULT 'UN'::text,
    "estoque_atual" numeric DEFAULT 0,
    "estoque_minimo" numeric DEFAULT 0,
    "sugestao_compra" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."eventos" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "escola_id" uuid,
    "capa_url" text,
    "ativo" boolean DEFAULT false,
    "nome" text NOT NULL,
    "descricao_curta" text,
    "data_evento" date,
    "lojistas_convidados" text[],
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "turma_id" uuid,
    "turma_ids" uuid[]
);

CREATE TABLE IF NOT EXISTS public."versionamento" (
    "id" integer PRIMARY KEY DEFAULT nextval('versionamento_id_seq'::regclass) NOT NULL,
    "commits_count" integer DEFAULT 0 NOT NULL,
    "version_string" varchar NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now()
);

-- 3. Add Foreign Key Constraints
ALTER TABLE public."investimento_aluno" 
    DROP CONSTRAINT IF EXISTS "investimento_aluno_escola_id_fkey",
    ADD CONSTRAINT "investimento_aluno_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES public."escola" ("id") ON DELETE CASCADE;
ALTER TABLE public."eventos" 
    DROP CONSTRAINT IF EXISTS "eventos_escola_id_fkey",
    ADD CONSTRAINT "eventos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES public."escola" ("id") ON DELETE CASCADE;
ALTER TABLE public."usuarios" 
    DROP CONSTRAINT IF EXISTS "usuarios_escola_id_fkey",
    ADD CONSTRAINT "usuarios_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES public."escola" ("id") ON DELETE CASCADE;
ALTER TABLE public."turma" 
    DROP CONSTRAINT IF EXISTS "turma_escola_id_fkey",
    ADD CONSTRAINT "turma_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES public."escola" ("id") ON DELETE CASCADE;
ALTER TABLE public."aluno" 
    DROP CONSTRAINT IF EXISTS "aluno_escola_id_fkey",
    ADD CONSTRAINT "aluno_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES public."escola" ("id") ON DELETE CASCADE;
ALTER TABLE public."professor" 
    DROP CONSTRAINT IF EXISTS "professor_escola_id_fkey",
    ADD CONSTRAINT "professor_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES public."escola" ("id") ON DELETE CASCADE;
ALTER TABLE public."noticia" 
    DROP CONSTRAINT IF EXISTS "noticia_escola_id_fkey",
    ADD CONSTRAINT "noticia_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES public."escola" ("id") ON DELETE CASCADE;
ALTER TABLE public."produto" 
    DROP CONSTRAINT IF EXISTS "produto_escola_id_fkey",
    ADD CONSTRAINT "produto_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES public."escola" ("id") ON DELETE CASCADE;
ALTER TABLE public."eventos" 
    DROP CONSTRAINT IF EXISTS "eventos_turma_id_fkey",
    ADD CONSTRAINT "eventos_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES public."turma" ("id") ON DELETE CASCADE;
ALTER TABLE public."aluno" 
    DROP CONSTRAINT IF EXISTS "aluno_turma_id_fkey",
    ADD CONSTRAINT "aluno_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES public."turma" ("id") ON DELETE CASCADE;
ALTER TABLE public."usuarios" 
    DROP CONSTRAINT IF EXISTS "usuarios_turmaID_fkey",
    ADD CONSTRAINT "usuarios_turmaID_fkey" FOREIGN KEY ("turmaID") REFERENCES public."turma" ("id") ON DELETE CASCADE;
ALTER TABLE public."transfeera_log" 
    DROP CONSTRAINT IF EXISTS "transfeera_log_aluno_id_fkey",
    ADD CONSTRAINT "transfeera_log_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."aluno" ("id") ON DELETE CASCADE;
ALTER TABLE public."aluno" 
    DROP CONSTRAINT IF EXISTS "aluno_user_id_fkey",
    ADD CONSTRAINT "aluno_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth."users" ("id") ON DELETE CASCADE;
ALTER TABLE public."aluno" 
    DROP CONSTRAINT IF EXISTS "aluno_usuario_id_fkey",
    ADD CONSTRAINT "aluno_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES public."usuarios" ("id") ON DELETE CASCADE;
ALTER TABLE public."investimento_aluno" 
    DROP CONSTRAINT IF EXISTS "investimento_aluno_aluno_id_fkey",
    ADD CONSTRAINT "investimento_aluno_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."aluno" ("id") ON DELETE CASCADE;
ALTER TABLE public."aluno_inventario" 
    DROP CONSTRAINT IF EXISTS "aluno_inventario_aluno_id_fkey",
    ADD CONSTRAINT "aluno_inventario_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."aluno" ("id") ON DELETE CASCADE;
ALTER TABLE public."logs_missao" 
    DROP CONSTRAINT IF EXISTS "logs_missao_aluno_id_fkey",
    ADD CONSTRAINT "logs_missao_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."aluno" ("id") ON DELETE CASCADE;
ALTER TABLE public."aluno_inventario" 
    DROP CONSTRAINT IF EXISTS "aluno_inventario_produto_id_fkey",
    ADD CONSTRAINT "aluno_inventario_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES public."produto" ("id") ON DELETE CASCADE;
ALTER TABLE public."log_valorizacao_dinamica" 
    DROP CONSTRAINT IF EXISTS "log_valorizacao_dinamica_investimento_id_fkey",
    ADD CONSTRAINT "log_valorizacao_dinamica_investimento_id_fkey" FOREIGN KEY ("investimento_id") REFERENCES public."investimento" ("id") ON DELETE CASCADE;
ALTER TABLE public."investimento_aluno" 
    DROP CONSTRAINT IF EXISTS "investimento_aluno_investimento_id_fkey",
    ADD CONSTRAINT "investimento_aluno_investimento_id_fkey" FOREIGN KEY ("investimento_id") REFERENCES public."investimento" ("id") ON DELETE CASCADE;
ALTER TABLE public."investimento_aluno" 
    DROP CONSTRAINT IF EXISTS "investimento_aluno_id_user_fkey",
    ADD CONSTRAINT "investimento_aluno_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES auth."users" ("id") ON DELETE CASCADE;
ALTER TABLE public."historico_investimento" 
    DROP CONSTRAINT IF EXISTS "historico_investimento_investimento_aluno_id_fkey",
    ADD CONSTRAINT "historico_investimento_investimento_aluno_id_fkey" FOREIGN KEY ("investimento_aluno_id") REFERENCES public."investimento_aluno" ("id") ON DELETE CASCADE;
ALTER TABLE public."logs_missao" 
    DROP CONSTRAINT IF EXISTS "logs_missao_missao_id_fkey",
    ADD CONSTRAINT "logs_missao_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES public."missao" ("id") ON DELETE CASCADE;
ALTER TABLE public."Carteira" 
    DROP CONSTRAINT IF EXISTS "Carteira_Usuario_fkey",
    ADD CONSTRAINT "Carteira_Usuario_fkey" FOREIGN KEY ("Usuario") REFERENCES public."usuarios" ("id") ON DELETE CASCADE;
ALTER TABLE public."usuarios" 
    DROP CONSTRAINT IF EXISTS "usuarios_UserID_fkey",
    ADD CONSTRAINT "usuarios_UserID_fkey" FOREIGN KEY ("UserID") REFERENCES auth."users" ("id") ON DELETE CASCADE;
ALTER TABLE public."propositos" 
    DROP CONSTRAINT IF EXISTS "propositos_usuario_id_fkey",
    ADD CONSTRAINT "propositos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES auth."users" ("id") ON DELETE CASCADE;
ALTER TABLE public."whatsapp_instances" 
    DROP CONSTRAINT IF EXISTS "whatsapp_instances_user_id_fkey",
    ADD CONSTRAINT "whatsapp_instances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth."users" ("id") ON DELETE CASCADE;
ALTER TABLE public."whatsapp_messages" 
    DROP CONSTRAINT IF EXISTS "whatsapp_messages_user_id_fkey",
    ADD CONSTRAINT "whatsapp_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth."users" ("id") ON DELETE CASCADE;
ALTER TABLE public."pedidos_compra_itens" 
    DROP CONSTRAINT IF EXISTS "pedidos_compra_itens_pedido_id_fkey",
    ADD CONSTRAINT "pedidos_compra_itens_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES public."pedidos_compra" ("id") ON DELETE CASCADE;
