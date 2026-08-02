# Instalação do módulo administrativo

1. Publique/abra o projeto normalmente.
2. No Supabase, abra **SQL Editor**.
3. Execute primeiro `supabase/GAMIFICACAO_RANKING.sql`, caso ainda não tenha executado.
4. Execute `supabase/ADMINISTRACAO.sql`.
5. Abra **Authentication > Users** e copie o UUID da sua conta.
6. Execute no SQL Editor, substituindo o valor:

```sql
insert into public.administradores (user_id)
values ('SEU-UUID-AQUI')
on conflict (user_id) do nothing;
```

7. Saia e entre novamente no site.
8. O item **Administração** aparecerá no grupo Sistema.

A página não usa a chave `service_role` no navegador. O acesso a `auth.users` é feito por RPC `security definer`, que verifica se o usuário atual está cadastrado em `public.administradores`.
