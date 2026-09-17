-- Defesa em profundidade: estas tabelas são internas/autenticadas.
-- O único fluxo público relacionado a parceria usa consultar_convite(text),
-- que é SECURITY DEFINER e não depende de grants diretos para anon.
revoke all privileges on table public.faturamento_parceiros from anon;
revoke all privileges on table public.licencas_acesso from anon;
revoke all privileges on table public.parceiro_usuarios from anon;
revoke all privileges on table public.parceiros from anon;
revoke all privileges on table public.perfis from anon;
revoke all privileges on table public.simulados_oficiais from anon;
revoke all privileges on table public.simulados_oficiais_gabaritos from anon;
revoke all privileges on table public.simulados_oficiais_questoes from anon;
revoke all privileges on table public.turmas from anon;

-- FATURAMENTO: separa escrita admin da leitura para evitar policy ALL + SELECT.
drop policy if exists faturamento_admin_escrita on public.faturamento_parceiros;
drop policy if exists faturamento_leitura on public.faturamento_parceiros;

create policy faturamento_leitura
on public.faturamento_parceiros
for select
to authenticated
using ((select public.sou_admin()) or private.sou_proprietario_parceiro(parceiro_id));

create policy faturamento_admin_insert
on public.faturamento_parceiros
for insert
to authenticated
with check ((select public.sou_admin()));

create policy faturamento_admin_update
on public.faturamento_parceiros
for update
to authenticated
using ((select public.sou_admin()))
with check ((select public.sou_admin()));

create policy faturamento_admin_delete
on public.faturamento_parceiros
for delete
to authenticated
using ((select public.sou_admin()));

-- LICENÇAS: leitura própria/gestor/admin + escrita operacional sem policy ALL.
drop policy if exists licencas_gestao on public.licencas_acesso;
drop policy if exists licencas_leitura on public.licencas_acesso;

create policy licencas_leitura
on public.licencas_acesso
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.sou_gestor_parceiro(parceiro_id)
  or (select public.sou_admin())
);

create policy licencas_gestao_insert
on public.licencas_acesso
for insert
to authenticated
with check ((select public.sou_admin()) or private.sou_operacao_parceiro(parceiro_id));

create policy licencas_gestao_update
on public.licencas_acesso
for update
to authenticated
using ((select public.sou_admin()) or private.sou_operacao_parceiro(parceiro_id))
with check ((select public.sou_admin()) or private.sou_operacao_parceiro(parceiro_id));

create policy licencas_gestao_delete
on public.licencas_acesso
for delete
to authenticated
using ((select public.sou_admin()) or private.sou_operacao_parceiro(parceiro_id));

-- USUÁRIOS DO PARCEIRO: leitura autorizada + escrita admin sem sobreposição SELECT.
drop policy if exists parceiro_usuarios_admin_escrita on public.parceiro_usuarios;
drop policy if exists parceiro_usuarios_leitura on public.parceiro_usuarios;

create policy parceiro_usuarios_leitura
on public.parceiro_usuarios
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.sou_admin())
  or private.sou_operacao_parceiro(parceiro_id)
);

create policy parceiro_usuarios_admin_insert
on public.parceiro_usuarios
for insert
to authenticated
with check ((select public.sou_admin()));

create policy parceiro_usuarios_admin_update
on public.parceiro_usuarios
for update
to authenticated
using ((select public.sou_admin()))
with check ((select public.sou_admin()));

create policy parceiro_usuarios_admin_delete
on public.parceiro_usuarios
for delete
to authenticated
using ((select public.sou_admin()));

-- PARCEIROS: leitura autorizada + escrita admin sem sobreposição SELECT.
drop policy if exists parceiros_admin_escrita on public.parceiros;
drop policy if exists parceiros_leitura_autorizada on public.parceiros;

create policy parceiros_leitura_autorizada
on public.parceiros
for select
to authenticated
using (
  (select public.sou_admin())
  or private.sou_gestor_parceiro(id)
  or exists (
    select 1
    from public.licencas_acesso l
    where l.parceiro_id = parceiros.id
      and l.user_id = (select auth.uid())
  )
);

create policy parceiros_admin_insert
on public.parceiros
for insert
to authenticated
with check ((select public.sou_admin()));

create policy parceiros_admin_update
on public.parceiros
for update
to authenticated
using ((select public.sou_admin()))
with check ((select public.sou_admin()));

create policy parceiros_admin_delete
on public.parceiros
for delete
to authenticated
using ((select public.sou_admin()));

