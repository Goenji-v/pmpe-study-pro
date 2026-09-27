-- Hardening final de segurança/admin.
-- RLS protege operações por linha, mas não se aplica a TRUNCATE.
-- Remove privilégios que o cliente web não precisa para operar a API de dados.

revoke truncate, references, trigger
on all tables in schema public
from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

-- A tabela de administradores é somente leitura para o próprio administrador.
revoke all privileges on table public.administradores from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.administradores from authenticated;
grant select on table public.administradores to authenticated;

-- Auditoria administrativa não deve aceitar acesso anônimo direto.
revoke all privileges on table public.auditoria_acesso from anon;
revoke truncate, references, trigger
  on table public.auditoria_acesso from authenticated;
grant select on table public.auditoria_acesso to authenticated;

-- Função usada pela UI apenas para verificar o próprio papel.
revoke execute on function public.sou_admin() from public, anon;
grant execute on function public.sou_admin() to authenticated, service_role;

-- RPCs administrativas permanecem disponíveis aos autenticados,
-- porém nunca ao papel anônimo/PUBLIC. Cada função continua validando sou_admin().
do $$
declare
  v_func regprocedure;
begin
  for v_func in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like 'admin\_%' escape '\'
        or p.proname like '%\_admin' escape '\'
        or p.proname like '%\_admin\_%' escape '\'
        or p.proname like 'moderar\_%' escape '\'
      )
  loop
    execute format('revoke execute on function %s from public, anon', v_func);
  end loop;
end
$$;
