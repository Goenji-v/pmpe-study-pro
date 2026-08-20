-- Proteção adicional para bancos que já possuem questoes_catalogo.
-- O script não apaga dados. Se encontrar duplicatas, interrompe antes de criar o índice.

do $$
begin
  if exists (
    select 1
    from public.questoes_catalogo
    where origem = 'prova_oficial'
      and numero_original is not null
    group by
      lower(btrim(concurso_alvo)),
      lower(btrim(edital_alvo)),
      lower(btrim(coalesce(concurso_origem, ''))),
      lower(btrim(coalesce(cargo_origem, ''))),
      coalesce(ano_origem, 0),
      lower(btrim(banca)),
      numero_original
    having count(*) > 1
  ) then
    raise exception 'Existem questões oficiais duplicadas. Revise os grupos repetidos antes de criar o índice único.';
  end if;
end
$$;

create unique index if not exists questoes_catalogo_prova_oficial_unica_idx
  on public.questoes_catalogo (
    lower(btrim(concurso_alvo)),
    lower(btrim(edital_alvo)),
    lower(btrim(coalesce(concurso_origem, ''))),
    lower(btrim(coalesce(cargo_origem, ''))),
    coalesce(ano_origem, 0),
    lower(btrim(banca)),
    numero_original
  )
  where origem = 'prova_oficial' and numero_original is not null;