-- PERFIS: perfis_leitura_parceiro já inclui o próprio usuário.
drop policy if exists perfis_select_proprio on public.perfis;

-- SIMULADOS: consolida políticas admin + parceiro com OR, preservando regras.
drop policy if exists simulados_oficiais_admin_insert on public.simulados_oficiais;
drop policy if exists simulados_oficiais_parceiro_insert on public.simulados_oficiais;
drop policy if exists simulados_oficiais_admin_update on public.simulados_oficiais;
drop policy if exists simulados_oficiais_parceiro_update on public.simulados_oficiais;

create policy simulados_oficiais_insert
on public.simulados_oficiais
for insert
to authenticated
with check (
  (select public.sou_admin())
  or (
    parceiro_id is not null
    and turma_id is not null
    and private.sou_gestor_parceiro(parceiro_id)
    and exists (
      select 1 from public.turmas t
      where t.id = simulados_oficiais.turma_id
        and t.parceiro_id = simulados_oficiais.parceiro_id
    )
  )
);

create policy simulados_oficiais_update
on public.simulados_oficiais
for update
to authenticated
using (
  (select public.sou_admin())
  or (parceiro_id is not null and private.sou_gestor_parceiro(parceiro_id))
)
with check (
  (select public.sou_admin())
  or (
    parceiro_id is not null
    and private.sou_gestor_parceiro(parceiro_id)
    and (
      turma_id is null
      or exists (
        select 1 from public.turmas t
        where t.id = simulados_oficiais.turma_id
          and t.parceiro_id = simulados_oficiais.parceiro_id
      )
    )
  )
);

-- GABARITOS: consolida INSERT admin + parceiro.
drop policy if exists simulados_gabaritos_parceiro_insert on public.simulados_oficiais_gabaritos;
drop policy if exists simulados_oficiais_gabaritos_admin_insert on public.simulados_oficiais_gabaritos;

create policy simulados_gabaritos_insert
on public.simulados_oficiais_gabaritos
for insert
to authenticated
with check (
  (select public.sou_admin())
  or exists (
    select 1
    from public.simulados_oficiais s
    where s.id = simulados_oficiais_gabaritos.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);

-- QUESTÕES DE SIMULADO: consolida INSERT e UPDATE admin + parceiro.
drop policy if exists simulados_oficiais_questoes_admin_insert on public.simulados_oficiais_questoes;
drop policy if exists simulados_questoes_parceiro_insert on public.simulados_oficiais_questoes;
drop policy if exists simulados_oficiais_questoes_admin_update on public.simulados_oficiais_questoes;
drop policy if exists simulados_questoes_parceiro_update on public.simulados_oficiais_questoes;

create policy simulados_questoes_insert
on public.simulados_oficiais_questoes
for insert
to authenticated
with check (
  (select public.sou_admin())
  or exists (
    select 1
    from public.simulados_oficiais s
    where s.id = simulados_oficiais_questoes.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);

create policy simulados_questoes_update
on public.simulados_oficiais_questoes
for update
to authenticated
using (
  (select public.sou_admin())
  or exists (
    select 1
    from public.simulados_oficiais s
    where s.id = simulados_oficiais_questoes.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
)
with check (
  (select public.sou_admin())
  or exists (
    select 1
    from public.simulados_oficiais s
    where s.id = simulados_oficiais_questoes.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);

-- TURMAS: leitura autenticada e escrita operacional sem policy ALL.
drop policy if exists turmas_gestao on public.turmas;
drop policy if exists turmas_leitura on public.turmas;

create policy turmas_leitura
on public.turmas
for select
to authenticated
using (
  private.sou_gestor_parceiro(parceiro_id)
  or (select public.sou_admin())
  or exists (
    select 1
    from public.licencas_acesso l
    where l.turma_id = turmas.id
      and l.user_id = (select auth.uid())
  )
);

create policy turmas_gestao_insert
on public.turmas
for insert
to authenticated
with check ((select public.sou_admin()) or private.sou_operacao_parceiro(parceiro_id));

create policy turmas_gestao_update
on public.turmas
for update
to authenticated
using ((select public.sou_admin()) or private.sou_operacao_parceiro(parceiro_id))
with check ((select public.sou_admin()) or private.sou_operacao_parceiro(parceiro_id));

create policy turmas_gestao_delete
on public.turmas
for delete
to authenticated
using ((select public.sou_admin()) or private.sou_operacao_parceiro(parceiro_id));