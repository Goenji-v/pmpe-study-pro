-- Núcleo de mentoria do Study Pro.
-- O mentor define a trilha-base da turma; o aluno mantém sua disponibilidade
-- e o cronograma adapta a execução sem duplicar o modelo acadêmico existente.

create table if not exists public.trilhas_mentoria (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 160),
  ativa boolean not null default true,
  minutos_padrao integer not null default 60 check (minutos_padrao between 20 and 600),
  materias_por_dia integer not null default 1 check (materias_por_dia between 1 and 4),
  questoes_por_sessao integer not null default 20 check (questoes_por_sessao between 0 and 100),
  revisoes_por_dia integer not null default 10 check (revisoes_por_dia between 0 and 50),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists trilhas_mentoria_turma_ativa_unica
  on public.trilhas_mentoria(turma_id)
  where ativa;
create index if not exists trilhas_mentoria_parceiro_idx
  on public.trilhas_mentoria(parceiro_id, ativa);
create index if not exists trilhas_mentoria_turma_idx
  on public.trilhas_mentoria(turma_id);
create index if not exists trilhas_mentoria_criado_por_idx
  on public.trilhas_mentoria(criado_por);

create table if not exists public.trilha_mentoria_itens (
  id uuid primary key default gen_random_uuid(),
  trilha_id uuid not null references public.trilhas_mentoria(id) on delete cascade,
  materia text not null check (length(trim(materia)) between 2 and 160),
  assunto text not null check (length(trim(assunto)) between 2 and 240),
  ordem integer not null check (ordem >= 1),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (trilha_id, ordem)
);

create index if not exists trilha_mentoria_itens_trilha_ordem_idx
  on public.trilha_mentoria_itens(trilha_id, ordem)
  where ativo;

alter table public.trilhas_mentoria enable row level security;
alter table public.trilha_mentoria_itens enable row level security;

revoke all on table public.trilhas_mentoria from anon, authenticated;
revoke all on table public.trilha_mentoria_itens from anon, authenticated;
grant select, insert, update, delete on table public.trilhas_mentoria to authenticated;
grant select, insert, update, delete on table public.trilha_mentoria_itens to authenticated;
grant all on table public.trilhas_mentoria, public.trilha_mentoria_itens to service_role;

drop policy if exists trilhas_mentoria_leitura on public.trilhas_mentoria;
create policy trilhas_mentoria_leitura
on public.trilhas_mentoria
for select
to authenticated
using (
  public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
  or exists (
    select 1
    from public.licencas_acesso l
    where l.user_id = (select auth.uid())
      and l.parceiro_id = trilhas_mentoria.parceiro_id
      and l.turma_id = trilhas_mentoria.turma_id
      and l.status = 'ativa'
      and l.inicio_em <= now()
      and (l.expira_em is null or l.expira_em > now())
  )
);

drop policy if exists trilhas_mentoria_inserir on public.trilhas_mentoria;
create policy trilhas_mentoria_inserir
on public.trilhas_mentoria
for insert
to authenticated
with check (
  public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
);

drop policy if exists trilhas_mentoria_atualizar on public.trilhas_mentoria;
create policy trilhas_mentoria_atualizar
on public.trilhas_mentoria
for update
to authenticated
using (
  public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
)
with check (
  public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
);

drop policy if exists trilhas_mentoria_excluir on public.trilhas_mentoria;
create policy trilhas_mentoria_excluir
on public.trilhas_mentoria
for delete
to authenticated
using (
  public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
);

drop policy if exists trilha_mentoria_itens_leitura on public.trilha_mentoria_itens;
create policy trilha_mentoria_itens_leitura
on public.trilha_mentoria_itens
for select
to authenticated
using (
  exists (
    select 1
    from public.trilhas_mentoria t
    where t.id = trilha_mentoria_itens.trilha_id
  )
);

drop policy if exists trilha_mentoria_itens_inserir on public.trilha_mentoria_itens;
create policy trilha_mentoria_itens_inserir
on public.trilha_mentoria_itens
for insert
to authenticated
with check (
  exists (
    select 1
    from public.trilhas_mentoria t
    where t.id = trilha_mentoria_itens.trilha_id
      and (
        public.sou_admin()
        or private.sou_gestor_parceiro(t.parceiro_id)
      )
  )
);

drop policy if exists trilha_mentoria_itens_atualizar on public.trilha_mentoria_itens;
create policy trilha_mentoria_itens_atualizar
on public.trilha_mentoria_itens
for update
to authenticated
using (
  exists (
    select 1
    from public.trilhas_mentoria t
    where t.id = trilha_mentoria_itens.trilha_id
      and (
        public.sou_admin()
        or private.sou_gestor_parceiro(t.parceiro_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.trilhas_mentoria t
    where t.id = trilha_mentoria_itens.trilha_id
      and (
        public.sou_admin()
        or private.sou_gestor_parceiro(t.parceiro_id)
      )
  )
);

drop policy if exists trilha_mentoria_itens_excluir on public.trilha_mentoria_itens;
create policy trilha_mentoria_itens_excluir
on public.trilha_mentoria_itens
for delete
to authenticated
using (
  exists (
    select 1
    from public.trilhas_mentoria t
    where t.id = trilha_mentoria_itens.trilha_id
      and (
        public.sou_admin()
        or private.sou_gestor_parceiro(t.parceiro_id)
      )
  )
);

-- Retorna somente a trilha vinculada à licença ativa do aluno atual.
-- SECURITY INVOKER preserva as políticas RLS das tabelas envolvidas.
create or replace function public.minha_trilha_mentoria()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id,
    'nome', t.nome,
    'parceiro_id', t.parceiro_id,
    'turma_id', t.turma_id,
    'minutos_padrao', t.minutos_padrao,
    'materias_por_dia', t.materias_por_dia,
    'questoes_por_sessao', t.questoes_por_sessao,
    'revisoes_por_dia', t.revisoes_por_dia,
    'itens', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'materia', i.materia,
            'assunto', i.assunto,
            'ordem', i.ordem
          )
          order by i.ordem
        )
        from public.trilha_mentoria_itens i
        where i.trilha_id = t.id
          and i.ativo
      ),
      '[]'::jsonb
    )
  )
  from public.trilhas_mentoria t
  join public.licencas_acesso l
    on l.parceiro_id = t.parceiro_id
   and l.turma_id = t.turma_id
  where l.user_id = (select auth.uid())
    and l.status = 'ativa'
    and l.inicio_em <= now()
    and (l.expira_em is null or l.expira_em > now())
    and t.ativa
  order by t.criado_em desc
  limit 1
$$;

revoke all on function public.minha_trilha_mentoria() from public, anon;
grant execute on function public.minha_trilha_mentoria() to authenticated;
