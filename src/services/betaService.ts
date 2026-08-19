import { supabase } from "../lib/supabase";

export type CategoriaFeedbackBeta = "bug" | "visual" | "ideia" | "outro";
export type StatusFeedbackBeta = "em_analise" | "aprovado" | "concluido" | "rejeitado";

export type FeedbackBeta = {
  id: string;
  user_id: string;
  categoria: CategoriaFeedbackBeta;
  mensagem: string;
  pagina: string | null;
  viewport: string | null;
  app_version: string | null;
  status: StatusFeedbackBeta;
  resposta_admin: string | null;
  atualizado_em: string;
  resolvido_em: string | null;
  created_at: string;
};

export type ErroClienteBeta = {
  id: string;
  user_id: string;
  incident_id: string;
  origem: string;
  mensagem: string;
  rota: string | null;
  viewport: string | null;
  app_version: string | null;
  created_at: string;
};

const VERSAO_BETA = "beta-v2";

function viewportAtual() {
  if (typeof window === "undefined") return null;
  return `${window.innerWidth}x${window.innerHeight}`;
}

export async function enviarFeedbackBeta(
  userId: string,
  categoria: CategoriaFeedbackBeta,
  mensagem: string
) {
  const texto = mensagem.trim();
  if (texto.length < 3) {
    throw new Error("Descreva o problema ou sugestão com um pouco mais de detalhe.");
  }

  const { error } = await supabase.from("beta_feedback").insert({
    user_id: userId,
    categoria,
    mensagem: texto.slice(0, 2000),
    status: "em_analise",
    pagina:
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 1000) : null,
    viewport: viewportAtual(),
    app_version: VERSAO_BETA,
  });

  if (error) {
    throw new Error(`Não foi possível enviar o feedback: ${error.message}`);
  }
}

export async function listarFeedbackBeta(limite = 30): Promise<FeedbackBeta[]> {
  const { data, error } = await supabase
    .from("beta_feedback")
    .select("id,user_id,categoria,mensagem,pagina,viewport,app_version,status,resposta_admin,atualizado_em,resolvido_em,created_at")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackBeta[];
}

export async function atualizarStatusFeedbackBeta(
  feedback: FeedbackBeta,
  status: StatusFeedbackBeta,
  respostaAdmin = ""
) {
  const agora = new Date().toISOString();
  const resposta = respostaAdmin.trim().slice(0, 1500) || null;
  const resolvido = status === "concluido" || status === "rejeitado";

  const { error } = await supabase
    .from("beta_feedback")
    .update({
      status,
      resposta_admin: resposta,
      atualizado_em: agora,
      resolvido_em: resolvido ? agora : null,
    })
    .eq("id", feedback.id);

  if (error) throw new Error(`Não foi possível atualizar o feedback: ${error.message}`);

  if (status !== "em_analise") {
    const conteudo = mensagemStatus(status, resposta);
    const { error: erroNotificacao } = await supabase.from("notificacoes").insert({
      user_id: feedback.user_id,
      tipo: "feedback",
      titulo: conteudo.titulo,
      mensagem: conteudo.mensagem,
      rota: "/",
      feedback_id: feedback.id,
    });

    if (erroNotificacao) {
      throw new Error(`Feedback atualizado, mas a notificação falhou: ${erroNotificacao.message}`);
    }
  }
}

export async function listarErrosClienteBeta(limite = 30): Promise<ErroClienteBeta[]> {
  const { data, error } = await supabase
    .from("erros_cliente")
    .select("id,user_id,incident_id,origem,mensagem,rota,viewport,app_version,created_at")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw new Error(error.message);
  return (data ?? []) as ErroClienteBeta[];
}

function mensagemStatus(status: StatusFeedbackBeta, resposta: string | null) {
  const complemento = resposta ? ` ${resposta}` : "";

  if (status === "aprovado") {
    return {
      titulo: "Feedback aprovado",
      mensagem: `Seu relato foi analisado e entrou na fila de correção.${complemento}`,
    };
  }

  if (status === "concluido") {
    return {
      titulo: "Feedback concluído",
      mensagem: `A solicitação que você enviou foi concluída.${complemento}`,
    };
  }

  return {
    titulo: "Feedback analisado",
    mensagem: `Seu relato foi analisado e não será aplicado neste momento.${complemento}`,
  };
}
