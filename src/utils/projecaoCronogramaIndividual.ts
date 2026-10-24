import type { MissaoPlano, SemanaPlano } from "../data/planoPMPE";

/**
 * Projeção SOMENTE DE LEITURA para um aluno já afetado pela troca de edital.
 * Não altera IDs, conclusões, histórico ou o array original.
 * Sem uma verificação de equivalência canônica, não infere conclusões novas.
 * Revisão, redação e simulado mantêm seus próprios dias e não entram na compactação.
 *
 * A ativação deve ser individual, depois de validar a prévia com o aluno.
 */
export function projetarPlanoCompactado(
  plano: SemanaPlano[],
  idsConcluidos: readonly string[],
): SemanaPlano[] {
  const concluidas = new Set(idsConcluidos);
  const slots: { semana: number; dia: number; indice: number }[] = [];
  const conteudos: MissaoPlano[] = [];

  plano.forEach((semana, s) => semana.dias.forEach((dia, d) =>
    dia.missoes.forEach((missao, i) => {
      if (missao.tipo !== "conteudo") return;
      slots.push({ semana: s, dia: d, indice: i });
      conteudos.push(missao);
    })
  ));

  // Stable partition: preservar a ordem relativa de cada grupo e os IDs originais.
  const ordenados = [
    ...conteudos.filter((missao) => concluidas.has(missao.id)),
    ...conteudos.filter((missao) => !concluidas.has(missao.id)),
  ];
  const resultado = plano.map((semana) => ({
    ...semana,
    dias: semana.dias.map((dia) => ({ ...dia, missoes: [...dia.missoes] })),
  }));
  slots.forEach(({ semana, dia, indice }, i) => {
    resultado[semana].dias[dia].missoes[indice] = ordenados[i];
  });
  return resultado;
}
