import { planoPMPE } from "../data/planoPMPE";

export type ConteudoSemana = {
  materia: string;
  assunto: string;
};

export function pegarAssuntosDaSemana(
  numeroSemana: number
): ConteudoSemana[] {
  const semana = planoPMPE.find(
    (item) => item.numero === numeroSemana
  );

  if (!semana) {
    return [];
  }

  const mapa = new Map<string, ConteudoSemana>();

  semana.dias.forEach((dia) => {
    dia.missoes.forEach((missao) => {
      const materia = missao.materia?.trim();
      const assunto = missao.assunto?.trim();

      if (!materia || !assunto) {
        return;
      }

      if (
        missao.tipo === "livre" ||
        materia.toLowerCase().includes(
          "maior dificuldade"
        )
      ) {
        return;
      }

      const chave = normalizar(
        `${materia}::${assunto}`
      );

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          materia,
          assunto,
        });
      }
    });
  });

  return Array.from(mapa.values()).sort(
    (a, b) => {
      const materia =
        a.materia.localeCompare(
          b.materia,
          "pt-BR"
        );

      if (materia !== 0) {
        return materia;
      }

      return a.assunto.localeCompare(
        b.assunto,
        "pt-BR"
      );
    }
  );
}

export function listarSemanasDoPlano() {
  return planoPMPE.map((semana) => ({
    numero: semana.numero,
    nome:
      semana.nome ||
      `Semana ${semana.numero}`,
  }));
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}