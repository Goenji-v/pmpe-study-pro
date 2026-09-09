-- Execute depois de SIMULADOS_OFICIAIS.sql e SIMULADOS_OFICIAIS_CORRECAO.sql.
-- O aluno não escreve diretamente em campos de ranking/resultado.
revoke insert, update, delete on public.simulados_oficiais_tentativas from authenticated;
drop policy if exists simulados_oficiais_tentativas_inserir on public.simulados_oficiais_tentativas;
drop policy if exists simulados_oficiais_tentativas_atualizar on public.simulados_oficiais_tentativas;

create or replace function public.iniciar_simulado_oficial(p_simulado_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_numero integer; v_ranking boolean; v_inicio timestamptz;
begin
  if not exists (select 1 from public.simulados_oficiais where id=p_simulado_id and status='publicado') then
    raise exception 'Simulado não encontrado ou não publicado.';
  end if;
  insert into public.simulados_oficiais_tentativas(simulado_id,usuario_id)
  values(p_simulado_id,auth.uid())
  returning id,numero_tentativa,conta_ranking,iniciada_em into v_id,v_numero,v_ranking,v_inicio;
  return jsonb_build_object('id',v_id,'numero_tentativa',v_numero,'conta_ranking',v_ranking,'iniciada_em',v_inicio);
end;
$$;
grant execute on function public.iniciar_simulado_oficial(uuid) to authenticated;
