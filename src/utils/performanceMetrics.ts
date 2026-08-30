export type NomeMetricaPerformance = "LCP" | "CLS" | "INP" | "TTFB";
export type ClassificacaoPerformance = "bom" | "atencao" | "ruim";

const LIMITES: Record<NomeMetricaPerformance, [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  TTFB: [800, 1800],
};

export function classificarMetrica(metrica: NomeMetricaPerformance, valor: number): ClassificacaoPerformance {
  const [bom, ruim] = LIMITES[metrica];
  if (valor <= bom) return "bom";
  if (valor <= ruim) return "atencao";
  return "ruim";
}

export function calcularPercentil(valores: number[], percentil = 0.75) {
  const validos = valores.filter(Number.isFinite).sort((a, b) => a - b);
  if (validos.length === 0) return null;
  const indice = Math.min(validos.length - 1, Math.max(0, Math.ceil(validos.length * percentil) - 1));
  return validos[indice];
}

export function rotuloMetrica(metrica: NomeMetricaPerformance) {
  if (metrica === "LCP") return "LCP · conteúdo principal";
  if (metrica === "CLS") return "CLS · estabilidade visual";
  if (metrica === "INP") return "INP · resposta ao toque";
  return "TTFB · resposta inicial";
}

export function formatarValorMetrica(metrica: NomeMetricaPerformance, valor: number | null) {
  if (valor === null) return "—";
  if (metrica === "CLS") return valor.toFixed(3);
  return `${Math.round(valor)} ms`;
}
