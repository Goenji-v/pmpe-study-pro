-- Usuários comuns não publicam diretamente no catálogo compartilhado.
-- A Edge Function publicar-questoes-ia valida a sessão, valida o conteúdo e
-- grava com service role. Administradores continuam podendo publicar pela curadoria.

drop policy if exists "questoes_catalogo_inserir" on public.questoes_catalogo;
drop policy if exists "questoes_catalogo_usuario_inserir_ia" on public.questoes_catalogo;
drop policy if exists "questoes_catalogo_admin_inserir" on public.questoes_catalogo;

create policy "questoes_catalogo_admin_inserir"
on public.questoes_catalogo
for insert
to authenticated
with check ((select public.sou_admin()));
