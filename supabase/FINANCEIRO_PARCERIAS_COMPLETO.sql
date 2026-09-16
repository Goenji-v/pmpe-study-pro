-- Financeiro das parcerias: configuração de taxa, resumo do responsável e consolidado administrativo.

create or replace function public.admin_atualizar_valor_parceria(p_parceiro_id uuid, p_valor_aluno_centavos integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_nome text;
begin
  if auth.uid() is null or not public.sou_admin() then raise exception 'Acesso administrativo necessário.'; end if;
  if p_parceiro_id is null then raise exception 'Parceria obrigatória.'; end if;
  if p_valor_aluno_centavos is null or p_valor_aluno_centavos < 0 then raise exception 'Valor por aluno inválido.'; end if;
  update public.parceiros set valor_aluno_centavos = p_valor_aluno_centavos, atualizado_em = now() where id = p_parceiro_id returning nome into v_nome;
  if v_nome is null then raise exception 'Parceria não encontrada.'; end if;
  insert into public.auditoria_acesso(parceiro_id, ator_id, evento, detalhes)
  values(p_parceiro_id, auth.uid(), 'taxa_parceria_atualizada', jsonb_build_object('valor_aluno_centavos', p_valor_aluno_centavos));
  return jsonb_build_object('sucesso', true, 'parceiro_id', p_parceiro_id, 'parceiro_nome', v_nome, 'valor_aluno_centavos', p_valor_aluno_centavos);
end;
$$;
revoke all on function public.admin_atualizar_valor_parceria(uuid, integer) from public, anon;
grant execute on function public.admin_atualizar_valor_parceria(uuid, integer) to authenticated, service_role;

create or replace function public.resumo_financeiro_meu_parceiro()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_parceiro_id uuid; v_papel text; v_valor_unitario integer; v_alunos integer;
begin
  select pu.parceiro_id, pu.papel into v_parceiro_id, v_papel
  from public.parceiro_usuarios pu
  where pu.user_id = auth.uid() and pu.ativo
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end limit 1;
  if v_parceiro_id is null or v_papel <> 'proprietario' then raise exception 'Somente o responsável principal pode consultar o financeiro da parceria.'; end if;
  select p.valor_aluno_centavos into v_valor_unitario from public.parceiros p where p.id = v_parceiro_id;
  select count(*)::integer into v_alunos from public.licencas_acesso l
  where l.parceiro_id = v_parceiro_id and l.status = 'ativa' and l.inicio_em <= now() and (l.expira_em is null or l.expira_em > now());
  return jsonb_build_object('parceiro_id', v_parceiro_id, 'alunos_ativos', coalesce(v_alunos,0), 'valor_unitario_centavos', coalesce(v_valor_unitario,0), 'estimativa_atual_centavos', coalesce(v_alunos,0)*coalesce(v_valor_unitario,0));
end;
$$;
revoke all on function public.resumo_financeiro_meu_parceiro() from public, anon;
grant execute on function public.resumo_financeiro_meu_parceiro() to authenticated, service_role;

create or replace function public.listar_financeiro_geral_admin(p_ano integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_ano integer := coalesce(p_ano, extract(year from now())::integer);
begin
  if auth.uid() is null or not public.sou_admin() then raise exception 'Acesso administrativo necessário.'; end if;
  if v_ano < 2000 or v_ano > 2200 then raise exception 'Ano inválido.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',f.id,'parceiro_id',f.parceiro_id,'parceiro_nome',p.nome,'competencia',f.competencia,
    'alunos_ativos',f.alunos_ativos,'valor_unitario_centavos',f.valor_unitario_centavos,
    'valor_base_centavos',f.valor_total_centavos,'ajuste_centavos',f.ajuste_centavos,
    'valor_devido_centavos',greatest(0,f.valor_total_centavos+f.ajuste_centavos),'status',f.status,
    'vencimento_em',f.vencimento_em,'pago_em',f.pago_em,'observacao',f.observacao,
    'fechado_em',f.fechado_em,'atualizado_em',f.atualizado_em
  ) order by f.competencia desc,p.nome)
  from public.faturamento_parceiros f join public.parceiros p on p.id=f.parceiro_id
  where extract(year from f.competencia)::integer=v_ano),'[]'::jsonb);
end;
$$;
revoke all on function public.listar_financeiro_geral_admin(integer) from public, anon;
grant execute on function public.listar_financeiro_geral_admin(integer) to authenticated, service_role;

-- As RPCs financeiras anteriores já validavam autenticação internamente; removemos também a permissão REST anônima explícita.
revoke execute on function public.atualizar_faturamento_parceiro_admin(uuid, text, integer, date, text) from anon;
revoke execute on function public.fechar_faturamento_parceiro_admin(uuid, date, integer, date, text) from anon;
revoke execute on function public.listar_faturamento_parceiro_admin(uuid) from anon;
revoke execute on function public.listar_meu_faturamento_parceiro() from anon;
grant execute on function public.atualizar_faturamento_parceiro_admin(uuid, text, integer, date, text) to authenticated, service_role;
grant execute on function public.fechar_faturamento_parceiro_admin(uuid, date, integer, date, text) to authenticated, service_role;
grant execute on function public.listar_faturamento_parceiro_admin(uuid) to authenticated, service_role;
grant execute on function public.listar_meu_faturamento_parceiro() to authenticated, service_role;