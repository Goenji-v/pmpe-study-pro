-- Resultado completo, tempo real da tentativa e liberação programada.

drop policy if exists simulados_oficiais_tentativas_leitura on public.simulados_oficiais_tentativas;
create policy simulados_oficiais_tentativas_leitura
on public.simulados_oficiais_tentativas for select to authenticated
using (
  public.sou_admin()
  or exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulados_oficiais_tentativas.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
  or (
    usuario_id = (select auth.uid())
    and (
      not finalizada
      or exists (
        select 1 from public.simulados_oficiais s
        where s.id = simulados_oficiais_tentativas.simulado_id
          and (s.resultado_liberado_em is null or s.resultado_liberado_em <= now())
      )
    )
  )
);

create or replace function public.finalizar_simulado_oficial(
  p_tentativa_id uuid,
  p_respostas jsonb,
  p_minutos_gastos integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_tentativa public.simulados_oficiais_tentativas%rowtype;
  v_simulado public.simulados_oficiais%rowtype;
  v_total integer := 0;
  v_certas integer := 0;
  v_erradas integer := 0;
  v_em_branco integer := 0;
  v_anuladas integer := 0;
  v_minutos integer := 0;
  v_por_materia jsonb;
  v_por_assunto jsonb;
  v_questoes jsonb;
  v_resultado jsonb;
begin
  select * into v_tentativa
  from public.simulados_oficiais_tentativas
  where id = p_tentativa_id and usuario_id = auth.uid()
  for update;

  if not found then raise exception 'Tentativa não encontrada.'; end if;
  select * into v_simulado from public.simulados_oficiais where id=v_tentativa.simulado_id;

  if v_tentativa.finalizada then
    if v_simulado.resultado_liberado_em is not null and v_simulado.resultado_liberado_em > now() then
      return jsonb_build_object('resultadoLiberado',false,'liberarEm',v_simulado.resultado_liberado_em);
    end if;
    return coalesce(v_tentativa.resultado,'{}'::jsonb) || jsonb_build_object('resultadoLiberado',true);
  end if;

  select count(*),
    count(*) filter (where g.anulada),
    count(*) filter (where not g.anulada and upper(coalesce(p_respostas ->> q.numero::text,'')) = upper(g.resposta)),
    count(*) filter (where not g.anulada and p_respostas ? q.numero::text and upper(coalesce(p_respostas ->> q.numero::text,'')) <> upper(g.resposta)),
    count(*) filter (where not g.anulada and not (p_respostas ? q.numero::text))
  into v_total,v_anuladas,v_certas,v_erradas,v_em_branco
  from public.simulados_oficiais_questoes q
  join public.simulados_oficiais_gabaritos g on g.simulado_id=q.simulado_id and g.numero=q.numero
  where q.simulado_id=v_tentativa.simulado_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'materia',x.materia,'total',x.total,'certas',x.certas,'erradas',x.erradas,'emBranco',x.em_branco,
    'percentual',case when x.total=0 then 0 else round((x.certas::numeric/x.total::numeric)*100,2) end
  ) order by x.materia),'[]'::jsonb)
  into v_por_materia
  from (
    select q.materia,
      count(*) filter(where not g.anulada) total,
      count(*) filter(where not g.anulada and upper(coalesce(p_respostas->>q.numero::text,''))=upper(g.resposta)) certas,
      count(*) filter(where not g.anulada and p_respostas ? q.numero::text and upper(coalesce(p_respostas->>q.numero::text,''))<>upper(g.resposta)) erradas,
      count(*) filter(where not g.anulada and not (p_respostas ? q.numero::text)) em_branco
    from public.simulados_oficiais_questoes q
    join public.simulados_oficiais_gabaritos g on g.simulado_id=q.simulado_id and g.numero=q.numero
    where q.simulado_id=v_tentativa.simulado_id
    group by q.materia
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'materia',x.materia,'assunto',x.assunto,'total',x.total,'certas',x.certas,'erradas',x.erradas,'emBranco',x.em_branco,
    'percentual',case when x.total=0 then 0 else round((x.certas::numeric/x.total::numeric)*100,2) end
  ) order by x.materia,x.assunto),'[]'::jsonb)
  into v_por_assunto
  from (
    select q.materia,q.assunto,
      count(*) filter(where not g.anulada) total,
      count(*) filter(where not g.anulada and upper(coalesce(p_respostas->>q.numero::text,''))=upper(g.resposta)) certas,
      count(*) filter(where not g.anulada and p_respostas ? q.numero::text and upper(coalesce(p_respostas->>q.numero::text,''))<>upper(g.resposta)) erradas,
      count(*) filter(where not g.anulada and not (p_respostas ? q.numero::text)) em_branco
    from public.simulados_oficiais_questoes q
    join public.simulados_oficiais_gabaritos g on g.simulado_id=q.simulado_id and g.numero=q.numero
    where q.simulado_id=v_tentativa.simulado_id
    group by q.materia,q.assunto
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'numero',q.numero,'materia',q.materia,'assunto',q.assunto,
    'respostaMarcada',nullif(upper(coalesce(p_respostas->>q.numero::text,'')),''),
    'respostaCorreta',g.resposta,'anulada',g.anulada,
    'correta',case when g.anulada then null else upper(coalesce(p_respostas->>q.numero::text,''))=upper(g.resposta) end,
    'emBranco',not (p_respostas ? q.numero::text)
  ) order by q.ordem),'[]'::jsonb)
  into v_questoes
  from public.simulados_oficiais_questoes q
  join public.simulados_oficiais_gabaritos g on g.simulado_id=q.simulado_id and g.numero=q.numero
  where q.simulado_id=v_tentativa.simulado_id;

  v_minutos := greatest(0,coalesce(
    p_minutos_gastos,
    ceil(extract(epoch from (now()-v_tentativa.iniciada_em))/60.0)::integer
  ));

  v_resultado := jsonb_build_object(
    'total',v_total,'certas',v_certas,'erradas',v_erradas,'emBranco',v_em_branco,'anuladas',v_anuladas,
    'percentual',case when v_total-v_anuladas=0 then 0 else round((v_certas::numeric/(v_total-v_anuladas)::numeric)*100,2) end,
    'porMateria',v_por_materia,'porAssunto',v_por_assunto,'questoes',v_questoes
  );

  update public.simulados_oficiais_tentativas
  set respostas=coalesce(p_respostas,'{}'::jsonb), resultado=v_resultado,
      minutos_gastos=v_minutos, finalizada=true, finalizada_em=now()
  where id=v_tentativa.id;

  if v_simulado.resultado_liberado_em is not null and v_simulado.resultado_liberado_em > now() then
    return jsonb_build_object('resultadoLiberado',false,'liberarEm',v_simulado.resultado_liberado_em);
  end if;
  return v_resultado || jsonb_build_object('resultadoLiberado',true);
end
$$;

revoke all on function public.finalizar_simulado_oficial(uuid,jsonb,integer) from public,anon;
grant execute on function public.finalizar_simulado_oficial(uuid,jsonb,integer) to authenticated;
