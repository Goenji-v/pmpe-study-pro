-- Painel individual da mentoria: personalização de rota por aluno.

create table if not exists public.trilha_mentoria_rotas_aluno (
  id uuid primary key default gen_random_uuid(),
  trilha_id uuid not null references public.trilhas_mentoria(id) on delete cascade,
  item_id uuid not null references public.trilha_mentoria_itens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  ordem integer not null check (ordem > 0),
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists trilha_rotas_aluno_user_trilha_idx
  on public.trilha_mentoria_rotas_aluno(user_id, trilha_id, ordem);
create index if not exists trilha_rotas_aluno_trilha_idx
  on public.trilha_mentoria_rotas_aluno(trilha_id);
create index if not exists trilha_rotas_aluno_parceiro_idx
  on public.trilha_mentoria_rotas_aluno(parceiro_id);
create index if not exists trilha_rotas_aluno_turma_idx
  on public.trilha_mentoria_rotas_aluno(turma_id);
create index if not exists trilha_rotas_aluno_criado_por_idx
  on public.trilha_mentoria_rotas_aluno(criado_por);

alter table public.trilha_mentoria_rotas_aluno enable row level security;

revoke all on table public.trilha_mentoria_rotas_aluno from anon;
grant select, insert, update, delete on table public.trilha_mentoria_rotas_aluno to authenticated;
grant select, insert, update, delete on table public.trilha_mentoria_rotas_aluno to service_role;

drop policy if exists trilha_rotas_aluno_leitura on public.trilha_mentoria_rotas_aluno;
create policy trilha_rotas_aluno_leitura
on public.trilha_mentoria_rotas_aluno
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
);

drop policy if exists trilha_rotas_aluno_inserir on public.trilha_mentoria_rotas_aluno;
create policy trilha_rotas_aluno_inserir
on public.trilha_mentoria_rotas_aluno
for insert
to authenticated
with check (
  (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
  and exists (
    select 1
    from public.licencas_acesso l
    where l.user_id = trilha_mentoria_rotas_aluno.user_id
      and l.parceiro_id = trilha_mentoria_rotas_aluno.parceiro_id
      and l.turma_id = trilha_mentoria_rotas_aluno.turma_id
      and l.status in ('ativa', 'pendente', 'suspensa')
  )
  and exists (
    select 1
    from public.trilha_mentoria_itens i
    join public.trilhas_mentoria t on t.id = i.trilha_id
    where i.id = trilha_mentoria_rotas_aluno.item_id
      and t.id = trilha_mentoria_rotas_aluno.trilha_id
      and t.parceiro_id = trilha_mentoria_rotas_aluno.parceiro_id
      and t.turma_id = trilha_mentoria_rotas_aluno.turma_id
  )
);

drop policy if exists trilha_rotas_aluno_atualizar on public.trilha_mentoria_rotas_aluno;
create policy trilha_rotas_aluno_atualizar
on public.trilha_mentoria_rotas_aluno
for update
to authenticated
using (
  public.sou_admin() or private.sou_gestor_parceiro(parceiro_id)
)
with check (
  (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
  and exists (
    select 1
    from public.licencas_acesso l
    where l.user_id = trilha_mentoria_rotas_aluno.user_id
      and l.parceiro_id = trilha_mentoria_rotas_aluno.parceiro_id
      and l.turma_id = trilha_mentoria_rotas_aluno.turma_id
      and l.status in ('ativa', 'pendente', 'suspensa')
  )
  and exists (
    select 1
    from public.trilha_mentoria_itens i
    join public.trilhas_mentoria t on t.id = i.trilha_id
    where i.id = trilha_mentoria_rotas_aluno.item_id
      and t.id = trilha_mentoria_rotas_aluno.trilha_id
      and t.parceiro_id = trilha_mentoria_rotas_aluno.parceiro_id
      and t.turma_id = trilha_mentoria_rotas_aluno.turma_id
  )
);

drop policy if exists trilha_rotas_aluno_excluir on public.trilha_mentoria_rotas_aluno;
create policy trilha_rotas_aluno_excluir
on public.trilha_mentoria_rotas_aluno
for delete
to authenticated
using (
  public.sou_admin() or private.sou_gestor_parceiro(parceiro_id)
);

create or replace function public.minha_trilha_mentoria()
returns jsonb
language sql
stable
set search_path = 'public'
as $function$
  select jsonb_build_object(
    'id',t.id,
    'nome',t.nome,
    'parceiro_id',t.parceiro_id,
    'turma_id',t.turma_id,
    'minutos_padrao',t.minutos_padrao,
    'materias_por_dia',t.materias_por_dia,
    'questoes_por_sessao',t.questoes_por_sessao,
    'revisoes_por_dia',t.revisoes_por_dia,
    'itens',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',i.id,
          'materia',i.materia,
          'assunto',i.assunto,
          'ordem',coalesce(ra.ordem,i.ordem),
          'concluido',p.item_id is not null,
          'concluido_em',p.concluido_em
        )
        order by coalesce(ra.ordem,i.ordem), i.ordem
      )
      from public.trilha_mentoria_itens i
      left join public.trilha_mentoria_rotas_aluno ra
        on ra.item_id=i.id and ra.user_id=(select auth.uid())
      left join public.progresso_trilha_mentoria p
        on p.item_id=i.id and p.user_id=(select auth.uid())
      where i.trilha_id=t.id
        and i.ativo
        and coalesce(ra.ativo,true)
    ),'[]'::jsonb),
    'reforcos',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',r.id,
          'item_id',r.item_id,
          'materia',r.materia,
          'assunto',r.assunto,
          'motivo',r.motivo,
          'criado_em',r.criado_em
        )
        order by r.criado_em
      )
      from public.reforcos_mentoria r
      where r.trilha_id=t.id
        and r.user_id=(select auth.uid())
        and r.status='pendente'
    ),'[]'::jsonb)
  )
  from public.trilhas_mentoria t
  join public.licencas_acesso l
    on l.parceiro_id=t.parceiro_id and l.turma_id=t.turma_id
  where l.user_id=(select auth.uid())
    and l.status='ativa'
    and l.inicio_em<=now()
    and (l.expira_em is null or l.expira_em>now())
    and t.ativa
  order by t.criado_em desc
  limit 1
$function$;
