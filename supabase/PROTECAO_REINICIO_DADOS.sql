-- Impede uma aba/aparelho com estado anterior de recriar dados após o titular zerar a conta.
create or replace function public.proteger_geracao_reinicio_configuracoes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  geracao_anterior text := old.dados #>> '{appState,configuracoes,dadosReiniciadosEm}';
  geracao_nova text := new.dados #>> '{appState,configuracoes,dadosReiniciadosEm}';
begin
  if geracao_anterior is not null
     and (geracao_nova is null or geracao_nova < geracao_anterior) then
    raise exception using
      errcode = '23514',
      message = 'A gravação pertence a uma versão anterior ao reinício da conta.';
  end if;
  return new;
end;
$$;

revoke all on function public.proteger_geracao_reinicio_configuracoes() from public, anon, authenticated;

drop trigger if exists configuracoes_proteger_geracao_reinicio on public.configuracoes;
create trigger configuracoes_proteger_geracao_reinicio
before update of dados on public.configuracoes
for each row
execute function public.proteger_geracao_reinicio_configuracoes();
