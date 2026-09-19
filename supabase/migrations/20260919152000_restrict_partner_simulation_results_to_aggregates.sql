do $$
begin
  if to_regprocedure('public.painel_simulado_meu_parceiro_legacy_privado(uuid)') is null then
    alter function public.painel_simulado_meu_parceiro(uuid)
      rename to painel_simulado_meu_parceiro_legacy_privado;
  end if;
end
$$;

create or replace function public.painel_simulado_meu_parceiro(
  p_simulado_id uuid
)
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

  v_result :=
    public.painel_simulado_meu_parceiro_legacy_privado(
      p_simulado_id
    );

  return coalesce(v_result, '{}'::jsonb)
    - 'ranking';
end;
$$;

revoke all on function
  public.painel_simulado_meu_parceiro_legacy_privado(uuid)
  from public, anon, authenticated;
grant execute on function
  public.painel_simulado_meu_parceiro_legacy_privado(uuid)
  to service_role;

revoke all on function
  public.painel_simulado_meu_parceiro(uuid)
  from public, anon;
grant execute on function
  public.painel_simulado_meu_parceiro(uuid)
  to authenticated, service_role;

drop policy if exists simulados_oficiais_tentativas_leitura
  on public.simulados_oficiais_tentativas;

create policy simulados_oficiais_tentativas_leitura
on public.simulados_oficiais_tentativas
for select
to authenticated
using (
  public.sou_admin()
  or (
    usuario_id = (select auth.uid())
    and (
      not finalizada
      or exists (
        select 1
        from public.simulados_oficiais s
        where s.id = simulados_oficiais_tentativas.simulado_id
          and (
            s.resultado_liberado_em is null
            or s.resultado_liberado_em <= now()
          )
      )
    )
  )
);

drop policy if exists integridade_leitura
  on public.simulado_integridade_eventos;

create policy integridade_leitura
on public.simulado_integridade_eventos
for select
to authenticated
using (
  usuario_id = (select auth.uid())
  or public.sou_admin()
);
