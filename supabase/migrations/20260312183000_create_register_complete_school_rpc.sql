-- Migration: 20260312183000_create_register_complete_school_rpc.sql
-- Description: Creates a unified function for school registration to ensure atomicity.

CREATE OR REPLACE FUNCTION public.register_complete_school(registration_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_school_id UUID;
    v_professor_id UUID;
    v_turma_id UUID;
    v_user_id BIGINT;
    v_school_json JSONB;
    v_professors_json JSONB;
    v_turmas_json JSONB;
    v_students_json JSONB;
    v_prof_item JSONB;
    v_turma_item JSONB;
    v_student_item JSONB;
    v_temp_pass TEXT;
    v_turma_map JSONB := '{}'::jsonb;
    v_prof_map JSONB := '{}'::jsonb;
BEGIN
    -- Extract components from registration_data
    v_school_json := registration_data->'school';
    v_professors_json := registration_data->'professors';
    v_turmas_json := registration_data->'turmas';
    v_students_json := registration_data->'students';

    -- 1. Upsert School
    INSERT INTO public.escola (
        nome_fantasia, cnpj, razao_social, modelo_contratacao, dias_repasse, 
        possui_equipamentos, quantidade_equipamentos, valor_unitario_equipamento, 
        cobra_transacoes, valor_unitario_transacao, tipo_escola, responsavel_direcao, 
        nome_secretariado, email_contato, email_secretaria_admin, telefone_contato, 
        whatsapp, cep, complemento, endereco, valor_carteira, valor_transferencia, deletado
    ) VALUES (
        v_school_json->>'nome', v_school_json->>'cnpj', v_school_json->>'razaoSocial', 
        v_school_json->>'modeloContratacao', (v_school_json->>'diasRepasse')::INT, 
        (v_school_json->>'possuiEquipamentos')::BOOLEAN, (v_school_json->>'quantidadeEquipamentos')::INT, 
        (v_school_json->>'valorUnitarioEquipamento')::NUMERIC, (v_school_json->>'cobraTransacoes')::BOOLEAN, 
        (v_school_json->>'valorUnitarioTransacao')::NUMERIC, v_school_json->>'serie', 
        v_school_json->>'nomeDirecao', v_school_json->>'nomeSecretariado', 
        v_school_json->>'emailEscola', v_school_json->>'emailSecretariaAdmin', 
        v_school_json->>'telefone', v_school_json->>'whatsapp', v_school_json->>'cep', 
        v_school_json->>'complemento', v_school_json->>'enderecoCompleto', 
        (v_school_json->>'valorCarteira')::NUMERIC, (v_school_json->>'valorTransferencia')::NUMERIC, false
    ) ON CONFLICT (cnpj) DO UPDATE SET
        nome_fantasia = EXCLUDED.nome_fantasia,
        razao_social = EXCLUDED.razao_social,
        modelo_contratacao = EXCLUDED.modelo_contratacao,
        dias_repasse = EXCLUDED.dias_repasse,
        possui_equipamentos = EXCLUDED.possui_equipamentos,
        quantidade_equipamentos = EXCLUDED.quantidade_equipamentos,
        valor_unitario_equipamento = EXCLUDED.valor_unitario_equipamento,
        cobra_transacoes = EXCLUDED.cobra_transacoes,
        valor_unitario_transacao = EXCLUDED.valor_unitario_transacao,
        tipo_escola = EXCLUDED.tipo_escola,
        responsavel_direcao = EXCLUDED.responsavel_direcao,
        nome_secretariado = EXCLUDED.nome_secretariado,
        email_contato = EXCLUDED.email_contato,
        email_secretaria_admin = EXCLUDED.email_secretaria_admin,
        telefone_contato = EXCLUDED.telefone_contato,
        whatsapp = EXCLUDED.whatsapp,
        cep = EXCLUDED.cep,
        complemento = EXCLUDED.complemento,
        endereco = EXCLUDED.endereco,
        valor_carteira = EXCLUDED.valor_carteira,
        valor_transferencia = EXCLUDED.valor_transferencia,
        deletado = false
    RETURNING id INTO v_school_id;

    -- 2. Create User for the School (if not exists)
    v_temp_pass := substring(md5(random()::text), 1, 8);
    INSERT INTO public.usuarios (nome_completo, nome, email, tipo_acesso, status, escola_id, temp_pass, primeiro_acesso)
    VALUES (v_school_json->>'nome', v_school_json->>'nome', v_school_json->>'emailEscola', 'Escola', 'active', v_school_id, v_temp_pass, false)
    ON CONFLICT (email) DO UPDATE SET
        nome_completo = EXCLUDED.nome_completo,
        nome = EXCLUDED.nome,
        escola_id = EXCLUDED.escola_id,
        primeiro_acesso = COALESCE(public.usuarios.primeiro_acesso, EXCLUDED.primeiro_acesso);

    -- 3. Upsert Professors
    FOR v_prof_item IN SELECT * FROM jsonb_array_elements(v_professors_json) LOOP
        -- Upsert in professor table
        INSERT INTO public.professor (nome, especialidade, escola_id)
        VALUES (v_prof_item->>'nome', v_prof_item->>'escolaridade', v_school_id)
        RETURNING id INTO v_professor_id;

        -- Store map from frontend ID to DB ID
        v_prof_map := v_prof_map || jsonb_build_object(v_prof_item->>'id', v_professor_id);

        -- Upsert in usuarios table
        v_temp_pass := substring(md5(random()::text), 1, 8);
        INSERT INTO public.usuarios (nome_completo, nome, email, tipo_acesso, status, escola_id, grau_escolaridade, temp_pass, primeiro_acesso)
        VALUES (v_prof_item->>'nome', v_prof_item->>'nome', v_prof_item->>'email', 'Professor', 'active', v_school_id, v_prof_item->>'escolaridade', v_temp_pass, false)
        ON CONFLICT (email) DO UPDATE SET
            nome_completo = EXCLUDED.nome_completo,
            nome = EXCLUDED.nome,
            tipo_acesso = EXCLUDED.tipo_acesso,
            status = EXCLUDED.status,
            escola_id = EXCLUDED.escola_id,
            grau_escolaridade = EXCLUDED.grau_escolaridade,
            temp_pass = COALESCE(public.usuarios.temp_pass, EXCLUDED.temp_pass),
            primeiro_acesso = COALESCE(public.usuarios.primeiro_acesso, EXCLUDED.primeiro_acesso);
    END LOOP;

    -- 4. Upsert Turmas
    FOR v_turma_item IN SELECT * FROM jsonb_array_elements(v_turmas_json) LOOP
        INSERT INTO public.turma (
            nome, estagio, "Periodos", serie, professor, quantidade_alunos, 
            data_inicio, data_entrada, escola_id, status
        ) VALUES (
            v_turma_item->>'nome', v_turma_item->>'estagio', v_turma_item->>'Periodos', 
            v_turma_item->>'serie', 
            (SELECT nome FROM public.professor WHERE id = (v_prof_map->>(v_turma_item->>'professor_id'))::UUID),
            (v_turma_item->>'quantidade_alunos')::INT, (v_turma_item->>'data_inicio')::DATE, 
            (v_turma_item->>'data_inicio')::DATE, v_school_id, true
        )
        RETURNING id INTO v_turma_id;

        -- Store map from frontend ID to DB ID
        v_turma_map := v_turma_map || jsonb_build_object(v_turma_item->>'id', v_turma_id);
    END LOOP;

    -- 5. Upsert Students
    FOR v_student_item IN SELECT * FROM jsonb_array_elements(v_students_json) LOOP
        v_turma_id := (v_turma_map->>(v_student_item->>'turmaId'))::UUID;

        -- a. Upsert Usuario
        v_temp_pass := substring(md5(random()::text), 1, 8);
        INSERT INTO public.usuarios (
            nome_completo, nome, email, tipo_acesso, status, escola_id, 
            turmaID, nome_mae, ra, temp_pass, primeiro_acesso
        ) VALUES (
            v_student_item->>'nome', v_student_item->>'nome', v_student_item->>'emailAluno', 
            'Aluno', 'active', v_school_id, v_turma_id, 
            v_student_item->>'responsavel', v_student_item->>'numeroCarteira', v_temp_pass, false
        ) ON CONFLICT (email) DO UPDATE SET
            nome_completo = EXCLUDED.nome_completo,
            nome = EXCLUDED.nome,
            escola_id = EXCLUDED.escola_id,
            turmaID = EXCLUDED.turmaID,
            nome_mae = EXCLUDED.nome_mae,
            ra = EXCLUDED.ra,
            temp_pass = COALESCE(public.usuarios.temp_pass, EXCLUDED.temp_pass),
            primeiro_acesso = COALESCE(public.usuarios.primeiro_acesso, EXCLUDED.primeiro_acesso)
        RETURNING id INTO v_user_id;

        -- b. Upsert Aluno
        INSERT INTO public.aluno (
            usuario_id, escola_id, turma_id, nome, email, nome_mae, ra, temp_pass, primeiro_acesso
        ) VALUES (
            v_user_id, v_school_id, v_turma_id, v_student_item->>'nome', 
            v_student_item->>'emailAluno', v_student_item->>'responsavel', 
            v_student_item->>'numeroCarteira', v_temp_pass, false
        ) ON CONFLICT (email) DO UPDATE SET
            usuario_id = EXCLUDED.usuario_id,
            escola_id = EXCLUDED.escola_id,
            turma_id = EXCLUDED.turma_id,
            nome = EXCLUDED.nome,
            nome_mae = EXCLUDED.nome_mae,
            ra = EXCLUDED.ra,
            temp_pass = COALESCE(public.aluno.temp_pass, EXCLUDED.temp_pass),
            primeiro_acesso = COALESCE(public.aluno.primeiro_acesso, EXCLUDED.primeiro_acesso);

        -- c. Upsert Carteira
        INSERT INTO public.carteira (
            "Usuario", carteira_code, "turmaID", escola_id
        ) VALUES (
            v_user_id, v_student_item->>'numeroCarteira', v_turma_id, v_school_id
        ) ON CONFLICT (carteira_code) DO UPDATE SET
            "Usuario" = EXCLUDED."Usuario",
            "turmaID" = EXCLUDED."turmaID",
            escola_id = EXCLUDED.escola_id;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'school_id', v_school_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;
