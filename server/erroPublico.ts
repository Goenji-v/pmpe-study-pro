/** Nunca exponha mensagens internas do Supabase, Gemini ou do servidor ao navegador. */
export function mensagemErroPublica(status: number): string {
  if (status === 429) return "Muitas solicitações no momento. Aguarde e tente novamente.";
  if (status === 503) return "Serviço temporariamente indisponível. Tente novamente em instantes.";
  return "Não foi possível concluir esta operação agora. Tente novamente.";
}
