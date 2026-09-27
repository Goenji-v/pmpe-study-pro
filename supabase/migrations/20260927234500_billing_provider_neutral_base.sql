-- Base neutra para futura cobrança individual do Study Pro.
-- Nenhum provedor é ativado aqui e nenhuma cobrança é criada por esta migration.

create table if not exists public.assinaturas_usuario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provedor text,
  provedor_cliente_id text,
  provedor_assinatura_id text,
  plano_codigo text not null default 'study_pro',
  status text not null default 'pendente'
    check (status in ('pendente','teste','ativa','inadimplente','cancelada','expirada')),
  periodo_inicio timestamptz,
  periodo_fim timestamptz,
  cancelar_no_fim boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists assinaturas_usuario_provedor_assinatura_uidx
  on public.assinaturas_usuario(provedor, provedor_assinatura_id)
  where provedor is not null and provedor_assinatura_id is not null;

create index if not exists assinaturas_usuario_status_idx
  on public.assinaturas_usuario(status);

alter table public.assinaturas_usuario enable row level security;

drop policy if exists assinaturas_usuario_ler_propria on public.assinaturas_usuario;
create policy assinaturas_usuario_ler_propria
on public.assinaturas_usuario
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all privileges on table public.assinaturas_usuario from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.assinaturas_usuario from authenticated;
grant select on table public.assinaturas_usuario to authenticated;


create table if not exists public.pagamentos_usuario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assinatura_id uuid references public.assinaturas_usuario(id) on delete set null,
  provedor text,
  provedor_pagamento_id text,
  valor_centavos integer not null check (valor_centavos >= 0),
  moeda text not null default 'BRL',
  status text not null default 'pendente'
    check (status in ('pendente','processando','pago','falhou','cancelado','estornado')),
  metodo text,
  pago_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists pagamentos_usuario_provedor_pagamento_uidx
  on public.pagamentos_usuario(provedor, provedor_pagamento_id)
  where provedor is not null and provedor_pagamento_id is not null;

create index if not exists pagamentos_usuario_user_criado_idx
  on public.pagamentos_usuario(user_id, criado_em desc);

alter table public.pagamentos_usuario enable row level security;

drop policy if exists pagamentos_usuario_ler_proprios on public.pagamentos_usuario;
create policy pagamentos_usuario_ler_proprios
on public.pagamentos_usuario
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all privileges on table public.pagamentos_usuario from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.pagamentos_usuario from authenticated;
grant select on table public.pagamentos_usuario to authenticated;


create table if not exists public.eventos_pagamento (
  id bigint generated always as identity primary key,
  provedor text not null,
  provedor_evento_id text not null,
  tipo text not null,
  user_id uuid references auth.users(id) on delete set null,
  assinatura_id uuid references public.assinaturas_usuario(id) on delete set null,
  pagamento_id uuid references public.pagamentos_usuario(id) on delete set null,
  processado boolean not null default false,
  erro text,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  unique (provedor, provedor_evento_id)
);

create index if not exists eventos_pagamento_processado_idx
  on public.eventos_pagamento(processado, recebido_em);

alter table public.eventos_pagamento enable row level security;

-- Eventos de webhook são internos. O cliente não precisa lê-los nem escrevê-los.
revoke all privileges on table public.eventos_pagamento from anon, authenticated;

comment on table public.assinaturas_usuario is
  'Estado normalizado da assinatura individual, independente do provedor de pagamento.';
comment on table public.pagamentos_usuario is
  'Histórico normalizado de cobranças individuais do Study Pro.';
comment on table public.eventos_pagamento is
  'Registro idempotente de eventos recebidos do futuro provedor de pagamentos.';
