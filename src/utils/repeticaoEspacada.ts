export type AvaliacaoSRS = "dificil" | "medio" | "facil";

export type EstadoSRS = {
  repeticoes: number;
  intervaloDias: number;
  fatorFacilidade: number;
  proximaRevisaoEm: string;
};

export function calcularProximaRevisaoSRS(
  atual: Partial<EstadoSRS> | null | undefined,
  avaliacao: AvaliacaoSRS,
  agora = new Date()
): EstadoSRS {
  const repeticoesAtuais = Math.max(0, Math.floor(atual?.repeticoes ?? 0));
  const intervaloAtual = Math.max(0, Math.floor(atual?.intervaloDias ?? 0));
  const fatorAtual = limitar(atual?.fatorFacilidade ?? 2.5, 1.3, 3.2);

  let repeticoes: number;
  let intervaloDias: number;
  let fatorFacilidade: number;

  if (avaliacao === "dificil") {
    repeticoes = 0;
    intervaloDias = 1;
    fatorFacilidade = limitar(fatorAtual - 0.2, 1.3, 3.2);
  } else if (avaliacao === "facil") {
    repeticoes = repeticoesAtuais + 1;
    intervaloDias =
      repeticoes === 1
        ? 3
        : repeticoes === 2
          ? 7
          : Math.max(7, Math.round(Math.max(1, intervaloAtual) * (fatorAtual + 0.15)));
    fatorFacilidade = limitar(fatorAtual + 0.1, 1.3, 3.2);
  } else {
    repeticoes = repeticoesAtuais + 1;
    intervaloDias =
      repeticoes === 1
        ? 1
        : repeticoes === 2
          ? 3
          : Math.max(3, Math.round(Math.max(1, intervaloAtual) * fatorAtual));
    fatorFacilidade = limitar(fatorAtual - 0.05, 1.3, 3.2);
  }

  const proxima = new Date(agora);
  proxima.setDate(proxima.getDate() + intervaloDias);

  return {
    repeticoes,
    intervaloDias,
    fatorFacilidade: Math.round(fatorFacilidade * 100) / 100,
    proximaRevisaoEm: proxima.toISOString(),
  };
}

function limitar(valor: number, minimo: number, maximo: number) {
  if (!Number.isFinite(valor)) return minimo;
  return Math.min(maximo, Math.max(minimo, valor));
}
