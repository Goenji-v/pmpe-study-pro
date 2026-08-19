import { supabase } from "../lib/supabase";

export type NotificacaoInterna = {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  rota: string | null;
  feedback_id: string | null;
  lida: boolean;
  created_at: string;
};

export async function listarNotificacoes(limite = 40): Promise<NotificacaoInterna[]> {
  const { data, error } = await supabase
    .from("notificacoes")
    .select("id,user_id,tipo,titulo,mensagem,rota,feedback_id,lida,created_at")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw new Error(error.message);
  return (data ?? []) as NotificacaoInterna[];
}

export async function marcarNotificacaoLida(id: string) {
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function marcarTodasNotificacoesLidas() {
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true })
    .eq("lida", false);

  if (error) throw new Error(error.message);
}
