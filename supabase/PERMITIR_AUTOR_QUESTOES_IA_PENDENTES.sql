-- Permite ao autor resolver imediatamente as próprias questões geradas por IA
-- enquanto elas aguardam curadoria. O banco compartilhado continua expondo
-- para outros usuários somente questões ativas; administradores mantêm acesso total.

drop policy if exists questoes_catalogo_leitura on public.questoes_catalogo;

create policy questoes_catalogo_leitura
on public.questoes_catalogo
for select
to authenticated
using (
  status = 'ativa'
  or (status = 'pendente' and criado_por = auth.uid())
  or (select sou_admin())
);
