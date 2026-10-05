create index if not exists eventos_pagamento_assinatura_id_idx
  on public.eventos_pagamento (assinatura_id);

create index if not exists eventos_pagamento_pagamento_id_idx
  on public.eventos_pagamento (pagamento_id);

create index if not exists eventos_pagamento_user_id_idx
  on public.eventos_pagamento (user_id);

create index if not exists pagamentos_usuario_assinatura_id_idx
  on public.pagamentos_usuario (assinatura_id);
