create or replace function public.salvar_estado_app_cas(
  p_expected_revision bigint,
  p_estado jsonb
)
returns table(ok boolean, revisao_atual bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rows integer := 0;
  v_revisao bigint := 0;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  update public.configuracoes
     set dados = jsonb_set(
           coalesce(dados, '{}'::jsonb),
           '{appState}',
           p_estado,
           true
         ),
         updated_at = now()
   where user_id = v_uid
     and (
       case
         when coalesce(dados #>> '{appState,syncRevision}', '') ~ '^[0-9]+$'
           then (dados #>> '{appState,syncRevision}')::bigint
         else 0
       end
     ) = greatest(p_expected_revision, 0);

  get diagnostics v_rows = row_count;

  if v_rows = 1 then
    return query
      select true,
             case
               when coalesce(p_estado->>'syncRevision', '') ~ '^[0-9]+$'
                 then (p_estado->>'syncRevision')::bigint
               else greatest(p_expected_revision, 0) + 1
             end;
    return;
  end if;

  if greatest(p_expected_revision, 0) = 0 then
    insert into public.configuracoes (user_id, dados)
    values (
      v_uid,
      jsonb_build_object('appState', p_estado)
    )
    on conflict (user_id) do nothing;

    get diagnostics v_rows = row_count;

    if v_rows = 1 then
      return query
        select true,
               case
                 when coalesce(p_estado->>'syncRevision', '') ~ '^[0-9]+$'
                   then (p_estado->>'syncRevision')::bigint
                 else 1
               end;
      return;
    end if;
  end if;

  select
    case
      when coalesce(c.dados #>> '{appState,syncRevision}', '') ~ '^[0-9]+$'
        then (c.dados #>> '{appState,syncRevision}')::bigint
      else 0
    end
    into v_revisao
    from public.configuracoes c
    where c.user_id = v_uid;

  return query select false, coalesce(v_revisao, 0);
end;
$$;

revoke all on function public.salvar_estado_app_cas(bigint, jsonb) from public;
grant execute on function public.salvar_estado_app_cas(bigint, jsonb) to authenticated;

