-- Simulados oficiais: prova importada pelo administrador, questões sem gabarito público,
-- tentativas individuais e correção server-side.

create table if not exists public.simulados_oficiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  concurso_alvo text not null default 'PMPE',
  edital_alvo text,
  banca text not null,
  data_prova date,
  duracao_minutos integer not null default 240 check (duracao_minutos between 1 and 1440),
  total_questoes integer not null default 0 check (total_questoes between 1 and 300),
  status text not null default 'rascunho' check (status in ('rascunho','publicado','encerrado')),
  fonte_prova_nome text,
  fonte_gabarito_nome text,
  criado_por uuid not null references auth.users(id) on delete restrict default auth.uid(),
  criado_em timestamptz not null default now(),
  publicado_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.simulados_oficiais_questoes (
  id uuid primary key default gen_random_uuid(),
  simulado_id uuid not null references public.simulados_oficiais(id) on delete cascade,
  numero integer not null check (numero between 1 and 300),
  materia text not null,
  materia_id text,
  modulo text,
  modulo_id text,
  assunto text not null,
  assunto_id text,
  subassunto text,
  dificuldade text not null default 'media' check (dificuldade in ('facil','media','dificil')),
  enunciado text not null,
  alternativas jsonb not null check (jsonb_typeof(alternativas) = 'array'),
  explicacao text,
  ordem integer not null,
  criado_em timestamptz not null default now(),
  unique (simulado_id, numero)
);

-- Gabarito separado: nunca é entregue pela leitura normal do aluno.
create table if not exists public.simulados_oficiais_gabaritos (
  simulado_id uuid not null references public.simulados_oficiais(id) on delete cascade,
  numero integer not null check (numero between 1 and 300),
  resposta text not null check (resposta in ('A','B','C','D','E')),
  anulada boolean not null default false,
  primary key (simulado_id, numero)
);

create table if not exists public.simulados_oficiais_tentativas (
  id uuid primary key default gen_random_uuid(),
  simulado_id uuid not null references public.simulados_oficiais(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  numero_tentativa integer not null default 1 check (numero_tentativa >= 1),
  conta_ranking boolean not null default false,
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  minutos_gastos integer check (minutos_gastos is null or minutos_gastos >= 0),
  respostas jsonb not null default '{}'::jsonb check (jsonb_typeof(respostas) = 'object'),
  resultado jsonb,
  finalizada boolean not null default false,
  unique (simulado_id, usuario_id, numero_tentativa)
);

create index if not exists simulados_oficiais_publicados_idx
  on public.simulados_oficiais (status, concurso_alvo, data_prova desc);
create index if not exists simulados_oficiais_questoes_simulado_idx
  on public.simulados_oficiais_questoes (simulado_id, ordem);
create index if not exists simulados_oficiais_tentativas_usuario_idx
  on public.simulados_oficiais_tentativas (usuario_id, simulado_id, iniciada_em desc);
create unique index if not exists simulados_oficiais_primeira_oficial_idx
  on public.simulados_oficiais_tentativas (simulado_id, usuario_id)
  where conta_ranking = true;

alter table public.simulados_oficiais enable row level security;
alter table public.simulados_oficiais_questoes enable row level security;
alter table public.simulados_oficiais_gabaritos enable row level security;
alter table public.simulados_oficiais_tentativas enable row level security;

grant select on public.simulados_oficiais to authenticated;
grant select on public.simulados_oficiais_questoes to authenticated;
grant select, insert, update on public.simulados_oficiais_tentativas to authenticated;
revoke all on public.simulados_oficiais_gabaritos from authenticated;

drop policy if exists simulados_oficiais_leitura on public.simulados_oficiais;
create policy simulados_oficiais_leitura on public.simulados_oficiais
for select to authenticated
using (status = 'publicado' or (select public.sou_admin()));

drop policy if exists simulados_oficiais_admin_insert on public.simulados_oficiais;
create policy simulados_oficiais_admin_insert on public.simulados_oficiais
for insert to authenticated with check ((select public.sou_admin()));

drop policy if exists simulados_oficiais_admin_update on public.simulados_oficiais;
create policy simulados_oficiais_admin_update on public.simulados_oficiais
for update to authenticated using ((select public.sou_admin())) with check ((select public.sou_admin()));

drop policy if exists simulados_oficiais_admin_delete on public.simulados_oficiais;
create policy simulados_oficiais_admin_delete on public.simulados_oficiais
for delete to authenticated using ((select public.sou_admin()));

drop policy if exists simulados_oficiais_questoes_leitura on public.simulados_oficiais_questoes;
create policy simulados_oficiais_questoes_leitura on public.simulados_oficiais_questoes
for select to authenticated
using (
  exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulado_id
      and (s.status = 'publicado' or (select public.sou_admin()))
  )
);

