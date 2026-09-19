do $$
begin
  if to_regprocedure('public.dashboard_meu_parceiro_legacy_privado()') is null then
    alter function public.dashboard_meu_parceiro()
      rename to dashboard_meu_parceiro_legacy_privado;
  end if;
end
$$;

create or replace function public.dashboard_meu_parceiro()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  v_result := public.dashboard_meu_parceiro_legacy_privado();

  return coalesce(v_result, '{}'::jsonb)
    - 'alunos_atencao'
    - 'ranking';
end;
$$;

revoke all on function public.dashboard_meu_parceiro_legacy_privado()
  from public, anon, authenticated;
grant execute on function public.dashboard_meu_parceiro_legacy_privado()
  to service_role;

revoke all on function public.dashboard_meu_parceiro()
  from public, anon;
grant execute on function public.dashboard_meu_parceiro()
  to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.painel_cursos_meu_parceiro_legacy_privado()') is null then
    alter function public.painel_cursos_meu_parceiro()
      rename to painel_cursos_meu_parceiro_legacy_privado;
  end if;
end
$$;

create or replace function public.painel_cursos_meu_parceiro()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_cursos jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  v_result := public.painel_cursos_meu_parceiro_legacy_privado();

  select coalesce(
    jsonb_agg(
      (curso - 'progresso')
      || jsonb_build_object(
        'resumo_progresso',
        jsonb_build_object(
          'alunos_liberados',
          coalesce(
            jsonb_array_length(
              case
                when jsonb_typeof(curso->'progresso') = 'array'
                  then curso->'progresso'
                else '[]'::jsonb
              end
            ),
            0
          ),
          'alunos_com_atividade',
          coalesce((
            select count(*)::int
            from jsonb_array_elements(
              case
                when jsonb_typeof(curso->'progresso') = 'array'
                  then curso->'progresso'
                else '[]'::jsonb
              end
            ) p
            where coalesce((p->>'percentual')::numeric, 0) > 0
          ), 0),
          'media_percentual',
          coalesce((
            select round(avg(coalesce((p->>'percentual')::numeric, 0)), 1)
            from jsonb_array_elements(
              case
                when jsonb_typeof(curso->'progresso') = 'array'
                  then curso->'progresso'
                else '[]'::jsonb
              end
            ) p
          ), 0),
          'conclusoes_total',
          coalesce((
            select sum(coalesce((p->>'concluidas')::int, 0))::int
            from jsonb_array_elements(
              case
                when jsonb_typeof(curso->'progresso') = 'array'
                  then curso->'progresso'
                else '[]'::jsonb
              end
            ) p
          ), 0),
          'aulas_total',
          coalesce((
            select max(coalesce((p->>'total_aulas')::int, 0))::int
            from jsonb_array_elements(
              case
                when jsonb_typeof(curso->'progresso') = 'array'
                  then curso->'progresso'
                else '[]'::jsonb
              end
            ) p
          ), 0)
        )
      )
      order by ord
    ),
    '[]'::jsonb
  )
  into v_cursos
  from jsonb_array_elements(
    case
      when jsonb_typeof(v_result->'cursos') = 'array'
        then v_result->'cursos'
      else '[]'::jsonb
    end
  ) with ordinality as itens(curso, ord);

  return jsonb_set(
    coalesce(v_result, '{}'::jsonb),
    '{cursos}',
    coalesce(v_cursos, '[]'::jsonb),
    true
  );
end;
$$;

revoke all on function public.painel_cursos_meu_parceiro_legacy_privado()
  from public, anon, authenticated;
grant execute on function public.painel_cursos_meu_parceiro_legacy_privado()
  to service_role;

revoke all on function public.painel_cursos_meu_parceiro()
  from public, anon;
grant execute on function public.painel_cursos_meu_parceiro()
  to authenticated, service_role;
