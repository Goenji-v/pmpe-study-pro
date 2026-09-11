-- Evita políticas permissivas duplicadas nas operações adicionadas pelo módulo.

drop policy if exists simulados_oficiais_admin_delete on public.simulados_oficiais;
drop policy if exists simulados_oficiais_parceiro_delete on public.simulados_oficiais;
drop policy if exists simulados_oficiais_delete on public.simulados_oficiais;
create policy simulados_oficiais_delete
on public.simulados_oficiais for delete to authenticated
using (
  public.sou_admin()
  or (parceiro_id is not null and private.sou_gestor_parceiro(parceiro_id))
);

drop policy if exists simulados_oficiais_gabaritos_admin_update on public.simulados_oficiais_gabaritos;
drop policy if exists simulados_gabaritos_parceiro_update on public.simulados_oficiais_gabaritos;
drop policy if exists simulados_gabaritos_update on public.simulados_oficiais_gabaritos;
create policy simulados_gabaritos_update
on public.simulados_oficiais_gabaritos for update to authenticated
using (
  public.sou_admin()
  or exists (
    select 1 from public.simulados_oficiais s
    where s.id=simulados_oficiais_gabaritos.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
)
with check (
  public.sou_admin()
  or exists (
    select 1 from public.simulados_oficiais s
    where s.id=simulados_oficiais_gabaritos.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);

drop policy if exists simulados_oficiais_gabaritos_admin_delete on public.simulados_oficiais_gabaritos;
drop policy if exists simulados_gabaritos_parceiro_delete on public.simulados_oficiais_gabaritos;
drop policy if exists simulados_gabaritos_delete on public.simulados_oficiais_gabaritos;
create policy simulados_gabaritos_delete
on public.simulados_oficiais_gabaritos for delete to authenticated
using (
  public.sou_admin()
  or exists (
    select 1 from public.simulados_oficiais s
    where s.id=simulados_oficiais_gabaritos.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);

drop policy if exists simulados_oficiais_questoes_admin_delete on public.simulados_oficiais_questoes;
drop policy if exists simulados_questoes_parceiro_delete on public.simulados_oficiais_questoes;
drop policy if exists simulados_questoes_delete on public.simulados_oficiais_questoes;
create policy simulados_questoes_delete
on public.simulados_oficiais_questoes for delete to authenticated
using (
  public.sou_admin()
  or exists (
    select 1 from public.simulados_oficiais s
    where s.id=simulados_oficiais_questoes.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);
