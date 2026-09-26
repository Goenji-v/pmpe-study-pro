-- Uma questão anulada deixa de integrar o total válido de qualquer tentativa.
-- O catálogo preserva a questão para auditoria; resultados e cadernos são reconciliados
-- automaticamente quando o status muda para "anulada".

create schema if not exists private;

create or replace function private.recalcular_resultados_questao_anulada(
  p_questao_id uuid,
  p_motivo text
)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'pg_temp'
as $function$
declare
  v_resultado record;
  v_dados jsonb;
  v_auditoria_existente jsonb;
  v_questoes_antes jsonb;
  v_questoes_validas jsonb;
  v_questao_alvo jsonb;
  v_respostas_antes jsonb;
  v_respostas_validas jsonb;
  v_excluidas jsonb;
  v_auditoria jsonb;
  v_registros jsonb;
  v_simulado jsonb;
  v_posicao integer;
  v_numero_original integer;
  v_validos_vistos integer;
  v_total_aplicadas integer;
  v_total integer;
  v_certas integer;
  v_erradas integer;
  v_em_branco integer;
  v_percentual numeric;
  v_tentativa_id text;
  v_caderno_id text;
  v_cadernos_afetados text[] := array[]::text[];
  v_atualizados integer := 0;
begin
  -- O caderno é um snapshot. Removemos o item anulado para que o card passe,
  -- por exemplo, de 10 para 9 questões válidas.
  select coalesce(array_agg(c.id::text), array[]::text[])
  into v_cadernos_afetados
  from public.cadernos_simulados_ia c
  where exists (
    select 1
    from jsonb_array_elements(coalesce(c.dados->'questoes', '[]'::jsonb)) q
    where q->>'id' = p_questao_id::text
  );

  update public.cadernos_simulados_ia c
  set dados = jsonb_set(
        c.dados,
        '{questoes}',
        coalesce(
          (
            select jsonb_agg(q.value order by q.ordinality)
            from jsonb_array_elements(coalesce(c.dados->'questoes', '[]'::jsonb))
              with ordinality as q(value, ordinality)
            where q.value->>'id' <> p_questao_id::text
          ),
          '[]'::jsonb
        ),
        true
      ),
      updated_at = now()
  where exists (
    select 1
    from jsonb_array_elements(coalesce(c.dados->'questoes', '[]'::jsonb)) q
    where q->>'id' = p_questao_id::text
  );

  for v_resultado in
    select r.*
    from public.resultados_simulados_ia r
    where exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(r.dados#>'{auditoria,questoesValidas}') = 'array'
            then r.dados#>'{auditoria,questoesValidas}'
          when jsonb_typeof(r.dados->'questoes') = 'array'
            then r.dados->'questoes'
          else '[]'::jsonb
        end
      ) q
      where q->>'id' = p_questao_id::text
    )
    for update
  loop
    v_dados := coalesce(v_resultado.dados, '{}'::jsonb);
    v_auditoria_existente :=
      case
        when jsonb_typeof(v_dados->'auditoria') = 'object' then v_dados->'auditoria'
        else '{}'::jsonb
      end;

    v_questoes_antes :=
      case
        when jsonb_typeof(v_auditoria_existente->'questoesValidas') = 'array'
          then v_auditoria_existente->'questoesValidas'
        when jsonb_typeof(v_dados->'questoes') = 'array'
          then v_dados->'questoes'
        else '[]'::jsonb
      end;

    select q.ordinality::integer, q.value
    into v_posicao, v_questao_alvo
    from jsonb_array_elements(v_questoes_antes)
      with ordinality as q(value, ordinality)
    where q.value->>'id' = p_questao_id::text
    limit 1;

    if v_posicao is null then
      continue;
    end if;

    v_excluidas :=
      case
        when jsonb_typeof(v_auditoria_existente->'excluidas') = 'array'
          then v_auditoria_existente->'excluidas'
        else '[]'::jsonb
      end;

    v_total_aplicadas :=
      case
        when coalesce(v_auditoria_existente->>'totalAplicadas', '') ~ '^[0-9]+$'
          then (v_auditoria_existente->>'totalAplicadas')::integer
        else jsonb_array_length(v_questoes_antes) + jsonb_array_length(v_excluidas)
      end;

    -- Recupera a numeração original mesmo quando a tentativa já havia passado
    -- por outra auditoria.
    v_numero_original := 0;
    v_validos_vistos := 0;
    while v_validos_vistos < v_posicao loop
      v_numero_original := v_numero_original + 1;
      if not exists (
        select 1
        from jsonb_array_elements(v_excluidas) e
        where coalesce(e->>'numero', '') ~ '^[0-9]+$'
          and (e->>'numero')::integer = v_numero_original
      ) then
        v_validos_vistos := v_validos_vistos + 1;
      end if;
    end loop;

    if not exists (
      select 1
      from jsonb_array_elements(v_excluidas) e
      where e->>'id' = p_questao_id::text
    ) then
      v_excluidas := v_excluidas || jsonb_build_array(
        jsonb_build_object(
          'id', p_questao_id::text,
          'numero', v_numero_original,
          'motivo', coalesce(nullif(btrim(p_motivo), ''), 'Questão anulada após revisão editorial.')
        )
      );
    end if;

    select coalesce(jsonb_agg(q.value order by q.ordinality), '[]'::jsonb)
    into v_questoes_validas
    from jsonb_array_elements(v_questoes_antes)
      with ordinality as q(value, ordinality)
    where q.value->>'id' <> p_questao_id::text;

    v_respostas_antes :=
      case
        when jsonb_typeof(v_auditoria_existente->'respostas') = 'object'
          then v_auditoria_existente->'respostas'
        when jsonb_typeof(v_dados->'respostas') = 'object'
          then v_dados->'respostas'
        else '{}'::jsonb
      end;

    -- Mantém apenas respostas das questões que continuam válidas.
    select coalesce(jsonb_object_agg(r.key, r.value), '{}'::jsonb)
    into v_respostas_validas
    from jsonb_each(v_respostas_antes) r
    where exists (
      select 1
      from jsonb_array_elements(v_questoes_validas) q
      where q->>'id' = r.key
    );

    select
      count(*) filter (
        where v_respostas_validas ? (q->>'id')
          and v_respostas_validas->>(q->>'id') =
            coalesce(q->>'respostaCorreta', q->>'resposta_correta_id')
      )::integer,
      count(*) filter (
        where v_respostas_validas ? (q->>'id')
          and v_respostas_validas->>(q->>'id') <>
            coalesce(q->>'respostaCorreta', q->>'resposta_correta_id')
      )::integer,
      count(*) filter (
        where not (v_respostas_validas ? (q->>'id'))
      )::integer
    into v_certas, v_erradas, v_em_branco
    from jsonb_array_elements(v_questoes_validas) q;

    v_total := jsonb_array_length(v_questoes_validas);
    v_percentual :=
      case when v_total = 0 then 0
           else round((100.0 * v_certas / v_total)::numeric, 2)
      end;
    v_tentativa_id := coalesce(nullif(v_resultado.local_id, ''), v_resultado.id::text);

    -- Recria os registros por assunto para que dashboard, estatísticas e
    -- revisões usem a mesma base já sem a questão anulada.
    with itens as (
      select
        q.ordinality,
        q.value->>'materia' as materia,
        q.value->>'materiaId' as materia_id,
        coalesce(nullif(q.value->>'modulo', ''), 'Geral') as modulo,
        q.value->>'moduloId' as modulo_id,
        q.value->>'assunto' as assunto,
        q.value->>'assuntoId' as assunto_id,
        q.value->>'banca' as banca,
        v_respostas_validas->>(q.value->>'id') as resposta,
        coalesce(q.value->>'respostaCorreta', q.value->>'resposta_correta_id') as gabarito
      from jsonb_array_elements(v_questoes_validas)
        with ordinality as q(value, ordinality)
    ),
    grupos as (
      select
        materia,
        materia_id,
        modulo,
        modulo_id,
        assunto,
        assunto_id,
        (array_agg(banca order by ordinality))[1] as banca,
        min(ordinality) as primeira_ordem,
        count(*) filter (where resposta is not null and resposta = gabarito)::integer as certas,
        count(*) filter (where resposta is not null and resposta <> gabarito)::integer as erradas,
        count(*) filter (where resposta is null)::integer as em_branco
      from itens
      group by materia, materia_id, modulo, modulo_id, assunto, assunto_id
    ),
    ordenados as (
      select
        g.*,
        row_number() over (order by primeira_ordem) - 1 as indice
      from grupos g
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', v_tentativa_id || ':assunto:' || indice,
          'materia', materia,
          'materiaId', materia_id,
          'modulo', modulo,
          'moduloId', modulo_id,
          'assunto', assunto,
          'assuntoId', assunto_id,
          'banca', coalesce(banca, 'Não informada'),
          'certas', certas,
          'erradas', erradas,
          'emBranco', em_branco,
          'minutos', 0,
          'data', v_resultado.data,
          'origem', case when v_dados->>'tipo' = 'simulado' then 'simulado-ia' else 'questoes-ia' end,
          'tentativaId', v_tentativa_id,
          'observacao',
            'Resultado auditado: ' ||
            (certas + erradas + em_branco) ||
            ' questão(ões) válida(s). Itens anulados não entram na nota.'
        )
        order by primeira_ordem
      ),
      '[]'::jsonb
    )
    into v_registros
    from ordenados;

    v_auditoria := v_auditoria_existente || jsonb_build_object(
      'revisadaEm', now(),
      'totalAplicadas', v_total_aplicadas,
      'excluidas', v_excluidas,
      'questoesValidas', v_questoes_validas,
      'respostas', v_respostas_validas,
      'criterio', 'Questões anuladas são excluídas do numerador e do denominador.'
    );

    v_dados := v_dados || jsonb_build_object(
      'total', v_total,
      'registros', v_registros,
      'auditoria', v_auditoria
    );

    if jsonb_typeof(v_dados->'simulado') = 'object' then
      v_simulado := v_dados->'simulado' || jsonb_build_object(
        'certas', v_certas,
        'erradas', v_erradas,
        'emBranco', v_em_branco,
        'anuladas', jsonb_array_length(v_excluidas),
        'totalQuestoes', v_total
      );
      v_dados := jsonb_set(v_dados, '{simulado}', v_simulado, true);
    end if;

    update public.resultados_simulados_ia
    set certas = v_certas,
        erradas = v_erradas,
        em_branco = v_em_branco,
        percentual = v_percentual,
        dados = v_dados
    where id = v_resultado.id;

    v_caderno_id := nullif(v_dados->>'cadernoId', '');
    if v_caderno_id is not null
       and not (v_caderno_id = any(v_cadernos_afetados)) then
      v_cadernos_afetados := array_append(v_cadernos_afetados, v_caderno_id);
    end if;

    v_atualizados := v_atualizados + 1;
  end loop;

  -- O card mostra o resultado da última tentativa; "tentativas" continua
  -- acumulado. Isso evita somar acertos de tentativas diferentes.
  with stats as (
    select
      c.id as caderno_id,
      count(r.id)::integer as tentativas,
      (array_agg(r.certas order by r.data desc))[1]::integer as acertos,
      (array_agg(r.erradas order by r.data desc))[1]::integer as erros,
      (array_agg(r.em_branco order by r.data desc))[1]::integer as em_branco,
      (array_agg(r.percentual order by r.data desc))[1]::numeric as aproveitamento,
      max(r.data) as ultima_tentativa
    from public.cadernos_simulados_ia c
    join public.resultados_simulados_ia r
      on r.user_id = c.user_id
     and r.dados->>'cadernoId' = c.id::text
    where c.id::text = any(v_cadernos_afetados)
    group by c.id
  )
  update public.cadernos_simulados_ia c
  set dados = jsonb_set(
        c.dados,
        '{estatisticas}',
        jsonb_build_object(
          'tentativas', s.tentativas,
          'acertos', s.acertos,
          'erros', s.erros,
          'emBranco', s.em_branco,
          'aproveitamento', s.aproveitamento,
          'ultimaTentativaEm', s.ultima_tentativa
        ),
        true
      ),
      updated_at = now()
  from stats s
  where c.id = s.caderno_id;

  return v_atualizados;
