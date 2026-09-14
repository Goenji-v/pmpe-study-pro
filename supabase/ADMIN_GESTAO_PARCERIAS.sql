-- Administração da parceria: o Study Pro cria parceria/turmas e autoriza o responsável.

create or replace function public.admin_listar_parcerias()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.sou_admin() then
    raise exception 'Acesso administrativo necessário.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'nome', p.nome,
        'slug', p.slug,
        'status', p.status,
        'valor_aluno_centavos', p.valor_aluno_centavos,
        'turmas', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', t.id,
              'nome', t.nome,
              'codigo', t.codigo,
              'inicia_em', t.inicia_em,
              'encerra_em', t.encerra_em,
              'ativa', t.ativa
            ) order by t.criado_em desc
          )
          from public.turmas t
          where t.parceiro_id = p.id
        ), '[]'::jsonb),
        'usuarios', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'user_id', pu.user_id,
              'nome', coalesce(pf.nome, 'Usuário'),
              'email', coalesce(pf.email, au.email, ''),
              'papel', pu.papel,
              'ativo', pu.ativo
            ) order by coalesce(pf.nome, au.email, '')
          )
          from public.parceiro_usuarios pu
          left join public.perfis pf on pf.id = pu.user_id
          left join auth.users au on au.id = pu.user_id
          where pu.parceiro_id = p.id
        ), '[]'::jsonb)
      ) order by p.criado_em desc
    )
    from public.parceiros p
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_listar_parcerias() to authenticated;

create or replace function public.admin_criar_parceria(
  p_nome text,
  p_slug text,
  p_valor_aluno_centavos integer default 2000
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_nome text := trim(coalesce(p_nome, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if auth.uid() is null or not public.sou_admin() then
    raise exception 'Acesso administrativo necessário.';
  end if;
  if length(v_nome) < 2 or length(v_nome) > 160 then
    raise exception 'Nome da parceria inválido.';
  end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Identificador da parceria inválido.';
  end if;
  if p_valor_aluno_centavos < 0 then
    raise exception 'Valor por aluno inválido.';
  end if;

  insert into public.parceiros(nome, slug, valor_aluno_centavos, criado_por)
  values(v_nome, v_slug, p_valor_aluno_centavos, auth.uid())
  returning id into v_id;

  insert into public.auditoria_acesso(parceiro_id, ator_id, evento, detalhes)
  values(v_id, auth.uid(), 'parceiro_criado', jsonb_build_object('nome', v_nome));

  return v_id;
exception
  when unique_violation then
    raise exception 'Já existe uma parceria com esse identificador.';
end;
$$;

grant execute on function public.admin_criar_parceria(text, text, integer) to authenticated;

create or replace function public.admin_criar_turma_parceiro(
  p_parceiro_id uuid,
  p_nome text,
  p_codigo text default null,
  p_inicia_em date default null,
  p_encerra_em date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_nome text := trim(coalesce(p_nome, ''));
  v_codigo text := nullif(trim(coalesce(p_codigo, '')), '');
begin
  if auth.uid() is null or not public.sou_admin() then
    raise exception 'Acesso administrativo necessário.';
  end if;
  if not exists(select 1 from public.parceiros where id = p_parceiro_id) then
    raise exception 'Parceria não encontrada.';
  end if;
  if length(v_nome) < 2 or length(v_nome) > 160 then
    raise exception 'Nome da turma inválido.';
  end if;
  if p_inicia_em is not null and p_encerra_em is not null and p_encerra_em < p_inicia_em then
    raise exception 'A data de encerramento deve ser posterior ao início.';
  end if;

  insert into public.turmas(parceiro_id, nome, codigo, inicia_em, encerra_em)
  values(p_parceiro_id, v_nome, v_codigo, p_inicia_em, p_encerra_em)
  returning id into v_id;

  insert into public.auditoria_acesso(parceiro_id, ator_id, evento, detalhes)
  values(p_parceiro_id, auth.uid(), 'turma_criada', jsonb_build_object('turma_id', v_id, 'nome', v_nome));

  return v_id;
exception
  when unique_violation then
    raise exception 'Já existe uma turma com esse código nesta parceria.';
end;
$$;

grant execute on function public.admin_criar_turma_parceiro(uuid, text, text, date, date) to authenticated;

create or replace function public.admin_definir_usuario_parceiro(
  p_parceiro_id uuid,
  p_email text,
  p_papel text default 'professor',
  p_ativo boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null or not public.sou_admin() then
    raise exception 'Acesso administrativo necessário.';
  end if;
  if p_papel not in ('proprietario', 'gestor', 'professor') then
    raise exception 'Papel inválido.';
  end if;
  if not exists(select 1 from public.parceiros where id = p_parceiro_id) then
    raise exception 'Parceria não encontrada.';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(coalesce(u.email, '')) = v_email
  limit 1;

  if v_user_id is null then
    raise exception 'Nenhuma conta encontrada com esse e-mail. O usuário precisa criar a conta primeiro.';
  end if;

  insert into public.parceiro_usuarios(parceiro_id, user_id, papel, ativo)
  values(p_parceiro_id, v_user_id, p_papel, p_ativo)
  on conflict (parceiro_id, user_id)
  do update set papel = excluded.papel, ativo = excluded.ativo;

  insert into public.auditoria_acesso(parceiro_id, ator_id, usuario_afetado_id, evento, detalhes)
  values(
    p_parceiro_id,
    auth.uid(),
    v_user_id,
    case when p_ativo then 'parceiro_usuario_autorizado' else 'parceiro_usuario_desativado' end,
    jsonb_build_object('papel', p_papel)
  );

  return v_user_id;
end;
$$;

grant execute on function public.admin_definir_usuario_parceiro(uuid, text, text, boolean) to authenticated;

create or replace function public.admin_atualizar_turma_parceiro(
  p_turma_id uuid,
  p_nome text,
  p_ativa boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma public.turmas%rowtype;
  v_nome text := trim(coalesce(p_nome, ''));
begin
  if auth.uid() is null or not public.sou_admin() then
    raise exception 'Acesso administrativo necessário.';
  end if;
  if length(v_nome) < 2 or length(v_nome) > 160 then
    raise exception 'Nome da turma inválido.';
  end if;

  select * into v_turma from public.turmas where id = p_turma_id;
  if not found then raise exception 'Turma não encontrada.'; end if;

  update public.turmas
  set nome = v_nome,
      ativa = p_ativa,
      atualizado_em = now()
  where id = p_turma_id;

  insert into public.auditoria_acesso(parceiro_id, ator_id, evento, detalhes)
  values(v_turma.parceiro_id, auth.uid(), 'turma_atualizada', jsonb_build_object('turma_id', p_turma_id, 'nome', v_nome, 'ativa', p_ativa));
end;
$$;

grant execute on function public.admin_atualizar_turma_parceiro(uuid, text, boolean) to authenticated;

-- Corrige também a leitura do parceiro pelo aluno: a política antiga comparava parceiro_id com o id da licença.
drop policy if exists parceiros_leitura_autorizada on public.parceiros;
create policy parceiros_leitura_autorizada on public.parceiros
for select
using (
  public.sou_admin()
  or private.sou_gestor_parceiro(id)
  or exists (
    select 1
    from public.licencas_acesso l
    where l.parceiro_id = parceiros.id
      and l.user_id = auth.uid()
  )
);
