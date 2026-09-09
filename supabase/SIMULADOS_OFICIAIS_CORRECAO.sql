-- Execute depois de SIMULADOS_OFICIAIS.sql.
-- O gabarito continua invisível para alunos: somente administradores recebem INSERT/UPDATE/DELETE.
grant insert, update, delete on public.simulados_oficiais_gabaritos to authenticated;

drop policy if exists simulados_oficiais_gabaritos_admin_insert on public.simulados_oficiais_gabaritos;
create policy simulados_oficiais_gabaritos_admin_insert on public.simulados_oficiais_gabaritos
for insert to authenticated with check ((select public.sou_admin()));

drop policy if exists simulados_oficiais_gabaritos_admin_update on public.simulados_oficiais_gabaritos;
create policy simulados_oficiais_gabaritos_admin_update on public.simulados_oficiais_gabaritos
for update to authenticated using ((select public.sou_admin())) with check ((select public.sou_admin()));

drop policy if exists simulados_oficiais_gabaritos_admin_delete on public.simulados_oficiais_gabaritos;
create policy simulados_oficiais_gabaritos_admin_delete on public.simulados_oficiais_gabaritos
for delete to authenticated using ((select public.sou_admin()));

create or replace function public.finalizar_simulado_oficial(
  p_tentativa_id uuid,
  p_respostas jsonb,
  p_minutos_gastos integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tentativa public.simulados_oficiais_tentativas%rowtype;
  v_total integer := 0;
  v_certas integer := 0;
  v_erradas integer := 0;
  v_em_branco integer := 0;
  v_anuladas integer := 0;
  v_por_materia jsonb;
  v_resultado jsonb;
begin
  select * into v_tentativa from public.simulados_oficiais_tentativas
  where id = p_tentativa_id and usuario_id = auth.uid() for update;
  if not found then raise exception 'Tentativa não encontrada.'; end if;
  if v_tentativa.finalizada then return coalesce(v_tentativa.resultado, '{}'::jsonb); end if;

  select count(*), count(*) filter (where g.anulada),
    count(*) filter (where not g.anulada and upper(coalesce(p_respostas ->> q.numero::text, '')) = g.resposta),
    count(*) filter (where not g.anulada and p_respostas ? q.numero::text and upper(coalesce(p_respostas ->> q.numero::text, '')) <> g.resposta),
    count(*) filter (where not g.anulada and not (p_respostas ? q.numero::text))
  into v_total, v_anuladas, v_certas, v_erradas, v_em_branco
  from public.simulados_oficiais_questoes q
  join public.simulados_oficiais_gabaritos g on g.simulado_id=q.simulado_id and g.numero=q.numero
  where q.simulado_id=v_tentativa.simulado_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'materia', x.materia, 'total', x.total, 'certas', x.certas, 'erradas', x.erradas,
    'emBranco', x.em_branco,
    'percentual', case when x.total=0 then 0 else round((x.certas::numeric/x.total::numeric)*100,2) end
  ) order by x.materia), '[]'::jsonb)
  into v_por_materia
  from (
    select q.materia,
      count(*) filter (where not g.anulada) as total,
      count(*) filter (where not g.anulada and upper(coalesce(p_respostas ->> q.numero::text,''))=g.resposta) as certas,
      count(*) filter (where not g.anulada and p_respostas ? q.numero::text and upper(coalesce(p_respostas ->> q.numero::text,''))<>g.resposta) as erradas,
      count(*) filter (where not g.anulada and not (p_respostas ? q.numero::text)) as em_branco
    from public.simulados_oficiais_questoes q
    join public.simulados_oficiais_gabaritos g on g.simulado_id=q.simulado_id and g.numero=q.numero
    where q.simulado_id=v_tentativa.simulado_id
    group by q.materia
  ) x;

  v_resultado := jsonb_build_object(
    'total',v_total,'certas',v_certas,'erradas',v_erradas,'emBranco',v_em_branco,'anuladas',v_anuladas,
    'percentual',case when v_total-v_anuladas=0 then 0 else round((v_certas::numeric/(v_total-v_anuladas)::numeric)*100,2) end,
    'porMateria',v_por_materia
  );

  update public.simulados_oficiais_tentativas set respostas=coalesce(p_respostas,'{}'::jsonb),resultado=v_resultado,
    minutos_gastos=greatest(0,p_minutos_gastos),finalizada=true,finalizada_em=now() where id=v_tentativa.id;
  return v_resultado;
end;
$$;

grant execute on function public.finalizar_simulado_oficial(uuid,jsonb,integer) to authenticated;
