import { supabase } from "../lib/supabase";

export type StatusAssinaturaUsuario =
  | "pendente"
  | "teste"
  | "ativa"
  | "inadimplente"
  | "cancelada"
  | "expirada";

export type AssinaturaUsuario = {
  id: string;
  planoCodigo: string;
  provedor: string | null;
  status: StatusAssinaturaUsuario;
  periodoInicio: string | null;
  periodoFim: string | null;
  cancelarNoFim: boolean;
};

export type PagamentoUsuario = {
  id: string;
  valorCentavos: number;
  moeda: string;
  status: "pendente" | "processando" | "pago" | "falhou" | "cancelado" | "estornado";
  metodo: string | null;
  pagoEm: string | null;
  criadoEm: string;
};

export async function carregarMinhaAssinatura(): Promise<AssinaturaUsuario | null> {
  const { data, error } = await supabase
    .from("assinaturas_usuario")
    .select(
      "id, plano_codigo, provedor, status, periodo_inicio, periodo_fim, cancelar_no_fim"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível consultar a assinatura: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: String(data.id),
    planoCodigo: String(data.plano_codigo),
    provedor: typeof data.provedor === "string" ? data.provedor : null,
    status: String(data.status) as StatusAssinaturaUsuario,
    periodoInicio: typeof data.periodo_inicio === "string" ? data.periodo_inicio : null,
    periodoFim: typeof data.periodo_fim === "string" ? data.periodo_fim : null,
    cancelarNoFim: data.cancelar_no_fim === true,
  };
}

export async function listarMeusPagamentos(): Promise<PagamentoUsuario[]> {
  const { data, error } = await supabase
    .from("pagamentos_usuario")
    .select("id, valor_centavos, moeda, status, metodo, pago_em, criado_em")
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Não foi possível consultar os pagamentos: ${error.message}`);
  }

  return (data ?? []).map((item) => ({
    id: String(item.id),
    valorCentavos: Number(item.valor_centavos ?? 0),
    moeda: String(item.moeda ?? "BRL"),
    status: String(item.status) as PagamentoUsuario["status"],
    metodo: typeof item.metodo === "string" ? item.metodo : null,
    pagoEm: typeof item.pago_em === "string" ? item.pago_em : null,
    criadoEm: String(item.criado_em),
  }));
}