end;
$function$;

revoke all on function private.recalcular_resultados_questao_anulada(uuid, text)
  from public, anon, authenticated;

create or replace function private.auditar_questao_ao_anular()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'pg_temp'
as $function$
begin
  if new.status = 'anulada' and old.status is distinct from 'anulada' then
    perform private.recalcular_resultados_questao_anulada(
      new.id,
      coalesce(new.motivo_status, 'Questão anulada após revisão editorial.')
    );
  end if;
  return new;
end;
$function$;

revoke all on function private.auditar_questao_ao_anular()
  from public, anon, authenticated;

drop trigger if exists questao_catalogo_auditar_anulacao
  on public.questoes_catalogo;

create trigger questao_catalogo_auditar_anulacao
after update of status on public.questoes_catalogo
for each row
when (new.status = 'anulada' and old.status is distinct from 'anulada')
execute function private.auditar_questao_ao_anular();

create or replace function public.moderar_denuncia_questao(
  p_denuncia_id uuid,
  p_acao text,
  p_resposta_admin text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'pg_temp'
as $function$
declare
  v_questao_id uuid;
  v_status_denuncia text;
  v_status_final text;
  v_titulo text;
  v_mensagem text;
begin
  if not public.sou_admin() then
    raise exception 'Acesso administrativo negado.';
  end if;

  if p_acao not in ('restaurar', 'corrigir', 'excluir') then
    raise exception 'Ação de moderação inválida.';
  end if;

  select questao_id, status
  into v_questao_id, v_status_denuncia
  from public.questao_denuncias
  where id = p_denuncia_id
  for update;

  if not found or v_status_denuncia <> 'pendente' then
    raise exception 'A denúncia já foi analisada ou não existe.';
  end if;

  if v_questao_id is null then
    raise exception 'A questão denunciada já não está disponível no catálogo.';
  end if;

  if p_acao = 'restaurar' then
    update public.questoes_catalogo
    set status = 'ativa',
        motivo_status = null,
        revisado_por = auth.uid(),
        revisada_em = now(),
        updated_at = now()
    where id = v_questao_id;
    v_status_final := 'improcedente';
    v_titulo := 'Denúncia analisada';
    v_mensagem := 'A questão foi revisada e continuará disponível no banco.';
  elsif p_acao = 'corrigir' then
    update public.questoes_catalogo
    set status = 'ativa',
        motivo_status = null,
        revisado_por = auth.uid(),
        revisada_em = now(),
        updated_at = now()
    where id = v_questao_id;
    v_status_final := 'corrigida';
    v_titulo := 'Questão corrigida';
    v_mensagem := 'A questão denunciada foi corrigida e voltou ao banco.';
  else
    update public.questoes_catalogo
    set status = 'anulada',
        motivo_status = coalesce(
          nullif(btrim(coalesce(p_resposta_admin, '')), ''),
          'Questão anulada após confirmação da denúncia.'
        ),
        revisado_por = auth.uid(),
        revisada_em = now(),
        updated_at = now()
    where id = v_questao_id;

    v_status_final := 'excluida';
    v_titulo := 'Questão anulada';
    v_mensagem := 'A questão foi anulada e deixou de contar nas notas, inclusive em tentativas anteriores.';
  end if;

  update public.questao_denuncias
  set status = v_status_final,
      resposta_admin = nullif(btrim(coalesce(p_resposta_admin, '')), ''),
      analisada_por = auth.uid(),
      analisada_em = now(),
      updated_at = now()
  where questao_id = v_questao_id
    and status = 'pendente';

  insert into public.notificacoes (user_id, tipo, titulo, mensagem, rota)
  select distinct
    denunciante_id,
    'resultado_denuncia',
    v_titulo,
    v_mensagem,
    '/banco-questoes'
  from public.questao_denuncias
  where questao_id = v_questao_id
    and status = v_status_final;

  update public.notificacoes n
  set lida = true
  where n.questao_denuncia_id in (
    select d.id
    from public.questao_denuncias d
    where d.questao_id = v_questao_id
      and d.status = v_status_final
  );
end;
$function$;

revoke all on function public.moderar_denuncia_questao(uuid, text, text)
  from public, anon;
grant execute on function public.moderar_denuncia_questao(uuid, text, text)
  to authenticated;

comment on function private.recalcular_resultados_questao_anulada(uuid, text) is
  'Remove questão anulada do total válido das tentativas, preserva auditoria e recalcula cards.';
