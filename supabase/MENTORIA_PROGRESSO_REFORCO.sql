-- Progresso individual e reforços da mentoria.
-- Evolução aditiva sobre MENTORIA_TRILHAS_CRONOGRAMA.sql.

create table if not exists public.progresso_trilha_mentoria (
  item_id uuid not null references public.trilha_mentoria_itens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  origem text not null default 'conteudo' check (origem in ('conteudo','cronograma','importado')),
  concluido_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index if not exists progresso_trilha_mentoria_user_idx
  on public.progresso_trilha_mentoria(user_id, concluido_em desc);

alter table public.progresso_trilha_mentoria enable row level security;

grant select, insert, update, delete on public.progresso_trilha_mentoria to authenticated;
grant all on public.progresso_trilha_mentoria to service_role;

drop policy if exists progresso_trilha_leitura on public.progresso_trilha_mentoria;
create policy progresso_trilha_leitura
on public.progresso_trilha_mentoria
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.sou_admin()
  or exists (
    select 1
    from public.trilha_mentoria_itens i
    join public.trilhas_mentoria t on t.id = i.trilha_id
    where i.id = progresso_trilha_mentoria.item_id
      and private.sou_gestor_parceiro(t.parceiro_id)
  )
);

drop policy if exists progresso_trilha_inserir on public.progresso_trilha_mentoria;
create policy progresso_trilha_inserir
on public.progresso_trilha_mentoria
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.trilha_mentoria_itens i
    join public.trilhas_mentoria t on t.id = i.trilha_id
    join public.licencas_acesso l
      on l.parceiro_id = t.parceiro_id
     and l.turma_id = t.turma_id
     and l.user_id = (select auth.uid())
    where i.id = progresso_trilha_mentoria.item_id
      and t.ativa
      and l.status = 'ativa'
      and l.inicio_em <= now()
      and (l.expira_em is null or l.expira_em > now())
  )
);

drop policy if exists progresso_trilha_atualizar on public.progresso_trilha_mentoria;
create policy progresso_trilha_atualizar
on public.progresso_trilha_mentoria
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists progresso_trilha_excluir on public.progresso_trilha_mentoria;
create policy progresso_trilha_excluir
on public.progresso_trilha_mentoria
for delete
to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.reforcos_mentoria (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  trilha_id uuid not null references public.trilhas_mentoria(id) on delete cascade,
  item_id uuid references public.trilha_mentoria_itens(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  materia text not null check (length(trim(materia)) between 2 and 160),
  assunto text not null check (length(trim(assunto)) between 2 and 240),
  motivo text,
  status text not null default 'pendente' check (status in ('pendente','concluido','cancelado')),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index if not exists reforcos_mentoria_user_status_idx
  on public.reforcos_mentoria(user_id, status, criado_em desc);
create index if not exists reforcos_mentoria_trilha_idx
  on public.reforcos_mentoria(trilha_id, status);
create index if not exists reforcos_mentoria_parceiro_idx
  on public.reforcos_mentoria(parceiro_id, turma_id, status);
create index if not exists reforcos_mentoria_criado_por_idx
  on public.reforcos_mentoria(criado_por);

alter table public.reforcos_mentoria enable row level security;

revoke all on public.reforcos_mentoria from anon, authenticated;
grant select, insert, delete on public.reforcos_mentoria to authenticated;
grant update (status, concluido_em, atualizado_em) on public.reforcos_mentoria to authenticated;
grant all on public.reforcos_mentoria to service_role;

drop policy if exists reforcos_mentoria_leitura on public.reforcos_mentoria;
create policy reforcos_mentoria_leitura
on public.reforcos_mentoria
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
);

drop policy if exists reforcos_mentoria_inserir on public.reforcos_mentoria;
create policy reforcos_mentoria_inserir
on public.reforcos_mentoria
for insert
to authenticated
with check (
  (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
  and exists (
    select 1
    from public.licencas_acesso l
    where l.user_id = reforcos_mentoria.user_id
      and l.parceiro_id = reforcos_mentoria.parceiro_id
      and l.turma_id = reforcos_mentoria.turma_id
      and l.status = 'ativa'
      and l.inicio_em <= now()
      and (l.expira_em is null or l.expira_em > now())
  )
  and exists (
    select 1
    from public.trilhas_mentoria t
    where t.id = reforcos_mentoria.trilha_id
      and t.parceiro_id = reforcos_mentoria.parceiro_id
      and t.turma_id = reforcos_mentoria.turma_id
      and t.ativa
  )
);

drop policy if exists reforcos_mentoria_atualizar_aluno on public.reforcos_mentoria;
create policy reforcos_mentoria_atualizar_aluno
on public.reforcos_mentoria
for update
to authenticated
using (user_id = (select auth.uid()) and status = 'pendente')
with check (user_id = (select auth.uid()) and status = 'concluido');

drop policy if exists reforcos_mentoria_atualizar_gestor on public.reforcos_mentoria;
create policy reforcos_mentoria_atualizar_gestor
on public.reforcos_mentoria
for update
to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
with check (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));

drop policy if exists reforcos_mentoria_excluir_gestor on public.reforcos_mentoria;
create policy reforcos_mentoria_excluir_gestor
on public.reforcos_mentoria
for delete
to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));

