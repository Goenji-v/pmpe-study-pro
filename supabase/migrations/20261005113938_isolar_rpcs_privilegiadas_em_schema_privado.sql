create schema if not exists api_private authorization postgres;
revoke all on schema api_private from public;
grant usage on schema api_private to anon, authenticated, service_role;

alter default privileges for role postgres in schema api_private
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Move privileged implementations out of the exposed public schema.
alter function public.admin_atualizar_turma_parceiro(uuid, text, boolean) set schema api_private;
alter function public.admin_atualizar_valor_parceria(uuid, integer) set schema api_private;
alter function public.admin_criar_parceria(text, text, integer) set schema api_private;
alter function public.admin_criar_turma_parceiro(uuid, text, text, date, date) set schema api_private;
alter function public.admin_definir_usuario_parceiro(uuid, text, text, boolean) set schema api_private;
alter function public.admin_listar_parcerias() set schema api_private;
alter function public.admin_listar_usuarios() set schema api_private;
alter function public.admin_resumo() set schema api_private;
alter function public.atualizar_faturamento_parceiro_admin(uuid, text, integer, date, text) set schema api_private;
alter function public.fechar_faturamento_parceiro_admin(uuid, date, integer, date, text) set schema api_private;
alter function public.listar_faturamento_parceiro_admin(uuid) set schema api_private;
alter function public.listar_financeiro_geral_admin(integer) set schema api_private;
alter function public.moderar_denuncia_questao(uuid, text, text) set schema api_private;
alter function public.consultar_convite(text) set schema api_private;

-- Harden the hidden implementations explicitly.
revoke execute on all functions in schema api_private from public;
revoke execute on function api_private.admin_atualizar_turma_parceiro(uuid, text, boolean) from anon;
revoke execute on function api_private.admin_atualizar_valor_parceria(uuid, integer) from anon;
revoke execute on function api_private.admin_criar_parceria(text, text, integer) from anon;
revoke execute on function api_private.admin_criar_turma_parceiro(uuid, text, text, date, date) from anon;
revoke execute on function api_private.admin_definir_usuario_parceiro(uuid, text, text, boolean) from anon;
revoke execute on function api_private.admin_listar_parcerias() from anon;
revoke execute on function api_private.admin_listar_usuarios() from anon;
revoke execute on function api_private.admin_resumo() from anon;
revoke execute on function api_private.atualizar_faturamento_parceiro_admin(uuid, text, integer, date, text) from anon;
revoke execute on function api_private.fechar_faturamento_parceiro_admin(uuid, date, integer, date, text) from anon;
revoke execute on function api_private.listar_faturamento_parceiro_admin(uuid) from anon;
revoke execute on function api_private.listar_financeiro_geral_admin(integer) from anon;
revoke execute on function api_private.moderar_denuncia_questao(uuid, text, text) from anon;

grant execute on function api_private.admin_atualizar_turma_parceiro(uuid, text, boolean) to authenticated, service_role;
grant execute on function api_private.admin_atualizar_valor_parceria(uuid, integer) to authenticated, service_role;
grant execute on function api_private.admin_criar_parceria(text, text, integer) to authenticated, service_role;
grant execute on function api_private.admin_criar_turma_parceiro(uuid, text, text, date, date) to authenticated, service_role;
grant execute on function api_private.admin_definir_usuario_parceiro(uuid, text, text, boolean) to authenticated, service_role;
grant execute on function api_private.admin_listar_parcerias() to authenticated, service_role;
grant execute on function api_private.admin_listar_usuarios() to authenticated, service_role;
grant execute on function api_private.admin_resumo() to authenticated, service_role;
grant execute on function api_private.atualizar_faturamento_parceiro_admin(uuid, text, integer, date, text) to authenticated, service_role;
grant execute on function api_private.fechar_faturamento_parceiro_admin(uuid, date, integer, date, text) to authenticated, service_role;
grant execute on function api_private.listar_faturamento_parceiro_admin(uuid) to authenticated, service_role;
grant execute on function api_private.listar_financeiro_geral_admin(integer) to authenticated, service_role;
grant execute on function api_private.moderar_denuncia_questao(uuid, text, text) to authenticated, service_role;
grant execute on function api_private.consultar_convite(text) to anon, authenticated, service_role;

-- Public API wrappers run with caller privileges and expose only the intended entrypoints.
create function public.admin_atualizar_turma_parceiro(p_turma_id uuid, p_nome text, p_ativa boolean)
returns void
language sql
security invoker
set search_path = ''
as $$ select api_private.admin_atualizar_turma_parceiro($1,$2,$3); $$;

create function public.admin_atualizar_valor_parceria(p_parceiro_id uuid, p_valor_aluno_centavos integer)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select api_private.admin_atualizar_valor_parceria($1,$2); $$;

create function public.admin_criar_parceria(p_nome text, p_slug text, p_valor_aluno_centavos integer default 2000)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select api_private.admin_criar_parceria($1,$2,$3); $$;

