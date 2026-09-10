-- V2 dos simulados oficiais.
-- Execute DEPOIS das migrations já existentes:
-- 1) SIMULADOS_OFICIAIS.sql
-- 2) SIMULADOS_OFICIAIS_CORRECAO.sql
-- 3) SIMULADOS_OFICIAIS_SEGURANCA.sql
-- Esta migration é idempotente.

alter table public.simulados_oficiais
  add column if not exists prova_storage_path text,
  add column if not exists gabarito_storage_path text;

-- O gabarito continua privado e sem SELECT para alunos.
revoke select on public.simulados_oficiais_gabaritos from authenticated;
revoke insert, update, delete on public.simulados_oficiais_tentativas from authenticated;

drop policy if exists simulados_oficiais_tentativas_inserir on public.simulados_oficiais_tentativas;
drop policy if exists simulados_oficiais_tentativas_atualizar on public.simulados_oficiais_tentativas;

-- Bucket privado para os PDFs originais.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'simulados-oficiais',
  'simulados-oficiais',
  false,
  26214400,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = array['application/pdf']::text[];

-- Limpa policies anteriores do bucket para evitar permissões duplicadas.
drop policy if exists "Admins can manage official simulation source files" on storage.objects;
drop policy if exists "Admins can read official simulation source files" on storage.objects;
drop policy if exists "Admins can insert official simulation source files" on storage.objects;
drop policy if exists "Admins can update official simulation source files" on storage.objects;
drop policy if exists "Admins can delete official simulation source files" on storage.objects;

create policy "Admins can read official simulation source files"
on storage.objects for select to authenticated
using (
  bucket_id = 'simulados-oficiais'
  and (select public.sou_admin())
);

create policy "Admins can insert official simulation source files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'simulados-oficiais'
  and (select public.sou_admin())
);

create policy "Admins can update official simulation source files"
on storage.objects for update to authenticated
using (
  bucket_id = 'simulados-oficiais'
  and (select public.sou_admin())
)
with check (
  bucket_id = 'simulados-oficiais'
  and (select public.sou_admin())
);

create policy "Admins can delete official simulation source files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'simulados-oficiais'
  and (select public.sou_admin())
);

-- Iniciar é idempotente: recarregar a página devolve a tentativa aberta em vez
-- de criar uma nova tentativa. O primeiro início continua sendo a tentativa
-- oficial para ranking; as seguintes ficam como treinamento.
create or replace function public.iniciar_simulado_oficial(p_simulado_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existente public.simulados_oficiais_tentativas%rowtype;
  v_id uuid;
  v_numero integer;
  v_ranking boolean;
  v_inicio timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.simulados_oficiais
    where id = p_simulado_id
      and status = 'publicado'
  ) then
    raise exception 'Simulado não encontrado ou não publicado.';
  end if;

  select * into v_existente
  from public.simulados_oficiais_tentativas
  where simulado_id = p_simulado_id
    and usuario_id = auth.uid()
    and not finalizada
  order by iniciada_em desc
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existente.id,
      'numero_tentativa', v_existente.numero_tentativa,
      'conta_ranking', v_existente.conta_ranking,
      'iniciada_em', v_existente.iniciada_em
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_simulado_id::text || ':' || auth.uid()::text, 0)
  );

  select * into v_existente
  from public.simulados_oficiais_tentativas
  where simulado_id = p_simulado_id
    and usuario_id = auth.uid()
    and not finalizada
  order by iniciada_em desc
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existente.id,
      'numero_tentativa', v_existente.numero_tentativa,
      'conta_ranking', v_existente.conta_ranking,
      'iniciada_em', v_existente.iniciada_em
    );
  end if;

  select coalesce(max(numero_tentativa), 0) + 1
  into v_numero
  from public.simulados_oficiais_tentativas
  where simulado_id = p_simulado_id
    and usuario_id = auth.uid();

  v_ranking := v_numero = 1;

  insert into public.simulados_oficiais_tentativas (
    simulado_id,
    usuario_id,
    numero_tentativa,
    conta_ranking
  )
  values (
    p_simulado_id,
    auth.uid(),
    v_numero,
    v_ranking
  )
  returning id, iniciada_em into v_id, v_inicio;

  return jsonb_build_object(
    'id', v_id,
    'numero_tentativa', v_numero,
    'conta_ranking', v_ranking,
    'iniciada_em', v_inicio
  );
end;
$$;

revoke execute on function public.iniciar_simulado_oficial(uuid) from public;
grant execute on function public.iniciar_simulado_oficial(uuid) to authenticated;

