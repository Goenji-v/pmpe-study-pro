import type { QuestaoBanco } from "../types";

export type ConfiguracaoSimulado = {
  quantidade: number;
  materias: string[];
  banca?: string;
  dificuldade?: string;
};

export function gerarSimulado(
  banco: QuestaoBanco[],
  config: ConfiguracaoSimulado
) {
  let questoes = [...banco];

  if (config.materias.length > 0) {
    questoes = questoes.filter((q) =>
      config.materias.includes(q.materia)
    );
  }

  if (config.banca) {
    questoes = questoes.filter(
      (q) => q.banca === config.banca
    );
  }

  if (config.dificuldade) {
    questoes = questoes.filter(
      (q) =>
        q.dificuldade === config.dificuldade
    );
  }

  questoes.sort(() => Math.random() - 0.5);

  return questoes.slice(0, config.quantidade);
}