-- Versão com turma_id para que a tela de mentoria consiga separar alunos
-- sem depender do nome textual da turma.
create or replace function public.listar_alunos_meu_parceiro_v3()
returns table(
  licenca_id uuid,
  user_id uuid,
  nome text,
  email text,
  turma_id uuid,
  turma text,
  status text,
  inicio_em timestamptz,
  expira_em timestamptz,
  minutos integer,
  questoes integer,
  acertos integer,
  nivel integer,
  ultima_atividade timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    l.id,
    l.user_id,
    coalesce(pf.nome,'Aluno'),
    pf.email,
    l.turma_id,
    coalesce(t.nome,'Sem turma'),
    case
      when l.status='ativa' and l.expira_em is not null and l.expira_em<=now() then 'expirada'
      else l.status
    end,
    l.inicio_em,
    l.expira_em,
    coalesce(r.minutos,0),
    coalesce(r.questoes,0),
    coalesce(r.acertos,0),
    coalesce(r.nivel,1),
    r.atualizado_em
  from public.licencas_acesso l
  left join public.perfis pf on pf.id=l.user_id
  left join public.turmas t on t.id=l.turma_id
  left join public.ranking_mensal r
    on r.user_id=l.user_id
   and r.mes=to_char(current_date,'YYYY-MM')
  where private.sou_gestor_parceiro(l.parceiro_id)
  order by pf.nome nulls last,l.criado_em desc
$$;
revoke all on function public.listar_alunos_meu_parceiro_v3() from public, anon;
grant execute on function public.listar_alunos_meu_parceiro_v3() to authenticated;

-- A trilha do aluno agora inclui progresso individual e reforços pendentes.
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
            'ordem', i.ordem,
            'concluido', p.item_id is not null,
            'concluido_em', p.concluido_em
          )
          order by i.ordem
        )
        from public.trilha_mentoria_itens i
        left join public.progresso_trilha_mentoria p
          on p.item_id = i.id
         and p.user_id = (select auth.uid())
        where i.trilha_id = t.id
          and i.ativo
      ),
      '[]'::jsonb
    ),
    'reforcos', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'item_id', r.item_id,
            'materia', r.materia,
            'assunto', r.assunto,
            'motivo', r.motivo,
            'criado_em', r.criado_em
          )
          order by r.criado_em
        )
        from public.reforcos_mentoria r
        where r.trilha_id = t.id
          and r.user_id = (select auth.uid())
          and r.status = 'pendente'
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