-- Correção server-side. O cliente nunca recebe o gabarito.
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
  v_simulado public.simulados_oficiais%rowtype;
  v_total integer := 0;
  v_certas integer := 0;
  v_erradas integer := 0;
  v_em_branco integer := 0;
  v_anuladas integer := 0;
  v_por_materia jsonb := '[]'::jsonb;
  v_por_assunto jsonb := '[]'::jsonb;
  v_questoes jsonb := '[]'::jsonb;
  v_resultado jsonb;
  v_minutos integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select t.* into v_tentativa
  from public.simulados_oficiais_tentativas t
  where t.id = p_tentativa_id
    and t.usuario_id = auth.uid()
  for update;

  if not found then
    raise exception 'Tentativa não encontrada.';
  end if;

  if v_tentativa.finalizada then
    return coalesce(v_tentativa.resultado, '{}'::jsonb);
  end if;

  select * into v_simulado
  from public.simulados_oficiais
  where id = v_tentativa.simulado_id;

  if not found then
    raise exception 'Simulado da tentativa não encontrado.';
  end if;

  select
    count(*)::integer,
    count(*) filter (where g.anulada)::integer,
    count(*) filter (
      where not g.anulada
        and upper(coalesce(p_respostas ->> q.numero::text, '')) = g.resposta
    )::integer,
    count(*) filter (
      where not g.anulada
        and p_respostas ? q.numero::text
        and upper(coalesce(p_respostas ->> q.numero::text, '')) <> g.resposta
    )::integer,
    count(*) filter (
      where not g.anulada
        and not (p_respostas ? q.numero::text)
    )::integer
  into v_total, v_anuladas, v_certas, v_erradas, v_em_branco
  from public.simulados_oficiais_questoes q
  join public.simulados_oficiais_gabaritos g
    on g.simulado_id = q.simulado_id
   and g.numero = q.numero
  where q.simulado_id = v_tentativa.simulado_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'materia', x.materia,
    'total', x.total,
    'certas', x.certas,
    'erradas', x.erradas,
    'emBranco', x.em_branco,
    'percentual', case when x.total = 0 then 0 else round((x.certas::numeric / x.total::numeric) * 100, 2) end
  ) order by x.materia), '[]'::jsonb)
  into v_por_materia
  from (
    select
      q.materia,
      count(*) filter (where not g.anulada)::integer as total,
      count(*) filter (
        where not g.anulada
          and upper(coalesce(p_respostas ->> q.numero::text, '')) = g.resposta
      )::integer as certas,
      count(*) filter (
        where not g.anulada
          and p_respostas ? q.numero::text
          and upper(coalesce(p_respostas ->> q.numero::text, '')) <> g.resposta
      )::integer as erradas,
      count(*) filter (
        where not g.anulada
          and not (p_respostas ? q.numero::text)
      )::integer as em_branco
    from public.simulados_oficiais_questoes q
    join public.simulados_oficiais_gabaritos g
      on g.simulado_id = q.simulado_id
     and g.numero = q.numero
    where q.simulado_id = v_tentativa.simulado_id
    group by q.materia
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'materia', x.materia,
    'assunto', x.assunto,
    'total', x.total,
    'certas', x.certas,
    'erradas', x.erradas,
    'emBranco', x.em_branco,
    'percentual', case when x.total = 0 then 0 else round((x.certas::numeric / x.total::numeric) * 100, 2) end
  ) order by x.materia, x.assunto), '[]'::jsonb)
  into v_por_assunto
  from (
    select
      q.materia,
      q.assunto,
      count(*) filter (where not g.anulada)::integer as total,
      count(*) filter (
        where not g.anulada
          and upper(coalesce(p_respostas ->> q.numero::text, '')) = g.resposta
      )::integer as certas,
      count(*) filter (
        where not g.anulada
          and p_respostas ? q.numero::text
          and upper(coalesce(p_respostas ->> q.numero::text, '')) <> g.resposta
      )::integer as erradas,
      count(*) filter (
        where not g.anulada
          and not (p_respostas ? q.numero::text)
      )::integer as em_branco
    from public.simulados_oficiais_questoes q
    join public.simulados_oficiais_gabaritos g
      on g.simulado_id = q.simulado_id
     and g.numero = q.numero
    where q.simulado_id = v_tentativa.simulado_id
    group by q.materia, q.assunto
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'numero', q.numero,
    'materia', q.materia,
    'assunto', q.assunto,
    'respostaMarcada', nullif(upper(coalesce(p_respostas ->> q.numero::text, '')), ''),
    'respostaCorreta', g.resposta,
    'anulada', g.anulada,
    'correta', case when g.anulada then null else upper(coalesce(p_respostas ->> q.numero::text, '')) = g.resposta end,
    'emBranco', case when g.anulada then false else not (p_respostas ? q.numero::text) end
  ) order by q.numero), '[]'::jsonb)
  into v_questoes
  from public.simulados_oficiais_questoes q
  join public.simulados_oficiais_gabaritos g
    on g.simulado_id = q.simulado_id
   and g.numero = q.numero
  where q.simulado_id = v_tentativa.simulado_id;

  v_minutos := least(
    v_simulado.duracao_minutos,
    greatest(0, floor(extract(epoch from (now() - v_tentativa.iniciada_em)) / 60)::integer)
  );

  v_resultado := jsonb_build_object(
    'total', v_total,
    'certas', v_certas,
    'erradas', v_erradas,
    'emBranco', v_em_branco,
    'anuladas', v_anuladas,
    'percentual', case when v_total - v_anuladas = 0 then 0 else round((v_certas::numeric / (v_total - v_anuladas)::numeric) * 100, 2) end,
    'porMateria', v_por_materia,
    'porAssunto', v_por_assunto,
    'questoes', v_questoes
  );

  update public.simulados_oficiais_tentativas
  set respostas = coalesce(p_respostas, '{}'::jsonb),
      resultado = v_resultado,
      minutos_gastos = v_minutos,
      finalizada = true,
      finalizada_em = now()
  where id = v_tentativa.id;

  return v_resultado;
end;
$$;

revoke execute on function public.finalizar_simulado_oficial(uuid, jsonb, integer) from public;
grant execute on function public.finalizar_simulado_oficial(uuid, jsonb, integer) to authenticated;

comment on column public.simulados_oficiais.prova_storage_path is 'Caminho privado do PDF da prova original.';
comment on column public.simulados_oficiais.gabarito_storage_path is 'Caminho privado do PDF do gabarito original.';
