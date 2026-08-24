-- Study Pro — endurecimento da publicação de questões geradas por IA.
-- O cliente deixa de inserir diretamente no catálogo compartilhado.
-- Toda publicação passa por RPC SECURITY DEFINER com validação estrutural.

create or replace function public.publicar_questoes_ia(p_questoes jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_total integer := 0;
  v_inseridas integer := 0;
  v_alternativas_validas boolean;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;

  if jsonb_typeof(p_questoes) <> 'array' then
    raise exception 'Payload de questões inválido';
  end if;

  v_total := jsonb_array_length(p_questoes);
  if v_total < 1 or v_total > 60 then
    raise exception 'A quantidade deve ficar entre 1 e 60 questões';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_questoes)
  loop
    if btrim(coalesce(v_item->>'fingerprint', '')) = ''
      or btrim(coalesce(v_item->>'materia', '')) = ''
      or btrim(coalesce(v_item->>'materia_chave', '')) = ''
      or btrim(coalesce(v_item->>'assunto', '')) = ''
      or btrim(coalesce(v_item->>'assunto_chave', '')) = ''
      or btrim(coalesce(v_item->>'banca', '')) = ''
      or btrim(coalesce(v_item->>'banca_chave', '')) = ''
      or btrim(coalesce(v_item->>'enunciado', '')) = ''
      or btrim(coalesce(v_item->>'explicacao', '')) = ''
      or coalesce(v_item->>'resposta_correta_id', '') not in ('A', 'B', 'C', 'D', 'E')
      or coalesce(v_item->>'dificuldade', '') not in ('facil', 'media', 'dificil')
    then
      raise exception 'Questão IA incompleta ou inválida';
    end if;

    if jsonb_typeof(v_item->'alternativas') <> 'array'
      or jsonb_array_length(v_item->'alternativas') <> 5
    then
      raise exception 'Cada questão deve possuir exatamente cinco alternativas';
    end if;

    select
      count(*) = 5
      and count(distinct alternativa->>'id') = 5
      and bool_and((alternativa->>'id') in ('A', 'B', 'C', 'D', 'E'))
      and bool_and(btrim(coalesce(alternativa->>'texto', '')) <> '')
    into v_alternativas_validas
    from jsonb_array_elements(v_item->'alternativas') alternativa;

    if not coalesce(v_alternativas_validas, false) then
      raise exception 'Alternativas inválidas na questão IA';
    end if;

    insert into public.questoes_catalogo (
      concurso_alvo,
      edital_alvo,
      banca,
      materia_id,
      materia,
      materia_chave,
      modulo_id,
      modulo,
      assunto_id,
      assunto,
      assunto_chave,
      dificuldade,
      enunciado,
      alternativas,
      resposta_correta_id,
      explicacao,
      status,
      compatibilidade_edital,
      confianca_classificacao,
      fonte_nome,
      origem,
      banca_chave,
      criado_por,
      fingerprint
    ) values (
      left(coalesce(nullif(btrim(v_item->>'concurso_alvo'), ''), 'PMPE'), 120),
      left(coalesce(nullif(btrim(v_item->>'edital_alvo'), ''), 'PMPE'), 120),
      left(btrim(v_item->>'banca'), 120),
      nullif(btrim(v_item->>'materia_id'), ''),
      left(btrim(v_item->>'materia'), 200),
      left(btrim(v_item->>'materia_chave'), 200),
      nullif(btrim(v_item->>'modulo_id'), ''),
      nullif(left(btrim(v_item->>'modulo'), 200), ''),
      nullif(btrim(v_item->>'assunto_id'), ''),
      left(btrim(v_item->>'assunto'), 240),
      left(btrim(v_item->>'assunto_chave'), 240),
      v_item->>'dificuldade',
      left(btrim(v_item->>'enunciado'), 12000),
      v_item->'alternativas',
      v_item->>'resposta_correta_id',
      left(btrim(v_item->>'explicacao'), 12000),
      'ativa',
      'direta',
      'alta',
      'Gerada pela IA do Study Pro',
      'ia',
      left(btrim(v_item->>'banca_chave'), 120),
      auth.uid(),
      left(btrim(v_item->>'fingerprint'), 128)
    )
    on conflict (fingerprint) do nothing;

    get diagnostics v_inseridas = row_count;
    v_total := v_total + v_inseridas;
  end loop;

  return v_total - jsonb_array_length(p_questoes);
end;
$$;

revoke all on function public.publicar_questoes_ia(jsonb) from public;
grant execute on function public.publicar_questoes_ia(jsonb) to authenticated;

-- Usuários comuns não publicam diretamente no catálogo. O RPC acima faz a
-- validação e fixa status/origem/confiança no servidor. Administradores
-- continuam podendo inserir pela rotina editorial.
drop policy if exists "questoes_catalogo_inserir" on public.questoes_catalogo;
drop policy if exists "questoes_catalogo_usuario_inserir_ia" on public.questoes_catalogo;
drop policy if exists "questoes_catalogo_admin_inserir" on public.questoes_catalogo;
create policy "questoes_catalogo_admin_inserir"
on public.questoes_catalogo
for insert
to authenticated
with check ((select public.sou_admin()));
