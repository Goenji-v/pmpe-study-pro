export type RascunhoTreinoRedacao = {
  tema: string;
  objetivo: string;
  observacao: string;
  missaoId?: string;
  semana?: number;
  dia?: number;
  atualizadoEm: string;
};

export function criarRascunhoTreinoRedacao(params: {
  tema: string;
  objetivo: string;
  observacao: string;
  missaoId?: string;
  semana?: number;
  dia?: number;
  agora?: Date;
}): RascunhoTreinoRedacao {
  const agora = params.agora ?? new Date();

  return {
    tema: params.tema,
    objetivo: params.objetivo,
    observacao: params.observacao,
    missaoId: textoOpcional(params.missaoId),
    semana: inteiroPositivo(params.semana),
    dia: inteiroPositivo(params.dia),
    atualizadoEm: agora.toISOString(),
  };
}

export function normalizarRascunhoTreinoRedacao(
  valor: unknown
): RascunhoTreinoRedacao | null {
  if (!valor || typeof valor !== "object") return null;

  const dados = valor as Record<string, unknown>;
  const tema = texto(dados.tema);
  const objetivo = texto(dados.objetivo);
  const observacao = texto(dados.observacao);
  const atualizadoEm = texto(dados.atualizadoEm);

  if (!tema && !objetivo && !observacao) return null;

  return {
    tema,
    objetivo,
    observacao,
    missaoId: textoOpcional(dados.missaoId),
    semana: inteiroPositivo(dados.semana),
    dia: inteiroPositivo(dados.dia),
    atualizadoEm: dataIsoValida(atualizadoEm)
      ? atualizadoEm
      : new Date(0).toISOString(),
  };
}

export function rascunhoTreinoRedacaoTemConteudo(
  rascunho: Pick<
    RascunhoTreinoRedacao,
    "tema" | "objetivo" | "observacao"
  >
) {
  return Boolean(
    rascunho.tema.trim() ||
    rascunho.objetivo.trim() ||
    rascunho.observacao.trim()
  );
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function textoOpcional(valor: unknown) {
  const valorTexto = texto(valor).trim();
  return valorTexto || undefined;
}

function inteiroPositivo(valor: unknown) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0
    ? numero
    : undefined;
}

function dataIsoValida(valor: string) {
  if (!valor) return false;
  const data = new Date(valor);
  return !Number.isNaN(data.getTime());
}
