-- Catálogo global e curado do Study Pro.
-- Usuários autenticados enxergam somente questões ativas.
-- Importação, revisão e publicação são exclusivas de administradores.

create table if not exists public.questoes_catalogo (
  id uuid primary key default gen_random_uuid(),
  concurso_alvo text not null default 'PMPE',
  edital_alvo text not null default 'PMPE 2024',
  concurso_origem text,
  cargo_origem text,
  ano_origem integer,
  banca text not null default '',
  numero_original integer,
  materia_id text,
  materia text not null default '',
  modulo_id text,
  modulo text,
  assunto_id text,
  assunto text not null default '',
  subassunto text,
  dificuldade text not null default 'media'
    check (dificuldade in ('facil', 'media', 'dificil')),
  enunciado text not null,
  alternativas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(alternativas) = 'array'),
  resposta_correta_id text,
  explicacao text,
  status text not null default 'pendente'
    check (status in ('pendente', 'ativa', 'anulada', 'desatualizada', 'duvidosa', 'arquivada')),
  compatibilidade_edital text not null default 'incerta'
    check (compatibilidade_edital in ('direta', 'implicita', 'relacionada', 'fora', 'incerta')),
  confianca_classificacao text not null default 'baixa'
    check (confianca_classificacao in ('alta', 'media', 'baixa')),
  norma text,
  dispositivo text,
  motivo_status text,
  fonte_nome text,
  origem text not null default 'prova_oficial'
    check (origem in ('prova_oficial', 'ia')),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  revisado_por uuid references auth.users(id) on delete set null,
  revisada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questao_ativa_compativel_check check (
    status <> 'ativa'
    or compatibilidade_edital in ('direta', 'implicita')
  ),
  constraint questao_ativa_com_gabarito_check check (
    status <> 'ativa'
    or resposta_correta_id in ('A', 'B', 'C', 'D', 'E')
  ),
  constraint questao_ativa_classificada_check check (
    status <> 'ativa'
    or (btrim(materia) <> '' and btrim(assunto) <> '')
  )
);

create index if not exists questoes_catalogo_publicadas_idx
  on public.questoes_catalogo (concurso_alvo, status, compatibilidade_edital);

create index if not exists questoes_catalogo_curadoria_idx
  on public.questoes_catalogo (status, created_at desc);

create index if not exists questoes_catalogo_classificacao_idx
  on public.questoes_catalogo (materia, assunto, dificuldade);

create index if not exists questoes_catalogo_criado_por_idx
  on public.questoes_catalogo (criado_por);

create index if not exists questoes_catalogo_revisado_por_idx
  on public.questoes_catalogo (revisado_por);

create unique index if not exists questoes_catalogo_prova_oficial_unica_idx
  on public.questoes_catalogo (
    lower(btrim(concurso_alvo)),
    lower(btrim(edital_alvo)),
    lower(btrim(coalesce(concurso_origem, ''))),
    lower(btrim(coalesce(cargo_origem, ''))),
    coalesce(ano_origem, 0),
    lower(btrim(banca)),
    numero_original
  )
  where origem = 'prova_oficial' and numero_original is not null;

alter table public.questoes_catalogo enable row level security;

grant select, insert, update, delete on table public.questoes_catalogo to authenticated;
revoke all on table public.questoes_catalogo from anon;

drop policy if exists "questoes_catalogo_leitura" on public.questoes_catalogo;
create policy "questoes_catalogo_leitura"
on public.questoes_catalogo
for select
to authenticated
using (
  status = 'ativa'
  or (select public.sou_admin())
);

drop policy if exists "questoes_catalogo_admin_inserir" on public.questoes_catalogo;
create policy "questoes_catalogo_admin_inserir"
on public.questoes_catalogo
for insert
to authenticated
with check ((select public.sou_admin()));

drop policy if exists "questoes_catalogo_admin_atualizar" on public.questoes_catalogo;
create policy "questoes_catalogo_admin_atualizar"
on public.questoes_catalogo
for update
to authenticated
using ((select public.sou_admin()))
with check ((select public.sou_admin()));

drop policy if exists "questoes_catalogo_admin_excluir" on public.questoes_catalogo;
create policy "questoes_catalogo_admin_excluir"
on public.questoes_catalogo
for delete
to authenticated
using ((select public.sou_admin()));

comment on table public.questoes_catalogo is
  'Banco global de questões oficiais com triagem por IA e aprovação humana.';
