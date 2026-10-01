alter table public.erros_cliente
  drop constraint if exists erros_cliente_status_check;

alter table public.erros_cliente
  add constraint erros_cliente_status_check
  check (
    status = any (
      array[
        'aberto'::text,
        'resolvendo'::text,
        'resolvido'::text
      ]
    )
  );

update public.erros_cliente
   set status = 'resolvendo',
       resolvido_em = null
 where status = 'aberto';
