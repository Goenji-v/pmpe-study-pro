-- Validação rápida pós-migration: não altera dados.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'simulados_oficiais',
    'simulados_oficiais_questoes',
    'simulados_oficiais_gabaritos',
    'simulados_oficiais_tentativas'
  )
order by table_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('iniciar_simulado_oficial', 'finalizar_simulado_oficial')
order by routine_name;
