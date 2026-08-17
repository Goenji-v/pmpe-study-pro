import { obterReferenciasDaMissao, planoPMPE, type MissaoPlano } from "../../data/planoPMPE";
import type {
  Assunto,
  Materia,
  Modulo,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  TipoSessao,
} from "../../types";
import { listarModulosDaMateria } from "./navegarConteudos";
import { localizarConteudoDaMissao } from "./localizarConteudo";

export type ReferenciaCanonica = {
  materia: Materia;
  modulo: Modulo;
  assunto: Assunto;
};

type EntradaReferencia = {
  materia?: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto?: string;
  assuntoId?: string;
  missaoId?: string;
};

const missoes = planoPMPE.flatMap((semana) =>
  semana.dias.flatMap((dia) => dia.missoes)
);

const missoesPorId = new Map(
  missoes.map((missao) => [missao.id, missao])
);

/**
 * Etapa 15 — fonte única para resolver qualquer referência de conteúdo.
 * IDs canônicos têm prioridade; nomes antigos e missões do plano são apenas
 * mecanismos de compatibilidade. Nenhuma tela precisa adivinhar o conteúdo.
 */
export function localizarReferenciaCanonica(
  materias: Materia[],
  entrada: EntradaReferencia
): ReferenciaCanonica | null {
  const porIds = localizarPorIds(materias, entrada);
  if (porIds) return porIds;

  if (entrada.missaoId) {
    const missao = missoesPorId.get(entrada.missaoId);
    const porMissao = missao
      ? localizarReferenciaDaMissao(materias, missao)
      : null;
    if (porMissao) return porMissao;
  }

  const materia = materias.find(
    (item) =>
      Boolean(entrada.materiaId && item.id === entrada.materiaId) ||
      Boolean(
        entrada.materia &&
          normalizar(item.nome) === normalizar(entrada.materia)
      )
  );

  if (materia) {
    const porNomes = localizarDentroDaMateria(materia, entrada);
    if (porNomes) return porNomes;
  }

  // Compatibilidade com versões em que Português guardava a videoaula como
  // assunto independente (ex.: "Sílaba - Parte 1"). O Plano já conhece o
  // assunto/aula canônicos e funciona como alias seguro.
  if (entrada.materia && entrada.assunto) {
    const missaoLegada = missoes.find(
      (missao) =>
        missao.tipo === "conteudo" &&
        normalizar(missao.materia) === normalizar(entrada.materia as string) &&
        normalizar(missao.assunto) === normalizar(entrada.assunto as string)
    );

    if (missaoLegada) {
      return localizarReferenciaDaMissao(materias, missaoLegada);
    }
  }

  return null;
}

export function criarDadosSessaoDaMissao(
  materias: Materia[],
  missao: MissaoPlano,
  semana: number,
  dia: number
) {
  const referencias = obterReferenciasDaMissao(missao);
  const materiaPorId = referencias.length > 0
    ? materias.find((item) => item.id === referencias[0].materiaId)
    : undefined;
  const materiaPorNome = materias.find(
    (item) => normalizar(item.nome) === normalizar(missao.materia)
  );
  const materia = materiaPorId ?? materiaPorNome;
  const localizacao = materia ? localizarConteudoDaMissao(materia, missao) : null;

  return {
    materia: materia?.nome ?? missao.materia,
    materiaId: materia?.id,
    modulo: localizacao?.modulo.nome,
    moduloId: localizacao?.modulo.id,
    assunto: localizacao?.assunto.nome ?? missao.assunto,
    assuntoId: localizacao?.assunto.id,
    aulaId: localizacao?.aula?.id,
    tipo: tipoSessaoDaMissao(missao),
    objetivo: `Semana ${semana} — Dia ${dia} — Missão ${missao.numero}`,
    missaoId: missao.id,
    semana,
    dia,
    urlAula:
      localizacao?.aula?.url ??
      localizacao?.assunto.aulas?.find((aula) => !aula.concluida)?.url ??
      localizacao?.assunto.aula ??
      missao.urlAula,
    urlQuestoes: localizacao?.assunto.questoes ?? missao.urlQuestoes,
  };
}

export function reconciliarSessoesComConteudos(
  materias: Materia[],
  sessoes: SessaoEstudo[]
): SessaoEstudo[] {
  return sessoes.map((sessao) => {
    const referencia = localizarReferenciaCanonica(materias, sessao);
    if (!referencia) return sessao;

    return {
      ...sessao,
      materia: referencia.materia.nome,
      materiaId: referencia.materia.id,
      modulo: referencia.modulo.nome,
      moduloId: referencia.modulo.id,
      assunto: referencia.assunto.nome,
      assuntoId: referencia.assunto.id,
    };
  });
}

