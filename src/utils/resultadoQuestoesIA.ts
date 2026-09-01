import { localizarReferenciaCanonica } from "../services/conteudos/sincronizacaoCanonica";
import type {
  Materia,
  QuestaoIA,
  RegistroQuestao,
  ResultadoQuestoesIAPersistido,
  Revisao,
  Simulado,
  TipoSessaoQuestoesIA,
} from "../types";
import { aplicarRevisaoAdaptativa } from "./revisaoAdaptativa";

export type LetraAlternativaIA = "A" | "B" | "C" | "D" | "E";

export type RespostasQuestoesIA = Record<string, LetraAlternativaIA>;

export type ResultadoQuestoesIA = {
  certas: number;
  erradas: number;
  emBranco: number;
  percentual: number;
};

export type DiagnosticoAssuntoIA = {
  chave: string;
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  banca: string;
  total: number;
  certas: number;
  erradas: number;
  emBranco: number;
  percentual: number;
};

type CriarRegistrosParams = {
  tentativaId: string;
  tipo: TipoSessaoQuestoesIA;
  questoes: QuestaoIA[];
  respostas: RespostasQuestoesIA;
  materias: Materia[];
  data: string;
};

type AplicarRevisoesParams = {
  revisoes: Revisao[];
  diagnostico: DiagnosticoAssuntoIA[];
  materias: Materia[];
  agora?: Date;
};

export type ResumoRevisoesResultadoIA = {
  revisoes: Revisao[];
  criadas: number;
  atualizadas: number;
  semReferencia: number;
};

export function mesclarResultadosQuestoesIANoHistorico({
  questoes,
  simulados,
  resultados,
}: {
  questoes: RegistroQuestao[];
  simulados: Simulado[];
  resultados: ResultadoQuestoesIAPersistido[];
}) {
  // Revisions from the canonical history replace stale local aggregates.
  // Unreviewed attempts retain the original merge behavior.
  for (const resultado of resultados) {
    if (!resultado.auditoria?.revisadaEm) continue;
    const atuais = questoes.filter((q) => q.tentativaId === resultado.id);
    if (JSON.stringify(atuais) !== JSON.stringify(resultado.registros)) {
      questoes = [
        ...resultado.registros,
        ...questoes.filter((q) => q.tentativaId !== resultado.id),
      ];
    }
    if (resultado.simulado) {
      const atual = simulados.find((s) => s.id === resultado.id || s.tentativaId === resultado.id);
      if (JSON.stringify(atual) !== JSON.stringify(resultado.simulado)) {
        simulados = [resultado.simulado, ...simulados.filter((s) => s.id !== resultado.id && s.tentativaId !== resultado.id)];
      }
    }
  }

  const tentativasRegistradas = new Set(
    questoes
      .map((registro) => registro.tentativaId)
      .filter((id): id is string => Boolean(id))
  );
  const novasQuestoes: RegistroQuestao[] = [];

  resultados.forEach((resultado) => {
    if (tentativasRegistradas.has(resultado.id)) return;

    const registros = resultado.registros.filter(
      (registro) => registro.certas + registro.erradas > 0
    );
    if (registros.length === 0) return;

    novasQuestoes.push(...registros);
    tentativasRegistradas.add(resultado.id);
  });

  const simuladosRegistrados = new Set(
    simulados.flatMap((simulado) =>
      [simulado.id, simulado.tentativaId].filter(
        (id): id is string => Boolean(id)
      )
    )
  );
  const novosSimulados: Simulado[] = [];

  resultados.forEach((resultado) => {
    if (
      resultado.tipo !== "simulado" ||
      !resultado.simulado ||
      simuladosRegistrados.has(resultado.id)
    ) {
      return;
    }

    novosSimulados.push(resultado.simulado);
    simuladosRegistrados.add(resultado.id);
  });

  return {
    questoes:
      novasQuestoes.length === 0
        ? questoes
        : [...novasQuestoes, ...questoes],
    simulados:
      novosSimulados.length === 0
        ? simulados
        : [...novosSimulados, ...simulados],
  };
}

export function inferirTipoSessaoQuestoesIA(
  questoes: QuestaoIA[]
): TipoSessaoQuestoesIA {
  const assuntos = new Set(
    questoes.map((questao) =>
      normalizar(
        `${questao.materia}::${questao.modulo || "Geral"}::${questao.assunto}`
      )
    )
  );

  return assuntos.size > 1 ? "simulado" : "questoes";
}

export function calcularResultadoQuestoesIA(
  questoes: QuestaoIA[],
  respostas: RespostasQuestoesIA
): ResultadoQuestoesIA {
  const certas = questoes.filter(
    (questao) => respostas[questao.id] === questao.respostaCorreta
  ).length;
  const emBranco = questoes.filter(
    (questao) => !respostas[questao.id]
  ).length;
  const erradas = questoes.length - certas - emBranco;

  return {
    certas,
    erradas,
    emBranco,
    percentual:
      questoes.length === 0
        ? 0
        : Math.round((certas / questoes.length) * 100),
  };
}

