import type { Materia, Revisao } from "../types";
import { listarModulosDaMateria } from "../services/conteudos/navegarConteudos";
import { materiasEquivalentes } from "./uniaoGradeEstudos";
import { encontrarDataDisponivelParaRevisao } from "./revisoes";
import type { AnaliseSimuladoStudyPro } from "./analiseSimuladoStudyPro";

export type ResultadoAdicionarRevisoesSimulado = {
  revisoes: Revisao[];
  criadas: number;
  atualizadas: number;
  jaExistiam: number;
  /** Prioridades agendadas para questões IA, ainda sem aula do curso vinculada. */
  semReferencia: number;
};

/**
 * Sinônimos verificados na grade real: o nome do assunto no diagnóstico
 * nem sempre é o título exato da videoaula. Não usamos correspondência
 * genérica (ex.: "Economia Açucareira" -> aula de História arbitrária).
 */
const ALIASES_VERIFICADOS: Record<string, string> = {
  "direito constitucional::elegibilidade": "Direitos Políticos e partidos políticos",
  "raciocinio logico::logica de argumentacao": "Lógica argumentativa",
  "informatica::microsoft windows 10": "Windows - Parte III: Nomes, símbolos proibidos, painel de controle, novidades do Windows 10",
  "historia de pernambuco::invasoes holandesas":
    "A presença Holandesa, O governo Nassau e a Insurreição Pernambucana",
};

function materiaCompatível(nomeGrade: string, nomeDiagnostico: string) {
  const grade = normalizar(nomeGrade);
  const diagnostico = normalizar(nomeDiagnostico);
  return grade === diagnostico ||
    (grade === "historia" && diagnostico === "historia de pernambuco") ||
    (grade === "raciocinio logico e matematica" && diagnostico === "raciocinio logico") ||
    materiasEquivalentes(nomeGrade, nomeDiagnostico);
}

function encontrarCorrespondenciaSegura(
  materias: Materia[],
  materiaDiagnosticada: string,
  assuntoDiagnosticado: string
) {
  const materia = materias.find((item) =>
    materiaCompatível(item.nome, materiaDiagnosticada)
  );
  if (!materia) return null;

  const todas = listarModulosDaMateria(materia).flatMap((modulo) =>
    modulo.assuntos.map((assunto) => ({ materia, modulo, assunto }))
  );

  // A coincidência literal tem prioridade sobre pontuação aproximada.
  // Corrige "Orações subordinadas adverbiais" que antes caía na aula
  // genérica "Orações subordinadas".
  const exata = todas.find(
    (item) => normalizar(item.assunto.nome) === normalizar(assuntoDiagnosticado)
  );
  if (exata) return exata;

  const alias = ALIASES_VERIFICADOS[
    `${normalizar(materiaDiagnosticada)}::${normalizar(assuntoDiagnosticado)}`
  ];
  if (!alias) return null;
  return todas.find((item) => normalizar(item.assunto.nome) === normalizar(alias)) ?? null;
}

function materiaDisponivel(materias: Materia[], nome: string) {
  return materias.find((item) => materiaCompatível(item.nome, nome));
}

