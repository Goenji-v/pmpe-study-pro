-- Expose only the public profile projection; never return account settings.
create or replace function api_private.perfil_publico_aluno(p_usuario uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_nome text;
  v_economia jsonb;
  v_fundo text;
  v_conquistas integer := 0;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.' using errcode = '42501'; end if;
  select coalesce(nullif(left(c.dados #>> '{appState,configuracoes,nomeUsuario}',120),''),nullif(left(p.nome,120),''),'Estudante'),
    coalesce(c.dados #> '{appState,configuracoes,economia}','{}'::jsonb)
  into v_nome,v_economia from public.perfis p left join public.configuracoes c on c.user_id=p.id where p.id=p_usuario;
  if not found then return null; end if;
  select count(distinct item)::integer into v_conquistas
    from jsonb_array_elements_text(case when jsonb_typeof(v_economia->'recompensasRecebidas')='array' then v_economia->'recompensasRecebidas' else '[]'::jsonb end) as r(item)
    where item like 'conquista-marco:%';
  v_fundo := v_economia->>'fundoPerfilEquipado';
  if v_fundo = 'fundo-disciplina' then
    if not coalesce(v_economia->'recompensasRecebidas' ? 'conquista-marco:sequencia-30',false) then v_fundo := null; end if;
  elsif v_fundo in ('fundo-aurora','fundo-cosmos') then
    if not coalesce(v_economia->'inventario' ? v_fundo,false) then v_fundo := null; end if;
  else v_fundo := null;
  end if;
  return jsonb_build_object('nome',v_nome,'fundo',v_fundo,'conquistas',v_conquistas);
end;
$$;
revoke all on function api_private.perfil_publico_aluno(uuid) from public, anon;
grant usage on schema api_private to authenticated;
grant execute on function api_private.perfil_publico_aluno(uuid) to authenticated;
create or replace function public.perfil_publico_aluno(p_usuario uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select api_private.perfil_publico_aluno($1); $$;
revoke all on function public.perfil_publico_aluno(uuid) from public, anon;
grant execute on function public.perfil_publico_aluno(uuid) to authenticated;
