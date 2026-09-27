-- Torna explícito para o linter e para futuras manutenções:
-- eventos de pagamento são internos e nunca podem ser acessados pelo cliente.

drop policy if exists eventos_pagamento_bloqueio_cliente
  on public.eventos_pagamento;

create policy eventos_pagamento_bloqueio_cliente
on public.eventos_pagamento
for all
to anon, authenticated
using (false)
with check (false);