export function adicionarErrosSimuladoARevisao(params: {
  revisoes: Revisao[];
  materias: Materia[];
  analise: AnaliseSimuladoStudyPro;
  limiteDiario?: number;
  agora?: Date;
  criarId?: () => string;
}): ResultadoAdicionarRevisoesSimulado {
  let revisoes = [...params.revisoes];
  let criadas = 0;
  let atualizadas = 0;
  let jaExistiam = 0;
  let semReferencia = 0;
  const agora = params.agora ?? new Date();
  const primeiraData = dataEmDias(agora, 1);
  const limiteDiario = params.limiteDiario ?? 0;

  for (const plano of params.analise.planoRevisao) {
    const assunto = params.analise.assuntos.find(
      (item) => item.chave === plano.chave
    );
    if (!assunto) continue;

    const referencia = encontrarCorrespondenciaSegura(
      params.materias, assunto.materia, assunto.assunto
    );
    const materiaBase = referencia?.materia ??
      materiaDisponivel(params.materias, assunto.materia);
    const materiaId = materiaBase?.id ?? `simulado-materia:${slug(assunto.materia)}`;
    const assuntoId = referencia?.assunto.id ??
      `simulado-assunto:${slug(assunto.materia)}:${slug(assunto.assunto)}`;
    const materiaNome = materiaBase?.nome ?? assunto.materia;
    const assuntoNome = referencia?.assunto.nome ?? assunto.assunto;

    const indice = revisoes.findIndex(
      (revisao) => !revisao.concluida && mesmaReferencia(revisao, {
        materiaId, assuntoId, materia: materiaNome, assunto: assuntoNome,
        materiaDiagnostico: assunto.materia,
        assuntoDiagnostico: assunto.assunto,
      })
    );
    // Reabrir o mesmo diagnóstico não cria outra etapa caso a primeira
    // revisão específica deste simulado já tenha sido concluída.
    if (indice < 0 && revisoes.some((item) =>
      item.concluida &&
      item.origemSimulado?.tentativaId === params.analise.tentativaId &&
      normalizar(item.origemSimulado.materiaDiagnostico) === normalizar(assunto.materia) &&
      normalizar(item.origemSimulado.assuntoDiagnostico) === normalizar(assunto.assunto)
    )) {
      jaExistiam += 1;
      continue;
    }

    if (!referencia) semReferencia += 1;

    const certasSeguras = Math.max(0, assunto.acertos - assunto.acertosPorChute);
    const errosCognitivos =
      assunto.erros + assunto.naoRespondidas + assunto.acertosPorChute;

    if (indice >= 0) {
      const existente = revisoes[indice];
      const dataExistente = Date.parse(existente.dataPrevista);
      const dataDisponivel = encontrarDataDisponivelParaRevisao({
        dataBase: primeiraData,
        revisoes: revisoes.filter((item) => item.id !== existente.id),
        limiteDiario,
      });
      const deveAntecipar =
        !Number.isFinite(dataExistente) ||
        dataDisponivel.getTime() < dataExistente;
      const atualizada: Revisao = {
        ...existente,
        // Nunca reescrever IDs/assuntos de revisão anterior que foi
        // vinculada pelo nome: ela pode representar conteúdo mais amplo.
        certas: certasSeguras,
        erradas: errosCognitivos,
        dataPrevista: deveAntecipar
          ? dataDisponivel.toISOString()
          : existente.dataPrevista,
      };
      if (JSON.stringify(atualizada) !== JSON.stringify(existente)) {
        revisoes = revisoes.map((item, posicao) =>
          posicao === indice ? atualizada : item
        );
        atualizadas += 1;
      } else {
        jaExistiam += 1;
      }
      continue;
    }

    const dataDisponivel = encontrarDataDisponivelParaRevisao({
      dataBase: primeiraData, revisoes, limiteDiario,
    });
    const nova: Revisao = {
      id: params.criarId?.() ?? crypto.randomUUID(),
      materiaId,
      moduloId: referencia?.modulo.id,
      assuntoId,
      materia: materiaNome,
      modulo: referencia?.modulo.nome,
      assunto: assuntoNome,
      etapa: 1,
      dataCriacao: agora.toISOString(),
      dataPrevista: dataDisponivel.toISOString(),
      concluida: false,
      certas: certasSeguras,
      erradas: errosCognitivos,
      origemSimulado: {
        tentativaId: params.analise.tentativaId,
        materiaDiagnostico: assunto.materia,
        assuntoDiagnostico: assunto.assunto,
        vinculo: referencia ? "conteudo" : "sem_conteudo",
      },
    };
    revisoes = [nova, ...revisoes];
    criadas += 1;
  }

  return { revisoes, criadas, atualizadas, jaExistiam, semReferencia };
}

function mesmaReferencia(
  revisao: Revisao,
  referencia: {
    materiaId: string;
    assuntoId: string;
    materia: string;
    assunto: string;
    materiaDiagnostico: string;
    assuntoDiagnostico: string;
  }
) {
  if (revisao.materiaId === referencia.materiaId &&
      revisao.assuntoId === referencia.assuntoId) return true;

  if (revisao.origemSimulado &&
      normalizar(revisao.origemSimulado.materiaDiagnostico) === normalizar(referencia.materiaDiagnostico) &&
      normalizar(revisao.origemSimulado.assuntoDiagnostico) === normalizar(referencia.assuntoDiagnostico)) {
    return true;
  }
  return normalizar(revisao.materia) === normalizar(referencia.materia) &&
    normalizar(revisao.assunto) === normalizar(referencia.assunto);
}

function dataEmDias(base: Date, dias: number) {
  const data = new Date(base);
  data.setDate(data.getDate() + dias);
  data.setHours(12, 0, 0, 0);
  return data;
}

function slug(texto: string) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
