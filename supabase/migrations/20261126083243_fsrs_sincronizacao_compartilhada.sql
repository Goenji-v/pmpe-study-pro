begin;

create schema if not exists study_pro_internal;
create table study_pro_internal.fsrs_pilotos (
  usuario uuid primary key references auth.users(id),
  ativo boolean not null default false
);
create table study_pro_internal.fsrs_diarios (
  usuario uuid not null references auth.users(id),
  epoca text not null,
  revisao bigint not null default 0,
  revisao_eventos bigint not null default 0,
  eventos jsonb not null default '[]'::jsonb,
  checkpoint jsonb,
  checkpoint_revisao_eventos bigint,
  primary key (usuario, epoca)
);
alter table study_pro_internal.fsrs_pilotos enable row level security;
alter table study_pro_internal.fsrs_diarios enable row level security;
create policy fsrs_diario_proprietario on study_pro_internal.fsrs_diarios
  for select to authenticated using (usuario = (select auth.uid()));
revoke all on study_pro_internal.fsrs_pilotos, study_pro_internal.fsrs_diarios from public, anon, authenticated;

-- A API expõe somente o invólucro no schema public.
create function study_pro_internal.sincronizar_fsrs_v1(
  p_usuario uuid, p_epoca text, p_eventos jsonb, p_revisao bigint,
  p_revisao_eventos bigint, p_checkpoint jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  dono uuid := auth.uid();
  legado jsonb;
  revisao_legado bigint;
  atual study_pro_internal.fsrs_diarios%rowtype;
  reunidos jsonb;
  rev_eventos bigint;
  houve_eventos boolean;
  salvar_checkpoint boolean := false;
  resultado text := 'ok';
begin
  if dono is null or p_usuario is distinct from dono then
    raise exception 'Escopo FSRS não autorizado' using errcode = '42501';
  end if;
  perform 1 from study_pro_internal.fsrs_pilotos where usuario = dono and ativo for share;
  if not found then
    raise exception 'Escopo FSRS não autorizado' using errcode = '42501';
  end if;

  select c.dados->'appState' into legado from public.configuracoes c
    where c.user_id = dono for share;
  if not found or jsonb_typeof(legado) is distinct from 'object' then
    raise exception 'Inicialize a sincronização do estado legado antes do FSRS' using errcode = '40001';
  end if;
  if p_epoca is distinct from coalesce(nullif(legado#>>'{configuracoes,dadosReiniciadosEm}', ''), 'inicial') then
    raise exception 'Época FSRS obsoleta' using errcode = '40001';
  end if;
  revisao_legado := coalesce((legado->>'syncRevision')::bigint, 0);

  if jsonb_typeof(p_eventos) is distinct from 'array' then
    raise exception 'Lote FSRS inválido' using errcode = '22023';
  end if;
  if jsonb_array_length(p_eventos) > 250 or octet_length(p_eventos::text) > 1048576 then
    raise exception 'Lote FSRS excede o limite' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_eventos) e
    where jsonb_typeof(e) is distinct from 'object'
      or e#>>'{evento,usuarioId}' is distinct from dono::text
      or jsonb_typeof(e->'evidencia') is distinct from 'object'
      or jsonb_typeof(e#>'{evento,conteudo}') is distinct from 'object'
      or jsonb_typeof(e#>'{evento,ocorrenciaId}') is distinct from 'string'
      or jsonb_typeof(e#>'{evento,ocorridoEm}') is distinct from 'string'
      or e#>>'{evento,origem}' is null or e#>>'{evento,origem}' not in ('sessao','tentativa','flashcard')
      or e#>>'{evento,tipo}' is null or e#>>'{evento,tipo}' not in ('estudo','recuperacao')
      or e#>>'{evidencia,modo}' is null or e#>>'{evidencia,modo}' not in ('passivo','recuperacao')
      or jsonb_typeof(e#>'{evento,conteudo,materiaId}') is distinct from 'string'
      or jsonb_typeof(e#>'{evento,conteudo,assuntoId}') is distinct from 'string') then
    raise exception 'Evento FSRS inválido para este usuário' using errcode = '22023';
  end if;

  insert into study_pro_internal.fsrs_diarios (usuario, epoca) values (dono, p_epoca)
    on conflict do nothing;
  select * into strict atual from study_pro_internal.fsrs_diarios
    where usuario = dono and epoca = p_epoca for update;
  select coalesce(jsonb_agg(e order by e::text collate "C"), '[]'::jsonb) into reunidos
    from (select distinct e from jsonb_array_elements(atual.eventos || p_eventos) e) unicos;

  if octet_length(reunidos::text) > 8388608 then
    raise exception 'Diário FSRS excede capacidade desta versão' using errcode = '54000';
  end if;
  houve_eventos := atual.eventos is distinct from reunidos;
  rev_eventos := atual.revisao_eventos + case when houve_eventos then 1 else 0 end;
  if p_checkpoint is not null then
    if jsonb_typeof(p_checkpoint) is distinct from 'object'
      or octet_length(p_checkpoint::text) > 16777216
      or p_checkpoint#>>'{escopo,usuarioId}' is distinct from dono::text
      or p_checkpoint#>>'{escopo,epoca}' is distinct from p_epoca
      or p_checkpoint->>'esquema' is distinct from '1'
      or p_checkpoint#>>'{diario,versao}' is distinct from 'ts-fsrs@6.0.0/FSRS-7/v1'
      or jsonb_typeof(p_checkpoint#>'{diario,retencao}') is distinct from 'number'
      or jsonb_typeof(p_checkpoint->'avaliados') is distinct from 'array'
      or jsonb_typeof(p_checkpoint->'estados') is distinct from 'array'
      or jsonb_typeof(p_checkpoint->'agendamentos') is distinct from 'array'
      or jsonb_typeof(p_checkpoint#>'{diario,observacoes}') is distinct from 'array' then
      raise exception 'Checkpoint FSRS inválido' using errcode = '22023';
    end if;
    if (p_checkpoint#>>'{diario,retencao}')::numeric not between 0.7 and 0.97
      or exists (select 1 from jsonb_array_elements(p_checkpoint->'agendamentos') item
        where jsonb_typeof(item) is distinct from 'object') then
      raise exception 'Projeção FSRS inválida' using errcode = '22023';
    end if;
    if p_checkpoint->>'revisaoLegado' is distinct from revisao_legado::text
       or coalesce(p_checkpoint->>'calculadoPara', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or (atual.checkpoint->>'calculadoPara') collate "C" > (p_checkpoint->>'calculadoPara') collate "C"
       or not (reunidos @> (p_checkpoint#>'{diario,observacoes}') and
               reunidos <@ (p_checkpoint#>'{diario,observacoes}')) then
      resultado := 'conflito';
    elsif p_checkpoint = atual.checkpoint and atual.checkpoint_revisao_eventos = rev_eventos then
      null; -- Retry após confirmação perdida.
    elsif p_revisao is distinct from atual.revisao or p_revisao_eventos is distinct from rev_eventos then
      resultado := 'conflito';
    else
      salvar_checkpoint := true;
    end if;
  end if;
  if houve_eventos or salvar_checkpoint then
    update study_pro_internal.fsrs_diarios set eventos = reunidos, revisao_eventos = rev_eventos,
      revisao = atual.revisao + 1,
      checkpoint = case when salvar_checkpoint then p_checkpoint else atual.checkpoint end,
      checkpoint_revisao_eventos = case when salvar_checkpoint then rev_eventos else atual.checkpoint_revisao_eventos end
      where usuario = dono and epoca = p_epoca returning * into strict atual;
  end if;
  return jsonb_build_object('resultado', resultado, 'revisao', atual.revisao,
    'revisaoEventos', atual.revisao_eventos, 'revisaoLegado', revisao_legado, 'eventos', atual.eventos,
    'checkpoint', case when atual.checkpoint_revisao_eventos = atual.revisao_eventos
      and atual.checkpoint->>'revisaoLegado' = revisao_legado::text then atual.checkpoint end);
end
$fn$;

create function public.sincronizar_fsrs_v1(
  p_usuario uuid, p_epoca text, p_eventos jsonb, p_revisao bigint,
  p_revisao_eventos bigint, p_checkpoint jsonb
) returns jsonb
language sql security invoker set search_path = ''
as $fn$
  select study_pro_internal.sincronizar_fsrs_v1(p_usuario, p_epoca, p_eventos, p_revisao, p_revisao_eventos, p_checkpoint)
$fn$;

grant usage on schema study_pro_internal to authenticated;
revoke all on function study_pro_internal.sincronizar_fsrs_v1(uuid,text,jsonb,bigint,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.sincronizar_fsrs_v1(uuid,text,jsonb,bigint,bigint,jsonb) from public, anon, authenticated;
grant execute on function study_pro_internal.sincronizar_fsrs_v1(uuid,text,jsonb,bigint,bigint,jsonb) to authenticated;
grant execute on function public.sincronizar_fsrs_v1(uuid,text,jsonb,bigint,bigint,jsonb) to authenticated;

commit;
