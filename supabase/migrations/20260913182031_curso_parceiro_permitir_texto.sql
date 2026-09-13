alter table public.curso_parceiro_aulas
  drop constraint if exists curso_parceiro_aulas_tipo_check;

alter table public.curso_parceiro_aulas
  add constraint curso_parceiro_aulas_tipo_check
  check (tipo = any (array['video'::text, 'material'::text, 'link'::text, 'texto'::text]));
