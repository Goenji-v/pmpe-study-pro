-- V2 shadow import (non-operational). Old appState stays immutable.
-- Never expose this schema via Data API; no public/authenticated privileges.
create table if not exists study_pro_internal.revisao_v2_importacao_legada (
  user_id uuid not null references auth.users(id) on delete cascade,
  revisao_legada_id text not null,
  registro_original jsonb not null,
  materia_origem text not null,
  assunto_origem text not null,
  materia_id_origem text,
  assunto_id_origem text,
  etapa_legada integer,
  concluida_legada boolean not null,
  status_mapeamento text not null default 'aguardando_catalogo'
    check (status_mapeamento in ('aguardando_catalogo','validado','ambiguo')),
  revision_origem bigint not null,
  importada_em timestamptz not null default now(),
  primary key (user_id, revisao_legada_id)
);
revoke all on study_pro_internal.revisao_v2_importacao_legada from public,anon,authenticated;
comment on table study_pro_internal.revisao_v2_importacao_legada
  is 'Shadow inventory only; never write back to appState or bypass restore RPC.';
