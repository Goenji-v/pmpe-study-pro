-- Corrige o recálculo para permitir que tarefas marcadas como "puladas"
-- sejam novamente distribuídas em datas futuras.
-- Aplicado no Supabase em 2026-09-11.
--
-- A função principal já existe no projeto. Este patch altera somente as
-- verificações de duplicidade para que "pulado" tenha o mesmo efeito de
-- "reagendado" ao decidir se revisão, reforço ou conteúdo podem voltar ao plano.

do $$
declare
  v_sql text;
begin
  select pg_get_functiondef(
    'private.recalcular_cronograma_mentoria_core(uuid,date,integer,text,text)'::regprocedure
  ) into v_sql;

  v_sql := replace(
    v_sql,
    'ct.status<>''reagendado'' and ct.metadados->>''revisao_id''=r.id::text',
    'ct.status not in (''reagendado'',''pulado'') and ct.metadados->>''revisao_id''=r.id::text'
  );

  v_sql := replace(
    v_sql,
    'ct.reforco_id=r.id and ct.status<>''reagendado''',
    'ct.reforco_id=r.id and ct.status not in (''reagendado'',''pulado'')'
  );

  v_sql := replace(
    v_sql,
    'ct.user_id=p_user_id and ct.item_id=i.id and ct.status<>''reagendado'' and coalesce(ct.metadados->>''conteudo_principal'',''false'')=''true''',
    'ct.user_id=p_user_id and ct.item_id=i.id and ct.status not in (''reagendado'',''pulado'') and coalesce(ct.metadados->>''conteudo_principal'',''false'')=''true'''
  );

  execute v_sql;
end
$$;
