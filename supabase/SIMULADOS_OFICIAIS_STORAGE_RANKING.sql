-- Simulados oficiais: arquivos de origem e ranking
-- Executar APOS SIMULADOS_OFICIAIS.sql, SIMULADOS_OFICIAIS_CORRECAO.sql e SIMULADOS_OFICIAIS_SEGURANCA.sql

alter table public.simulados_oficiais
  add column if not exists prova_storage_path text,
  add column if not exists gabarito_storage_path text,
  add column if not exists concurso_id uuid;

create index if not exists idx_simulados_oficiais_concurso
  on public.simulados_oficiais (concurso_id);

-- Bucket privado para preservar os PDFs originais.
insert into storage.buckets (id, name, public)
values ('simulados-oficiais', 'simulados-oficiais', false)
on conflict (id) do nothing;

-- Somente administradores podem gravar/remover os arquivos de origem.
create policy "Admins can manage official simulation source files"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'simulados-oficiais'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
)
with check (
  bucket_id = 'simulados-oficiais'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

-- Os alunos não recebem acesso direto ao bucket. A prova continua sendo
-- disponibilizada pela aplicação, com as questões estruturadas e o gabarito privado.

-- Garante que somente a primeira tentativa oficial conte para ranking.
create unique index if not exists uq_simulado_oficial_ranking_primeira_tentativa
  on public.simulados_oficiais_tentativas (simulado_id, usuario_id)
  where conta_ranking = true;

-- Consulta centralizada para ranking mensal. A regra de pontuação fica simples:
-- percentual de acerto, com desempate por tempo gasto.
create or replace function public.ranking_simulados_oficiais_mensal(
  p_ano integer default extract(year from current_date)::integer,
  p_mes integer default extract(month from current_date)::integer
)
returns table (
  posicao bigint,
  usuario_id uuid,
  simulados_realizados bigint,
  questoes_total bigint,
  acertos_total bigint,
  percentual numeric,
  tempo_total_minutos bigint
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      t.usuario_id,
      count(*)::bigint as simulados_realizados,
      coalesce(sum(t.total_questoes), 0)::bigint as questoes_total,
      coalesce(sum(t.acertos), 0)::bigint as acertos_total,
      coalesce(sum(t.minutos_gastos), 0)::bigint as tempo_total_minutos
    from public.simulados_oficiais_tentativas t
    where t.conta_ranking = true
      and t.finalizada_em is not null
      and extract(year from t.finalizada_em)::integer = p_ano
      and extract(month from t.finalizada_em)::integer = p_mes
    group by t.usuario_id
  ),
  ordenado as (
    select
      row_number() over (
        order by
          case when questoes_total = 0 then 0
               else acertos_total::numeric / questoes_total::numeric end desc,
          tempo_total_minutos asc,
          acertos_total desc,
          usuario_id
      ) as posicao,
      *
    from base
  )
  select
    posicao,
    usuario_id,
    simulados_realizados,
    questoes_total,
    acertos_total,
    case when questoes_total = 0 then 0
         else round((acertos_total::numeric / questoes_total::numeric) * 100, 2)
    end as percentual,
    tempo_total_minutos
  from ordenado
  order by posicao;
$$;

revoke all on function public.ranking_simulados_oficiais_mensal(integer, integer) from public;
grant execute on function public.ranking_simulados_oficiais_mensal(integer, integer) to authenticated;