drop policy if exists simulados_oficiais_questoes_admin_insert on public.simulados_oficiais_questoes;
create policy simulados_oficiais_questoes_admin_insert on public.simulados_oficiais_questoes
for insert to authenticated with check ((select public.sou_admin()));

drop policy if exists simulados_oficiais_questoes_admin_update on public.simulados_oficiais_questoes;
create policy simulados_oficiais_questoes_admin_update on public.simulados_oficiais_questoes
for update to authenticated using ((select public.sou_admin())) with check ((select public.sou_admin()));

drop policy if exists simulados_oficiais_questoes_admin_delete on public.simulados_oficiais_questoes;
create policy simulados_oficiais_questoes_admin_delete on public.simulados_oficiais_questoes
for delete to authenticated using ((select public.sou_admin()));

drop policy if exists simulados_oficiais_tentativas_leitura on public.simulados_oficiais_tentativas;
create policy simulados_oficiais_tentativas_leitura on public.simulados_oficiais_tentativas
for select to authenticated
using (usuario_id = auth.uid() or (select public.sou_admin()));

drop policy if exists simulados_oficiais_tentativas_inserir on public.simulados_oficiais_tentativas;
create policy simulados_oficiais_tentativas_inserir on public.simulados_oficiais_tentativas
for insert to authenticated
with check (
  usuario_id = auth.uid()
  and exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulado_id and s.status = 'publicado'
  )
);

drop policy if exists simulados_oficiais_tentativas_atualizar on public.simulados_oficiais_tentativas;
create policy simulados_oficiais_tentativas_atualizar on public.simulados_oficiais_tentativas
for update to authenticated
using (usuario_id = auth.uid() or (select public.sou_admin()))
with check (usuario_id = auth.uid() or (select public.sou_admin()));

-- Trigger que garante: somente a primeira tentativa de cada aluno pode contar para ranking.
create or replace function public.definir_primeira_tentativa_simulado_oficial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quantidade integer;
begin
  select count(*) into quantidade
  from public.simulados_oficiais_tentativas
  where simulado_id = new.simulado_id
    and usuario_id = new.usuario_id;

  new.numero_tentativa := quantidade + 1;
  new.conta_ranking := (quantidade = 0);
  return new;
end;
$$;

drop trigger if exists trg_primeira_tentativa_simulado_oficial on public.simulados_oficiais_tentativas;
create trigger trg_primeira_tentativa_simulado_oficial
before insert on public.simulados_oficiais_tentativas
for each row execute function public.definir_primeira_tentativa_simulado_oficial();

-- RPC de correção. O cliente envia somente respostas; o gabarito permanece privado.
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
  v_resultado jsonb;
begin
  select * into v_tentativa
  from public.simulados_oficiais_tentativas
  where id = p_tentativa_id
    and usuario_id = auth.uid()
  for update;

  if not found then
    raise exception 'Tentativa não encontrada.';
  end if;
  if v_tentativa.finalizada then
    return coalesce(v_tentativa.resultado, '{}'::jsonb);
  end if;

  select
    count(*),
    count(*) filter (where g.anulada),
    count(*) filter (where not g.anulada and upper(coalesce(p_respostas ->> q.numero::text, '')) = g.resposta),
    count(*) filter (where not g.anulada and p_respostas ? q.numero::text and upper(coalesce(p_respostas ->> q.numero::text, '')) <> g.resposta),
    count(*) filter (where not g.anulada and not (p_respostas ? q.numero::text))
  into v_total, v_anuladas, v_certas, v_erradas, v_em_branco
  from public.simulados_oficiais_questoes q
  join public.simulados_oficiais_gabaritos g
    on g.simulado_id = q.simulado_id and g.numero = q.numero
  where q.simulado_id = v_tentativa.simulado_id;

  v_resultado := jsonb_build_object(
    'total', v_total,
    'certas', v_certas,
    'erradas', v_erradas,
    'emBranco', v_em_branco,
    'anuladas', v_anuladas,
    'percentual', case when v_total - v_anuladas = 0 then 0 else round((v_certas::numeric / (v_total - v_anuladas)::numeric) * 100, 2) end
  );

  update public.simulados_oficiais_tentativas
  set respostas = coalesce(p_respostas, '{}'::jsonb),
      resultado = v_resultado,
      minutos_gastos = greatest(0, p_minutos_gastos),
      finalizada = true,
      finalizada_em = now()
  where id = v_tentativa.id;

  return v_resultado;
end;
$$;

grant execute on function public.finalizar_simulado_oficial(uuid, jsonb, integer) to authenticated;

comment on table public.simulados_oficiais is 'Provas oficiais publicadas por administradores para os alunos do concurso.';
comment on table public.simulados_oficiais_gabaritos is 'Gabaritos privados usados pela RPC de correção server-side.';
