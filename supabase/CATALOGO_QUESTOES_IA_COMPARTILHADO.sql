-- Reutilizacao segura de questoes geradas por IA.
-- O catalogo e compartilhado; o historico de respostas permanece privado.

alter table public.questoes_catalogo
  add column if not exists fingerprint text,
  add column if not exists materia_chave text,
  add column if not exists assunto_chave text,
  add column if not exists banca_chave text;

create unique index if not exists questoes_catalogo_fingerprint_ia_uidx
  on public.questoes_catalogo (fingerprint);

create index if not exists questoes_catalogo_reuso_ia_idx
  on public.questoes_catalogo (
    origem,
    status,
    materia_chave,
    assunto_chave,
    banca_chave,
    dificuldade,
    created_at desc
  );

drop policy if exists "questoes_catalogo_admin_inserir" on public.questoes_catalogo;
drop policy if exists "questoes_catalogo_usuario_inserir_ia" on public.questoes_catalogo;
drop policy if exists "questoes_catalogo_inserir" on public.questoes_catalogo;
create policy "questoes_catalogo_inserir"
on public.questoes_catalogo
for insert
to authenticated
with check (
  (select public.sou_admin())
  or (
    origem = 'ia'
    and status = 'ativa'
    and compatibilidade_edital = 'direta'
    and confianca_classificacao = 'alta'
    and criado_por = (select auth.uid())
    and fingerprint is not null
    and btrim(fingerprint) <> ''
    and btrim(materia_chave) <> ''
    and btrim(assunto_chave) <> ''
    and btrim(banca_chave) <> ''
    and resposta_correta_id in ('A', 'B', 'C', 'D', 'E')
    and jsonb_typeof(alternativas) = 'array'
    and jsonb_array_length(alternativas) = 5
  )
);

create table if not exists public.respostas_questoes_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questao_id uuid not null,
  resposta text not null check (resposta in ('A', 'B', 'C', 'D', 'E')),
  correta boolean not null,
  respondida_em timestamptz not null default now()
);

create index if not exists respostas_questoes_ia_usuario_questao_idx
  on public.respostas_questoes_ia (user_id, questao_id, respondida_em desc);

alter table public.respostas_questoes_ia enable row level security;

grant select, insert on table public.respostas_questoes_ia to authenticated;
revoke update, delete on table public.respostas_questoes_ia from authenticated;
revoke all on table public.respostas_questoes_ia from anon;

drop policy if exists "respostas_questoes_ia_select_proprio" on public.respostas_questoes_ia;
create policy "respostas_questoes_ia_select_proprio"
on public.respostas_questoes_ia
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "respostas_questoes_ia_insert_proprio" on public.respostas_questoes_ia;
create policy "respostas_questoes_ia_insert_proprio"
on public.respostas_questoes_ia
for insert
to authenticated
with check ((select auth.uid()) = user_id);

comment on column public.questoes_catalogo.fingerprint is
  'SHA-256 do conteudo canonico usado para impedir duplicidade de questoes de IA.';

comment on column public.questoes_catalogo.assunto_chave is
  'Nome normalizado que permite reutilizar o mesmo assunto entre editais com IDs diferentes.';

comment on table public.respostas_questoes_ia is
  'Historico privado por usuario usado para selecionar questoes ainda nao respondidas.';
