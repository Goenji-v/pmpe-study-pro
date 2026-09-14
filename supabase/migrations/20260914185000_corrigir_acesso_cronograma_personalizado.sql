alter function public.minha_trilha_mentoria() security definer;
revoke all on function public.minha_trilha_mentoria() from public;
grant execute on function public.minha_trilha_mentoria() to authenticated;