create function public.admin_criar_turma_parceiro(
  p_parceiro_id uuid,
  p_nome text,
  p_codigo text default null::text,
  p_inicia_em date default null::date,
  p_encerra_em date default null::date
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select api_private.admin_criar_turma_parceiro($1,$2,$3,$4,$5); $$;

create function public.admin_definir_usuario_parceiro(
  p_parceiro_id uuid,
  p_email text,
  p_papel text default 'professor'::text,
  p_ativo boolean default true
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select api_private.admin_definir_usuario_parceiro($1,$2,$3,$4); $$;

create function public.admin_listar_parcerias()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select api_private.admin_listar_parcerias(); $$;

create function public.admin_listar_usuarios()
returns table(
  user_id uuid,
  nome_publico text,
  email text,
  criado_em timestamptz,
  ultimo_login_em timestamptz,
  email_confirmado_em timestamptz,
  banido_ate timestamptz,
  minutos_mes integer,
  questoes_mes integer,
  acertos_mes integer,
  xp_mes integer,
  nivel integer
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from api_private.admin_listar_usuarios(); $$;

create function public.admin_resumo()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select api_private.admin_resumo(); $$;

create function public.atualizar_faturamento_parceiro_admin(
  p_faturamento_id uuid,
  p_status text,
  p_ajuste_centavos integer,
  p_vencimento_em date,
  p_observacao text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select api_private.atualizar_faturamento_parceiro_admin($1,$2,$3,$4,$5); $$;

create function public.fechar_faturamento_parceiro_admin(
  p_parceiro_id uuid,
  p_competencia date,
  p_ajuste_centavos integer default 0,
  p_vencimento_em date default null::date,
  p_observacao text default null::text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select api_private.fechar_faturamento_parceiro_admin($1,$2,$3,$4,$5); $$;

create function public.listar_faturamento_parceiro_admin(p_parceiro_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select api_private.listar_faturamento_parceiro_admin($1); $$;

create function public.listar_financeiro_geral_admin(p_ano integer default null::integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select api_private.listar_financeiro_geral_admin($1); $$;

create function public.moderar_denuncia_questao(
  p_denuncia_id uuid,
  p_acao text,
  p_resposta_admin text default null::text
)
returns void
language sql
security invoker
set search_path = ''
as $$ select api_private.moderar_denuncia_questao($1,$2,$3); $$;

create function public.consultar_convite(p_codigo text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select api_private.consultar_convite($1); $$;

-- Lock wrapper grants down explicitly.
revoke execute on function public.admin_atualizar_turma_parceiro(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_atualizar_valor_parceria(uuid, integer) from public, anon;
revoke execute on function public.admin_criar_parceria(text, text, integer) from public, anon;
revoke execute on function public.admin_criar_turma_parceiro(uuid, text, text, date, date) from public, anon;
revoke execute on function public.admin_definir_usuario_parceiro(uuid, text, text, boolean) from public, anon;
revoke execute on function public.admin_listar_parcerias() from public, anon;
revoke execute on function public.admin_listar_usuarios() from public, anon;
revoke execute on function public.admin_resumo() from public, anon;
revoke execute on function public.atualizar_faturamento_parceiro_admin(uuid, text, integer, date, text) from public, anon;
revoke execute on function public.fechar_faturamento_parceiro_admin(uuid, date, integer, date, text) from public, anon;
revoke execute on function public.listar_faturamento_parceiro_admin(uuid) from public, anon;
revoke execute on function public.listar_financeiro_geral_admin(integer) from public, anon;
revoke execute on function public.moderar_denuncia_questao(uuid, text, text) from public, anon;
revoke execute on function public.consultar_convite(text) from public;

grant execute on function public.admin_atualizar_turma_parceiro(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.admin_atualizar_valor_parceria(uuid, integer) to authenticated, service_role;
grant execute on function public.admin_criar_parceria(text, text, integer) to authenticated, service_role;
grant execute on function public.admin_criar_turma_parceiro(uuid, text, text, date, date) to authenticated, service_role;
grant execute on function public.admin_definir_usuario_parceiro(uuid, text, text, boolean) to authenticated, service_role;
grant execute on function public.admin_listar_parcerias() to authenticated, service_role;
grant execute on function public.admin_listar_usuarios() to authenticated, service_role;
grant execute on function public.admin_resumo() to authenticated, service_role;
grant execute on function public.atualizar_faturamento_parceiro_admin(uuid, text, integer, date, text) to authenticated, service_role;
grant execute on function public.fechar_faturamento_parceiro_admin(uuid, date, integer, date, text) to authenticated, service_role;
grant execute on function public.listar_faturamento_parceiro_admin(uuid) to authenticated, service_role;
grant execute on function public.listar_financeiro_geral_admin(integer) to authenticated, service_role;
grant execute on function public.moderar_denuncia_questao(uuid, text, text) to authenticated, service_role;
grant execute on function public.consultar_convite(text) to anon, authenticated, service_role;

