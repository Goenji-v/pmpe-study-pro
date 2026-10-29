import type { Materia, Assunto } from "../types";

/**
 * Auditoria de agrupamento, somente leitura. Não transforma/reescreve IDs,
 * progresso, sessões, materiais ou referências canônicas.
 */
export type GrupoSugerido = {
  materiaId: string;
  moduloId: string;
  nomeModulo: string;
  assunto: string;
  partes: { assuntoId: string; nomeOriginal: string; ordem: number; concluido: boolean }[];
};

const romano: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
};

export function identificarParte(nome: string): { titulo: string; parte: number } | null {
  const match = nome.trim().match(/^(.+?)\s*[-–—:]\s*parte\s*(\d+|VIII|VII|VI|IV|IX|III|II|I|V|X)\s*(?:[:.–—-]\s*.*)?$/i);
  if (!match) return null;
  const titulo = match[1].trim();
  const token = match[2].toUpperCase();
  const parte = /^\d+$/.test(token) ? Number(token) : romano[token];
  if (!titulo || !parte || parte > 50) return null;
  return { titulo, parte };
}

function categoriaPortugues(nome: string): string | null {
  const normalizado = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/compreensao|interpretacao|tipologia|generos? textuais?/.test(normalizado)) return "Leitura e interpretação";
  if (/^(artigo|substantivo|adjetivo|adverbio|numeral|pronome|preposicao|conjuncao|interjeicao|verbo)(\b|\s|,)/.test(normalizado)) return "Classes de palavras";
  if (/coordenacao|subordinacao|regencia|concordancia|sintaxe|termos da oracao/.test(normalizado)) return "Sintaxe";
  if (/crase|acentuacao|ortografia|pontuacao/.test(normalizado)) return "Ortografia e pontuação";
  if (/semantica|coerencia|coesao|significacao/.test(normalizado)) return "Semântica e coesão";
  return null;
}

export function sugerirModuloPortugues(materia: string, nomeAssunto: string): string | null {
  if (!/l[ií]ngua portuguesa|portugu[eê]s/i.test(materia)) return null;
  return categoriaPortugues(nomeAssunto);
}

export function auditarGruposDePartes(materias: readonly Materia[]): GrupoSugerido[] {
  const grupos: GrupoSugerido[] = [];
  for (const materia of materias) {
    for (const modulo of materia.modulos ?? []) {
      const candidatos = new Map<string, { titulo: string; itens: { assunto: Assunto; parte: number }[] }>();
      for (const assunto of modulo.assuntos) {
        const parte = identificarParte(assunto.nome);
        if (!parte) continue;
        const chave = parte.titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
        const grupo = candidatos.get(chave) ?? { titulo: parte.titulo, itens: [] };
        grupo.itens.push({ assunto, parte: parte.parte });
        candidatos.set(chave, grupo);
      }
      for (const candidato of candidatos.values()) {
        if (candidato.itens.length < 2) continue;
        grupos.push({
          materiaId: materia.id, moduloId: modulo.id, nomeModulo: modulo.nome,
          assunto: candidato.titulo,
          partes: candidato.itens.map(({ assunto, parte }) => ({
            assuntoId: assunto.id, nomeOriginal: assunto.nome,
            ordem: parte, concluido: assunto.concluido,
          })),
        });
      }
    }
  }
  return grupos;
}


export type GrupoAssuntosVisual = {
  chave: string;
  titulo: string;
  tipo: "partes" | "tema" | "unico";
  assuntos: Assunto[];
};

/**
 * Agrupa apenas na apresentação. Os Assunto originais continuam inalterados,
 * com seus próprios IDs para checkbox, estudo, aula, questão e histórico.
 */
export function agruparAssuntosParaExibicao(
  materia: string,
  moduloId: string,
  assuntos: readonly Assunto[],
): GrupoAssuntosVisual[] {
  const contagem = new Map<string, number>();
  const descritores = assuntos.map((assunto) => {
    const parte = identificarParte(assunto.nome);
    if (parte) {
      const nomeBase = parte.titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      return { chave: "partes:" + nomeBase, titulo: parte.titulo, tipo: "partes" as const };
    }
    const tema = sugerirModuloPortugues(materia, assunto.nome);
    if (tema) return { chave: "tema:" + tema, titulo: tema, tipo: "tema" as const };
    return { chave: "unico:" + assunto.id, titulo: assunto.nome, tipo: "unico" as const };
  });
  for (const descritor of descritores) contagem.set(descritor.chave, (contagem.get(descritor.chave) ?? 0) + 1);
  const grupos = new Map<string, GrupoAssuntosVisual>();
  assuntos.forEach((assunto, indice) => {
    const descritor = descritores[indice];
    const agrupar = (contagem.get(descritor.chave) ?? 0) >= 2;
    const chave = agrupar ? descritor.chave : "unico:" + assunto.id;
    const grupo = grupos.get(chave) ?? {
      chave: "grupo:" + moduloId + ":" + chave,
      titulo: agrupar ? descritor.titulo : assunto.nome,
      tipo: agrupar ? descritor.tipo : "unico",
      assuntos: [],
    };
    grupo.assuntos.push(assunto);
    grupos.set(chave, grupo);
  });
  return [...grupos.values()];
}
