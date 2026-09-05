import type { Materia } from "../types";
import type {
  DiaPlano,
  MissaoPlano,
  SemanaPlano,
} from "../data/planoPMPE";
import { listarModulosDaMateria } from "../services/conteudos/navegarConteudos";

let materiasAtuais: Materia[] = [];

export function registrarMateriasPlanoRuntime(
  materias: Materia[]
) {
  materiasAtuais = materias;
}

export function temConteudosPlanoRuntime() {
  return materiasAtuais.some((materia) =>
    listarModulosDaMateria(materia).some(
      (modulo) => modulo.assuntos.length > 0
    )
  );
}

export function criarPlanoMateriasRuntime(
  missoesPorDia = 1
): SemanaPlano[] {
  const quantidadePorDia = Math.max(
    1,
    Math.min(6, Math.floor(missoesPorDia || 1))
  );
  const filas = materiasAtuais
    .map((materia) => ({
      materia,
      itens: listarModulosDaMateria(materia).flatMap((modulo) =>
        modulo.assuntos.map((assunto) => ({ modulo, assunto }))
      ),
    }))
    .filter((fila) => fila.itens.length > 0);

  if (filas.length === 0) return [];

  const sequencia: Array<{
    materia: Materia;
    moduloId: string;
    assuntoId: string;
    assunto: string;
  }> = [];
  let ponteiro = 0;

  while (filas.some((fila) => fila.itens.length > 0)) {
    let encontrou = false;
    for (let deslocamento = 0; deslocamento < filas.length; deslocamento += 1) {
      const indice = (ponteiro + deslocamento) % filas.length;
      const fila = filas[indice];
      const item = fila.itens.shift();
      if (!item) continue;
      sequencia.push({
        materia: fila.materia,
        moduloId: item.modulo.id,
        assuntoId: item.assunto.id,
        assunto: item.assunto.nome,
      });
      ponteiro = (indice + 1) % filas.length;
      encontrou = true;
      break;
    }
    if (!encontrou) break;
  }

  const semanas: SemanaPlano[] = [];
  let indiceConteudo = 0;
  let semana = 1;

  while (indiceConteudo < sequencia.length) {
    const dias: DiaPlano[] = [];

    for (let dia = 1; dia <= 6; dia += 1) {
      const bloco = sequencia.slice(
        indiceConteudo,
        indiceConteudo + quantidadePorDia
      );
      indiceConteudo += bloco.length;

      const missoes: MissaoPlano[] = bloco.map((item, indice) => ({
        id: `conteudo-${item.materia.id}-${item.assuntoId}`,
        numero: indice + 1,
        materia: item.materia.nome,
        assunto: item.assunto,
        tipo: "conteudo",
        conteudo: {
          materiaId: item.materia.id,
          moduloId: item.moduloId,
          assuntoId: item.assuntoId,
        },
        conteudos: [
          {
            materiaId: item.materia.id,
            moduloId: item.moduloId,
            assuntoId: item.assuntoId,
          },
        ],
      }));

      dias.push({
        numero: dia,
        missoes,
      });

      if (indiceConteudo >= sequencia.length) {
        for (let restante = dia + 1; restante <= 6; restante += 1) {
          dias.push({ numero: restante, missoes: [] });
        }
        break;
      }
    }

    dias.push({ numero: 7, missoes: [] });
    semanas.push({
      numero: semana,
      nome: `Semana ${String(semana).padStart(2, "0")}`,
      dias,
    });
    semana += 1;
  }

  return semanas;
}