export function reconciliarQuestoesComConteudos(
  materias: Materia[],
  questoes: RegistroQuestao[]
): RegistroQuestao[] {
  return questoes.map((registro) => {
    const referencia = localizarReferenciaCanonica(materias, registro);
    if (!referencia) return registro;

    return {
      ...registro,
      materia: referencia.materia.nome,
      materiaId: referencia.materia.id,
      modulo: referencia.modulo.nome,
      moduloId: referencia.modulo.id,
      assunto: referencia.assunto.nome,
      assuntoId: referencia.assunto.id,
    };
  });
}

export function reconciliarRevisoesComConteudos(
  materias: Materia[],
  revisoes: Revisao[]
): Revisao[] {
  const reconciliadas = revisoes.map((revisao) => {
    const referencia = localizarReferenciaCanonica(materias, revisao);
    if (!referencia) return revisao;

    return {
      ...revisao,
      materia: referencia.materia.nome,
      materiaId: referencia.materia.id,
      modulo: referencia.modulo.nome,
      moduloId: referencia.modulo.id,
      assunto: referencia.assunto.nome,
      assuntoId: referencia.assunto.id,
    };
  });

  // Remove somente duplicidades pendentes da mesma etapa e do mesmo assunto.
  // Histórico concluído nunca é descartado.
  const pendentesVistos = new Set<string>();
  return reconciliadas.filter((revisao) => {
    if (revisao.concluida) return true;

    const chave = revisao.materiaId && revisao.assuntoId
      ? `${revisao.materiaId}::${revisao.assuntoId}::${revisao.etapa}`
      : `${normalizar(revisao.materia)}::${normalizar(revisao.assunto)}::${revisao.etapa}`;

    if (pendentesVistos.has(chave)) return false;
    pendentesVistos.add(chave);
    return true;
  });
}

export function referenciasIguais<T>(a: T, b: T) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function localizarReferenciaDaMissao(
  materias: Materia[],
  missao: MissaoPlano
): ReferenciaCanonica | null {
  for (const referencia of obterReferenciasDaMissao(missao)) {
    const materia = materias.find((item) => item.id === referencia.materiaId);
    if (!materia) continue;
    const modulo = listarModulosDaMateria(materia).find((item) => item.id === referencia.moduloId);
    const assunto = modulo?.assuntos.find((item) => item.id === referencia.assuntoId);
    if (modulo && assunto) return { materia, modulo, assunto };
  }
  return null;
}

function localizarPorIds(
  materias: Materia[],
  entrada: EntradaReferencia
): ReferenciaCanonica | null {
  if (!entrada.materiaId || !entrada.assuntoId) return null;

  const materia = materias.find((item) => item.id === entrada.materiaId);
  if (!materia) return null;

  const modulos = listarModulosDaMateria(materia);
  const modulo = entrada.moduloId
    ? modulos.find((item) => item.id === entrada.moduloId)
    : modulos.find((item) =>
        item.assuntos.some((assunto) => assunto.id === entrada.assuntoId)
      );
  const assunto = modulo?.assuntos.find(
    (item) => item.id === entrada.assuntoId
  );

  return modulo && assunto
    ? { materia, modulo, assunto }
    : null;
}

function localizarDentroDaMateria(
  materia: Materia,
  entrada: EntradaReferencia
): ReferenciaCanonica | null {
  const modulos = listarModulosDaMateria(materia);
  const candidatos = entrada.moduloId
    ? modulos.filter((item) => item.id === entrada.moduloId)
    : entrada.modulo
      ? modulos.filter(
          (item) => normalizar(item.nome) === normalizar(entrada.modulo as string)
        )
      : modulos;

  for (const modulo of candidatos.length > 0 ? candidatos : modulos) {
    const assunto = modulo.assuntos.find(
      (item) =>
        Boolean(entrada.assuntoId && item.id === entrada.assuntoId) ||
        Boolean(
          entrada.assunto &&
            normalizar(item.nome) === normalizar(entrada.assunto)
        )
    );

    if (assunto) return { materia, modulo, assunto };
  }

  return null;
}

function tipoSessaoDaMissao(missao: MissaoPlano): TipoSessao {
  switch (missao.tipo) {
    case "revisao":
      return "revisao";
    case "questoes":
      return "questoes";
    case "redacao":
      return "redacao";
    case "simulado":
      return "simulado";
    case "livre":
      return "estudo";
    default:
      return "aula";
  }
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
