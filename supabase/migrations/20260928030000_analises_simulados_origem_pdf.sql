-- Permite diferenciar simulados analisados a partir de PDF dos simulados gerados por IA.
alter table public.analises_simulados
  drop constraint if exists analises_simulados_origem_check;

alter table public.analises_simulados
  add constraint analises_simulados_origem_check
  check (origem in ('ia', 'oficial', 'pdf'));
