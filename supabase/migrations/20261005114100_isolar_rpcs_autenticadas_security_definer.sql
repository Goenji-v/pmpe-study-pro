do $migration$
declare
  r record;
  v_call_args text;
  v_body text;
  v_create text;
  v_volatility text;
begin
  perform set_config('search_path', 'public,pg_catalog', true);

  for r in
    select
      p.oid,
      p.proname,
      pg_get_function_arguments(p.oid) as full_args,
      pg_get_function_identity_arguments(p.oid) as identity_args,
      pg_get_function_result(p.oid) as result_type,
      p.pronargs,
      p.provolatile,
      p.proretset
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and pg_get_function_result(p.oid) <> 'trigger'
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    select coalesce(string_agg('$' || g::text, ',' order by g), '')
      into v_call_args
    from generate_series(1, r.pronargs) as g;

    v_volatility := case r.provolatile
      when 'i' then 'immutable'
      when 's' then 'stable'
      else 'volatile'
    end;

    execute format(
      'alter function public.%I(%s) set schema api_private',
      r.proname,
      r.identity_args
    );

    execute format(
      'revoke execute on function api_private.%I(%s) from public, anon',
      r.proname,
      r.identity_args
    );

    execute format(
      'grant execute on function api_private.%I(%s) to authenticated, service_role',
      r.proname,
      r.identity_args
    );

    if r.proretset or r.result_type like 'TABLE(%' then
      v_body := format(
        'select * from api_private.%I(%s);',
        r.proname,
        v_call_args
      );
    else
      v_body := format(
        'select api_private.%I(%s);',
        r.proname,
        v_call_args
      );
    end if;

    v_create := format(
      'create function public.%I(%s) returns %s language sql %s security invoker set search_path = '''' as %L',
      r.proname,
      r.full_args,
      r.result_type,
      v_volatility,
      v_body
    );

    execute v_create;

    execute format(
      'revoke execute on function public.%I(%s) from public, anon',
      r.proname,
      r.identity_args
    );

    execute format(
      'grant execute on function public.%I(%s) to authenticated, service_role',
      r.proname,
      r.identity_args
    );
  end loop;
end
$migration$;

