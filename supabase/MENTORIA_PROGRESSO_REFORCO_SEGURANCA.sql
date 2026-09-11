-- Endurecimento dos grants das tabelas de progresso/reforço.
-- O projeto possui default privileges amplos; por isso revogamos antes de conceder o mínimo.

revoke all on public.progresso_trilha_mentoria from anon, authenticated;
grant select, insert, update, delete on public.progresso_trilha_mentoria to authenticated;

revoke all on public.reforcos_mentoria from anon, authenticated;
grant select, insert, delete on public.reforcos_mentoria to authenticated;
grant update (status, concluido_em, atualizado_em) on public.reforcos_mentoria to authenticated;
