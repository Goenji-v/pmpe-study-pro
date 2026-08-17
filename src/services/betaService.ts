import { supabase } from "../lib/supabase";

export type CategoriaFeedbackBeta = "bug" | "visual" | "ideia" | "outro";

export type FeedbackBeta = {
  id: string;
  user_id: string;
  categoria: CategoriaFeedbackBeta;
  mensagem: string;
  pagina: string | null;
  viewport: string | null;
  app_version: string | null;
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

const VERSAO_BETA = "beta-v1";

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
    .select("id,user_id,categoria,mensagem,pagina,viewport,app_version,created_at")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackBeta[];
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
