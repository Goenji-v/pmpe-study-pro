import { chaveDaMateria, nomesEquivalentesMateria } from "../utils/desempenhoMaterias";
import { normalizarBancaConcurso } from "../utils/bancasConcurso";
import { normalizarChaveIA } from "./catalogoQuestoesIAUtils";

export function filtroMateriaCatalogo(materia: string) {
  const nomes = nomesEquivalentesMateria(materia).map(nome => JSON.stringify(nome)).join(",");
  return `materia_chave.in.(${nomes}),materia_chave.is.null`;
}

function chaveBanca(valor: string) {
  const conhecida = normalizarBancaConcurso(valor);
  return normalizarChaveIA(conhecida === "Não informada" ? valor : conhecida);
}

/** Confere o texto original também: catálogos importados podem não ter chaves. */
export function correspondeFiltroCatalogo(
  linha: { materia: string; assunto: string; banca: string; modulo?: string | null },
  filtros: { materia: string; assunto: string; banca: string; modulo?: string }
) {
  const banca = normalizarChaveIA(filtros.banca);
  const todasBancas = ["aleatorias", "aleatoria", "banca aleatoria", "todas"].includes(banca);
  return chaveDaMateria(linha.materia) === chaveDaMateria(filtros.materia)
    && normalizarChaveIA(linha.assunto) === normalizarChaveIA(filtros.assunto)
    && (!filtros.modulo?.trim() || normalizarChaveIA(linha.modulo ?? "") === normalizarChaveIA(filtros.modulo))
    && (todasBancas || chaveBanca(linha.banca) === chaveBanca(filtros.banca));
}
