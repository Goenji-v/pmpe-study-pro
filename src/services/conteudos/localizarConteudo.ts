import { obterReferenciasDaMissao, type MissaoPlano } from "../../data/planoPMPE";
import type { AulaAssunto, Materia, Modulo, Assunto } from "../../types";
import { listarModulosDaMateria } from "./navegarConteudos";

export type ConteudoLocalizado = { modulo: Modulo; assunto: Assunto; aula?: AulaAssunto };

export function localizarConteudosDaMissao(
  materia: Materia,
  missao: Pick<MissaoPlano, "assunto" | "urlAula" | "conteudo" | "conteudos">
): ConteudoLocalizado[] {
  const referencias = obterReferenciasDaMissao(missao);
  const encontrados: ConteudoLocalizado[] = [];

  for (const referencia of referencias) {
    if (referencia.materiaId && referencia.materiaId !== materia.id) continue;

    const modulo = listarModulosDaMateria(materia).find((item) => item.id === referencia.moduloId);
    const assunto = modulo?.assuntos.find((item) => item.id === referencia.assuntoId);
    if (!modulo || !assunto) continue;

    const aula = referencia.aulaId
      ? assunto.aulas?.find((item) => item.id === referencia.aulaId)
      : undefined;

    encontrados.push({ modulo, assunto, aula });
  }

  if (encontrados.length > 0) return encontrados;

  const nomeMissao = normalizar(missao.assunto);
  for (const modulo of listarModulosDaMateria(materia)) {
    for (const assunto of modulo.assuntos) {
      const aulaPorUrl = missao.urlAula
        ? assunto.aulas?.find((aula) => aula.url === missao.urlAula)
        : undefined;
      const aulaPorNome = assunto.aulas?.find((aula) => nomesCompativeis(aula.nome, nomeMissao));
      if (aulaPorUrl || aulaPorNome) return [{ modulo, assunto, aula: aulaPorUrl ?? aulaPorNome }];
      if (nomesCompativeis(assunto.nome, nomeMissao)) return [{ modulo, assunto }];
    }
  }
  return [];
}

export function localizarConteudoDaMissao(
  materia: Materia,
  missao: Pick<MissaoPlano, "assunto" | "urlAula" | "conteudo" | "conteudos">
): ConteudoLocalizado | null {
  const encontrados = localizarConteudosDaMissao(materia, missao);
  if (encontrados.length === 0) return null;
  return encontrados.find(({ assunto, aula }) =>
    aula ? !aula.concluida : !assunto.concluido
  ) ?? encontrados[0];
}

export function localizarProximaAula(assunto: Assunto) {
  const aulas = (assunto.aulas ?? []).slice().sort((a, b) => a.ordem - b.ordem);
  return aulas.find((aula) => !aula.concluida) ?? aulas[0];
}

function nomesCompativeis(nomeConteudo: string, nomeMissaoNormalizado: string) {
  const conteudo = limparPrefixos(normalizar(nomeConteudo));
  const missao = limparPrefixos(nomeMissaoNormalizado);
  return conteudo === missao ||
    (conteudo.length >= 5 && missao.includes(conteudo)) ||
    (missao.length >= 5 && conteudo.includes(missao));
}

function limparPrefixos(texto: string) {
  return texto.replace(/^aula\s*\d+\s*[-–:]?\s*/, "").replace(/\bparte\s*0?(\d+)\b/g, "parte $1").trim();
}

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}