export function calcularDiagnosticoQuestoesIA(
  questoes: QuestaoIA[],
  respostas: RespostasQuestoesIA
): DiagnosticoAssuntoIA[] {
  const mapa = new Map<
    string,
    Omit<DiagnosticoAssuntoIA, "percentual">
  >();

  questoes.forEach((questao) => {
    const materia = questao.materia || "Sem matéria";
    const modulo = questao.modulo || "Geral";
    const assunto = questao.assunto || "Sem assunto";
    const chave = normalizar(`${materia}::${modulo}::${assunto}`);
    const atual = mapa.get(chave) ?? {
      chave,
      materia,
      materiaId: questao.materiaId,
      modulo,
      moduloId: questao.moduloId,
      assunto,
      assuntoId: questao.assuntoId,
      banca: questao.banca || "Não informada",
      total: 0,
      certas: 0,
      erradas: 0,
      emBranco: 0,
    };
    const resposta = respostas[questao.id];
    const acertou = resposta === questao.respostaCorreta;

    mapa.set(chave, {
      ...atual,
      total: atual.total + 1,
      certas: atual.certas + (acertou ? 1 : 0),
      erradas: atual.erradas + (resposta && !acertou ? 1 : 0),
      emBranco: atual.emBranco + (!resposta ? 1 : 0),
    });
  });

  return Array.from(mapa.values())
    .map((item) => ({
      ...item,
      percentual:
        item.total === 0
          ? 0
          : Math.round((item.certas / item.total) * 100),
    }))
    .sort((a, b) => a.percentual - b.percentual);
}

export function criarRegistrosQuestoesIA({
  tentativaId,
  tipo,
  questoes,
  respostas,
  materias,
  data,
}: CriarRegistrosParams): RegistroQuestao[] {
  return calcularDiagnosticoQuestoesIA(questoes, respostas).flatMap(
    (item, indice) => {
      const respondidas = item.certas + item.erradas;
      if (respondidas === 0) return [];

      const referencia = localizarReferenciaCanonica(materias, item);

      return [
        {
          id: `${tentativaId}:assunto:${indice}`,
          materia: referencia?.materia.nome ?? item.materia,
          materiaId: referencia?.materia.id ?? item.materiaId,
          modulo: referencia?.modulo.nome ?? item.modulo,
          moduloId: referencia?.modulo.id ?? item.moduloId,
          assunto: referencia?.assunto.nome ?? item.assunto,
          assuntoId: referencia?.assunto.id ?? item.assuntoId,
          banca: item.banca,
          certas: item.certas,
          erradas: item.erradas,
          emBranco: item.emBranco,
          minutos: 0,
          data,
          origem: tipo === "simulado" ? "simulado-ia" : "questoes-ia",
          tentativaId,
          observacao:
            tipo === "simulado"
              ? "Resultado de simulado gerado por IA."
              : "Bloco de questões gerado por IA.",
        },
      ];
    }
  );
}

export function criarSimuladoIA({
  tentativaId,
  nome,
  data,
  resultado,
  totalQuestoes,
  banca,
}: {
  tentativaId: string;
  nome: string;
  data: string;
  resultado: ResultadoQuestoesIA;
  totalQuestoes: number;
  banca: string;
}): Simulado {
  return {
    id: tentativaId,
    tentativaId,
    nome,
    banca,
    certas: resultado.certas,
    erradas: resultado.erradas,
    emBranco: resultado.emBranco,
    anuladas: 0,
    minutos: 0,
    data,
    totalQuestoes,
    origem: "ia",
    observacao: "Simulado realizado com questões geradas por IA.",
  };
}

export function aplicarRevisoesDoResultadoIA({
  revisoes,
  diagnostico,
  materias,
  agora,
}: AplicarRevisoesParams): ResumoRevisoesResultadoIA {
  let proximas = revisoes;
  let criadas = 0;
  let atualizadas = 0;
  let semReferencia = 0;

  diagnostico.forEach((item) => {
    const referencia = localizarReferenciaCanonica(materias, item);

    if (!referencia) {
      if (item.percentual < 75 && item.total >= 5) semReferencia += 1;
      return;
    }

    const resultado = aplicarRevisaoAdaptativa({
      revisoes: proximas,
      materiaId: referencia.materia.id,
      moduloId: referencia.modulo.id,
      assuntoId: referencia.assunto.id,
      materia: referencia.materia.nome,
      modulo: referencia.modulo.nome,
      assunto: referencia.assunto.nome,
      certas: item.certas,
      erradas: item.erradas + item.emBranco,
      agora,
    });

    proximas = resultado.revisoes;
    if (resultado.acao === "criada") criadas += 1;
    if (resultado.acao === "atualizada") atualizadas += 1;
  });

  return {
    revisoes: proximas,
    criadas,
    atualizadas,
    semReferencia,
  };
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function aplicarAuditoriasResultadosLocais(
  locais: Record<string, unknown>[],
  resultados: ResultadoQuestoesIAPersistido[]
) {
  const revisados = new Map(resultados.filter((r) => r.auditoria?.revisadaEm).map((r) => [r.id, r]));
  let mudou = false;
  const atualizados = locais.map((local) => {
    const remoto = revisados.get(String(local.id));
    if (!remoto?.auditoria) return local;
    const proximo = {
      ...local,
      total: remoto.total,
      certas: remoto.certas,
      erradas: remoto.erradas,
      emBranco: remoto.emBranco,
      percentual: remoto.percentual,
      questoes: remoto.auditoria.questoesValidas,
      respostas: remoto.auditoria.respostas,
      auditoria: remoto.auditoria,
    };
    if (JSON.stringify(local) === JSON.stringify(proximo)) return local;
    mudou = true;
    return proximo;
  });
  return mudou ? atualizados : locais;
}
