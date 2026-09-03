/* Contexto exporta Provider e hook intencionalmente no mesmo módulo. */
/* oxlint-disable react/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  useLocalStorage,
} from "../hooks/useLocalStorage";

import {
  ehEntradaOperacionalDoPlano,
  ehMateriaOperacionalDoPlano,
  gerarMateriasDoPlano,
} from "../utils/materiasDoPlano";

import { obterReferenciasDaMissao, planoPMPE, planoPMPELegado } from "../data/planoPMPE";
import { criarPrimeiraRevisao } from "../utils/revisoes";
import { reconciliarCursosImportados } from "../utils/importacaoCurso";
import { criarConfiguracoesIniciais, criarDadosIniciaisDaConta, houveReinicioDaConta, usaPlanoPadrao } from "../utils/contaInicial";
import ArmazenamentoConta from "../components/ArmazenamentoConta/ArmazenamentoConta";
import { chaveArmazenamentoConta, criarEscopoArmazenamento } from "../services/armazenamentoConta";

import {
  atualizarAssuntoNaArvore,
  migrarMateriasParaModulos,
} from "../services/conteudos/migrarEstruturaConteudos";

import {
  encontrarAssunto,
  listarAssuntosDaMateria,
  listarModulosDaMateria,
} from "../services/conteudos/navegarConteudos";

import {
  reconciliarQuestoesComConteudos,
  reconciliarRevisoesComConteudos,
  reconciliarSessoesComConteudos,
  referenciasIguais,
} from "../services/conteudos/sincronizacaoCanonica";

import {
  useAuth,
} from "./AuthContext";

import {
  carregarEstadoDaNuvem,
  montarEstadoNuvem,
  obterRevisaoSincronizacao,
  salvarEstadoComControleDeRevisao,
  salvarEstadoEstruturalComSeguranca,
  salvarEstadoNaNuvem,
  validarIntegridadeEstado,
  ConflitoSincronizacaoError,
  type EstadoAppNuvem,
} from "../services/sincronizacaoService";

import {
  criarBackupAutomaticoLocal,
} from "../services/seguranca/backupAutomaticoService";

import {
  listarResultadosQuestoesIA,
} from "../services/resultadosQuestoesIAService";

import {
  mesclarResultadosQuestoesIANoHistorico,
  aplicarAuditoriasResultadosLocais,
} from "../utils/resultadoQuestoesIA";

import {
  limparEstadoPendenteSincronizacao,
  navegadorEstaOnline,
  obterEstadoPendenteSincronizacao,
  obterMetadadosSincronizacaoLocal,
  registrarEstadoPendenteSincronizacao,
  registrarSincronizacaoConfirmada,
  registrarTentativaPendente,
} from "../services/seguranca/protecaoSincronizacaoService";

import type {
  Assunto,
  ConfiguracoesApp,
  Materia,
  QuestaoBanco,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
  SimuladoGerado,
} from "../types/index";

export type StatusNuvem =
  | "carregando"
  | "sincronizado"
  | "salvando"
  | "offline"
  | "conflito"
  | "erro";

type AppContextType = {
  materias: Materia[];
  setMaterias: Dispatch<SetStateAction<Materia[]>>;

  questoes: RegistroQuestao[];
  setQuestoes: Dispatch<SetStateAction<RegistroQuestao[]>>;

  sessoes: SessaoEstudo[];
  setSessoes: Dispatch<SetStateAction<SessaoEstudo[]>>;

  revisoes: Revisao[];
  setRevisoes: Dispatch<SetStateAction<Revisao[]>>;

  simulados: Simulado[];
  setSimulados: Dispatch<SetStateAction<Simulado[]>>;

  bancoQuestoes: QuestaoBanco[];
  setBancoQuestoes: Dispatch<SetStateAction<QuestaoBanco[]>>;

  simuladosGerados: SimuladoGerado[];
  setSimuladosGerados: Dispatch<SetStateAction<SimuladoGerado[]>>;

  configuracoes: ConfiguracoesApp;
  setConfiguracoes: Dispatch<SetStateAction<ConfiguracoesApp>>;

  missoesConcluidas: string[];
  setMissoesConcluidas: Dispatch<SetStateAction<string[]>>;

  statusNuvem: StatusNuvem;
  erroNuvem: string;
  alteracoesPendentes: number;
  ultimaSincronizacao: string | null;
  sincronizarAgora: () => Promise<void>;
  resolverConflitoSincronizacao: (
    preferencia: "nuvem" | "local"
  ) => Promise<void>;
  restaurarEstadoCompleto: (estado: EstadoAppNuvem) => Promise<void>;

  definirConclusaoAssunto: (
    materiaId: string,
    assuntoId: string,
    concluido: boolean,
    moduloId?: string,
    modo?: "agora" | "ja-estudado",
    preservarAulas?: boolean,
    sincronizarMissoes?: boolean
  ) => void;

  definirConclusaoAula: (
    materiaId: string,
    assuntoId: string,
    aulaId: string,
    concluida: boolean,
    moduloId?: string
  ) => void;

  importarProgressoMateria: (
    materiaId: string,
    moduloId: string,
    assuntoId: string
  ) => number;
};

const AppContext =
  createContext<AppContextType | undefined>(
    undefined
  );

type AppProviderProps = {
  children: ReactNode;
};

function clonar<T>(valor: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(valor);
  }

  return JSON.parse(JSON.stringify(valor)) as T;
}

function criarEstadoInicialDaConta(nome = ""):
  EstadoAppNuvem {
  return montarEstadoNuvem(criarDadosIniciaisDaConta(nome));
}

function reconciliarMateriasComPlano(
  materiasSalvas: Materia[],
  planoPadraoAtivo = true
): Materia[] {
  const materiasNormalizadas =
    migrarMateriasParaModulos(materiasSalvas);

  // Uma lista vazia é uma escolha válida, nunca um pedido de repor o edital.
  if (!planoPadraoAtivo || materiasNormalizadas.length === 0) return materiasNormalizadas;

  const materiasDoPlano =
    migrarMateriasParaModulos(gerarMateriasDoPlano());

  const resultado: Materia[] = [];

  materiasNormalizadas.forEach((materiaSalva) => {
    const materiaPlano = materiasDoPlano.find(
      (materia) =>
        materia.id === materiaSalva.id ||
        normalizarTexto(materia.nome) ===
          normalizarTexto(materiaSalva.nome)
    );

    if (!materiaPlano) {
      // Etapa 13: matérias criadas apenas para representar revisão, redação
      // ou tarefa livre no plano antigo deixam de poluir Conteúdos.
      if (ehMateriaOperacionalDoPlano(materiaSalva.nome)) {
        return;
      }

      // Conteúdo personalizado que não pertence ao plano é preservado.
      resultado.push(materiaSalva);
      return;
    }

    // Português é uma trilha canônica: os módulos/aulas vêm do curso comprado.
    // Preservamos progresso, notas e materiais apenas quando a aula atual
    // corresponde a uma aula da nova trilha.
    if (normalizarTexto(materiaPlano.nome) === "portugues") {
      const assuntosSalvos = listarAssuntosDaMateria(materiaSalva);

      const modulos = listarModulosDaMateria(materiaPlano).map((moduloPlano) => ({
        ...moduloPlano,
        assuntos: moduloPlano.assuntos.map((assuntoPlano) => {
          const assuntoSalvo = assuntosSalvos.find(
            (assunto) =>
              assunto.id === assuntoPlano.id ||
              normalizarTexto(assunto.nome) === normalizarTexto(assuntoPlano.nome)
          );

          return reconciliarAssuntoPortugues(
            assuntoPlano,
            assuntoSalvo,
            assuntosSalvos
          );
        }),
      }));

      const reconciliada = migrarMateriasParaModulos([
        {
          ...materiaPlano,
          id: materiaPlano.id,
          nome: materiaPlano.nome,
          modulos,
          assuntos: modulos.flatMap((modulo) => modulo.assuntos),
        },
      ])[0];

      if (reconciliada) {
        resultado.push(reconciliada);
      }
      return;
    }

    const assuntosCanonicos = listarAssuntosDaMateria(materiaPlano);
    const idsCanonicos = new Set(assuntosCanonicos.map((assunto) => assunto.id));
    const nomesCanonicos = new Set(
      assuntosCanonicos.map((assunto) => normalizarTexto(assunto.nome))
    );

    const usados = new Set<string>();

    let modulos = listarModulosDaMateria(materiaSalva).map((modulo) => ({
      ...modulo,
      assuntos: modulo.assuntos
        .filter(
          (assuntoSalvo) =>
            !ehEntradaOperacionalDoPlano(
              materiaSalva.nome,
              assuntoSalvo.nome
            )
        )
        .map((assuntoSalvo) => {
          const assuntoPlano = assuntosCanonicos.find(
            (assunto) =>
              assunto.id === assuntoSalvo.id ||
              normalizarTexto(assunto.nome) ===
                normalizarTexto(assuntoSalvo.nome)
          );

          if (!assuntoPlano) {
            // Assunto personalizado legítimo: mantém exatamente onde o usuário
            // colocou, desde que não seja uma tarefa operacional do plano.
            return assuntoSalvo;
          }

          usados.add(assuntoPlano.id);
          return reconciliarAssuntoCanonico(assuntoPlano, assuntoSalvo);
        }),
    }));

    const faltantes = assuntosCanonicos.filter(
      (assunto) => !usados.has(assunto.id)
    );

    if (faltantes.length > 0) {
      const moduloGeralId = listarModulosDaMateria(materiaPlano)[0]?.id;
      const indiceGeral = modulos.findIndex(
        (modulo) =>
          modulo.id === moduloGeralId ||
          normalizarTexto(modulo.nome) === "geral"
      );

      if (indiceGeral >= 0) {
        modulos = modulos.map((modulo, indice) =>
          indice === indiceGeral
            ? {
                ...modulo,
                assuntos: [
                  ...modulo.assuntos,
                  ...faltantes.map((assunto) => clonar(assunto)),
                ],
              }
            : modulo
        );
      } else {
        const moduloPlano = listarModulosDaMateria(materiaPlano)[0];
        if (moduloPlano) {
          modulos.push({
            ...moduloPlano,
            assuntos: faltantes.map((assunto) => clonar(assunto)),
          });
        }
      }
    }

    // Remove duplicidades antigas mantendo a primeira posição escolhida pelo
    // usuário. O espelho `assuntos` é reconstruído pela migração padrão.
    const vistos = new Set<string>();
    modulos = modulos.map((modulo) => ({
      ...modulo,
      assuntos: modulo.assuntos.filter((assunto) => {
        const chave = idsCanonicos.has(assunto.id)
          ? assunto.id
          : nomesCanonicos.has(normalizarTexto(assunto.nome))
            ? normalizarTexto(assunto.nome)
            : assunto.id;

        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      }),
    }));

    const reconciliada = migrarMateriasParaModulos([
      {
        ...materiaPlano,
        ...materiaSalva,
        id: materiaPlano.id,
        nome: materiaPlano.nome,
        modulos,
        assuntos: modulos.flatMap((modulo) => modulo.assuntos),
      },
    ])[0];

    if (reconciliada) {
      resultado.push(reconciliada);
    }
  });

  // Garante que uma matéria/assunto canônico novo apareça também para contas
  // que já possuíam dados salvos.
  materiasDoPlano.forEach((materiaPlano) => {
    const existe = resultado.some(
      (materia) =>
        materia.id === materiaPlano.id ||
        normalizarTexto(materia.nome) === normalizarTexto(materiaPlano.nome)
    );

    if (!existe) {
      resultado.push(clonar(materiaPlano));
    }
  });

  return resultado.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function reconciliarAssuntoCanonico(
  assuntoPlano: Assunto,
  assuntoSalvo: Assunto | undefined
): Assunto {
  if (!assuntoSalvo) {
    return clonar(assuntoPlano);
  }

  const aulas = (assuntoPlano.aulas ?? []).map((aulaPlano) => {
    const aulaSalva = assuntoSalvo.aulas?.find(
      (aula) =>
        aula.id === aulaPlano.id ||
        normalizarTexto(aula.nome) === normalizarTexto(aulaPlano.nome)
    );

    return aulaSalva
      ? {
          ...aulaPlano,
          concluida: aulaSalva.concluida,
          concluidaEm: aulaSalva.concluidaEm,
        }
      : aulaPlano;
  });

  return {
    ...assuntoPlano,
    ...assuntoSalvo,
    id: assuntoPlano.id,
    nome: assuntoPlano.nome,
    prioridade: assuntoSalvo.prioridade ?? assuntoPlano.prioridade,
    aula: assuntoPlano.aula,
    questoes: assuntoPlano.questoes,
    aulas,
    tarefas: assuntoSalvo.tarefas ?? assuntoPlano.tarefas,
  };
}

function reconciliarAssuntoPortugues(
  assuntoPlano: Assunto,
  assuntoSalvo: Assunto | undefined,
  assuntosSalvos: Assunto[]
): Assunto {
  const aulas = (assuntoPlano.aulas ?? []).map((aulaPlano) => {
    const aulaSalva = assuntoSalvo?.aulas?.find(
      (aula) =>
        aula.id === aulaPlano.id ||
        normalizarTexto(aula.nome) === normalizarTexto(aulaPlano.nome)
    );

    // Na versão anterior cada videoaula podia estar cadastrada como um
    // assunto independente. Alguns nomes antigos não são idênticos aos nomes
    // atuais (ex.: "Sílaba - Parte 1" -> "Parte 1" e "Parte 01" -> "Parte 1").
    // O próprio Plano é a fonte mais segura de aliases porque a Etapa 14 já
    // aponta cada missão antiga para o aulaId canônico atual.
    const aliasesDoPlano = planoPMPELegado.flatMap((semana) =>
      semana.dias.flatMap((dia) =>
        dia.missoes
          .filter(
            (missao) =>
              missao.tipo === "conteudo" &&
              obterReferenciasDaMissao(missao).some(
                (referencia) =>
                  referencia.materiaId === "portugues" &&
                  referencia.aulaId === aulaPlano.id
              )
          )
          .map((missao) => normalizarTexto(missao.assunto))
      )
    );

    const assuntoLegadoDaAula = assuntosSalvos.find(
      (assunto) =>
        assunto.id === aulaPlano.id ||
        normalizarTexto(assunto.nome) === normalizarTexto(aulaPlano.nome) ||
        aliasesDoPlano.includes(normalizarTexto(assunto.nome)) ||
        Boolean(
          assunto.aula &&
          aulaPlano.url &&
          assunto.aula === aulaPlano.url
        )
    );

    return {
      ...aulaPlano,
      concluida: assuntoSalvo?.concluido
        ? true
        : aulaSalva?.concluida ?? assuntoLegadoDaAula?.concluido ?? false,
      concluidaEm:
        aulaSalva?.concluidaEm ??
        assuntoLegadoDaAula?.concluidoEm ??
        assuntoSalvo?.concluidoEm,
    };
  });

  const todasAsAulasConcluidas =
    aulas.length > 0 && aulas.every((aula) => aula.concluida);

  return {
    ...assuntoPlano,
    ...(assuntoSalvo ?? {}),
    id: assuntoPlano.id,
    nome: assuntoPlano.nome,
    prioridade: assuntoSalvo?.prioridade ?? assuntoPlano.prioridade,
    aulas,
    tarefas: assuntoSalvo?.tarefas ?? assuntoPlano.tarefas,
    aula: aulas[0]?.url ?? assuntoPlano.aula,
    concluido: assuntoSalvo?.concluido === true || todasAsAulasConcluidas,
    concluidoEm:
      assuntoSalvo?.concluidoEm ??
      (todasAsAulasConcluidas
        ? aulas.map((aula) => aula.concluidaEm).filter(Boolean).sort().at(-1)
        : undefined),
  };
}

function normalizarTexto(
  texto: string
) {
  return texto
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

function sincronizarMissoesDeConteudoComMaterias(
  materias: Materia[],
  atuais: string[]
) {
  const idsMissoesConteudo = new Set<string>();
  const idsConcluidos = new Set<string>();
  const atuaisSet = new Set(atuais);

  const referenciaConcluida = (
    referencia: ReturnType<typeof obterReferenciasDaMissao>[number]
  ) => {
    const materia = materias.find((item) => item.id === referencia.materiaId);
    const modulo = materia
      ? listarModulosDaMateria(materia).find((item) => item.id === referencia.moduloId)
      : undefined;
    const assunto = modulo?.assuntos.find((item) => item.id === referencia.assuntoId);
    if (!assunto) return null;

    if (referencia.aulaId) {
      const aula = assunto.aulas?.find((item) => item.id === referencia.aulaId);
      return aula ? aula.concluida : null;
    }

    return assunto.concluido;
  };

  planoPMPE.forEach((semana) => {
    semana.dias.forEach((dia) => {
      dia.missoes.forEach((missao) => {
        if (missao.tipo !== "conteudo") return;

        idsMissoesConteudo.add(missao.id);
        const referencias = obterReferenciasDaMissao(missao);
        if (referencias.length === 0) {
          if (atuaisSet.has(missao.id)) idsConcluidos.add(missao.id);
          return;
        }

        const estados = referencias.map(referenciaConcluida);
        if (estados.some((estado) => estado === null)) {
          if (atuaisSet.has(missao.id)) idsConcluidos.add(missao.id);
          return;
        }

        if (estados.every(Boolean)) idsConcluidos.add(missao.id);
      });
    });
  });

  const operacionais = atuais.filter((id) => !idsMissoesConteudo.has(id));
  return Array.from(new Set([...operacionais, ...Array.from(idsConcluidos)]));
}

/**
 * Recupera progresso de Português gravado por versões anteriores antes de
 * recalcular as missões pela árvore canônica. A regra é intencionalmente
 * conservadora: só usa evidências fortes já existentes no histórico.
 *
 * Fontes aceitas:
 * - missão de Português já concluída;
 * - sessão vinculada a uma missão de Português;
 * - revisão de Português (uma revisão só existia após conclusão).
 *
 * Isso impede a Etapa 14 de transformar "histórico não reconhecido" em
 * "não concluído" e depois sobrescrever esse estado na nuvem.
 */
function recuperarHistoricoPortugues(
  materias: Materia[],
  missoesConcluidas: string[],
  sessoes: SessaoEstudo[],
  revisoes: Revisao[]
): Materia[] {
  const portugues = materias.find(
    (materia) => normalizarTexto(materia.nome) === "portugues"
  );

  if (!portugues) return materias;

  const aulasConcluidas = new Set<string>();
  const assuntosConcluidos = new Set<string>();
  const concluidaEmPorAula = new Map<string, string>();
  const concluidaEmPorAssunto = new Map<string, string>();
  const idsConcluidos = new Set(missoesConcluidas);

  const missoesPortugues = planoPMPELegado.flatMap((semana) =>
    semana.dias.flatMap((dia) =>
      dia.missoes.filter(
        (missao) =>
          missao.tipo === "conteudo" &&
          obterReferenciasDaMissao(missao).some(
            (referencia) => referencia.materiaId === portugues.id
          )
      )
    )
  );

  const missoesPorId = new Map(
    missoesPortugues.map((missao) => [missao.id, missao])
  );

  function registrarMissao(missaoId: string, data?: string) {
    const missao = missoesPorId.get(missaoId);
    if (!missao) return;

    obterReferenciasDaMissao(missao).forEach((referencia) => {
      if (referencia.aulaId) {
        aulasConcluidas.add(referencia.aulaId);
        if (data && !concluidaEmPorAula.has(referencia.aulaId)) {
          concluidaEmPorAula.set(referencia.aulaId, data);
        }
      } else {
        assuntosConcluidos.add(referencia.assuntoId);
        if (data && !concluidaEmPorAssunto.has(referencia.assuntoId)) {
          concluidaEmPorAssunto.set(referencia.assuntoId, data);
        }
      }
    });
  }

  idsConcluidos.forEach((id) => registrarMissao(id));

  sessoes.forEach((sessao) => {
    if (normalizarTexto(sessao.materia) !== "portugues") return;

    if (sessao.missaoId) {
      registrarMissao(
        sessao.missaoId,
        sessao.finalizadaEm ?? sessao.data
      );
      return;
    }

    // Compatibilidade com sessões antigas que não possuíam missaoId.
    const nomeAssunto = normalizarTexto(sessao.assunto);
    const missao = missoesPortugues.find(
      (item) => normalizarTexto(item.assunto) === nomeAssunto
    );
    if (missao) {
      registrarMissao(missao.id, sessao.finalizadaEm ?? sessao.data);
    }
  });

  revisoes.forEach((revisao) => {
    if (normalizarTexto(revisao.materia) !== "portugues") return;

    const data = revisao.dataCriacao || revisao.dataConclusao;
    const assuntoCanonico = listarAssuntosDaMateria(portugues).find(
      (assunto) =>
        assunto.id === revisao.assuntoId ||
        normalizarTexto(assunto.nome) === normalizarTexto(revisao.assunto)
    );

    if (assuntoCanonico) {
      assuntosConcluidos.add(assuntoCanonico.id);
      if (data && !concluidaEmPorAssunto.has(assuntoCanonico.id)) {
        concluidaEmPorAssunto.set(assuntoCanonico.id, data);
      }
      return;
    }

    const nomeRevisao = normalizarTexto(revisao.assunto);
    const missao = missoesPortugues.find(
      (item) => normalizarTexto(item.assunto) === nomeRevisao
    );
    if (missao) registrarMissao(missao.id, data);
  });

  if (aulasConcluidas.size === 0 && assuntosConcluidos.size === 0) {
    return materias;
  }

  let alterou = false;

  const atualizadas = materias.map((materia) => {
    if (materia.id !== portugues.id) return materia;

    const modulos = listarModulosDaMateria(materia).map((modulo) => ({
      ...modulo,
      assuntos: modulo.assuntos.map((assunto) => {
        const assuntoTinhaEvidencia = assuntosConcluidos.has(assunto.id);
        const aulas = (assunto.aulas ?? []).map((aula) => {
          const deveConcluir =
            aula.concluida ||
            assuntoTinhaEvidencia ||
            aulasConcluidas.has(aula.id);

          if (deveConcluir && !aula.concluida) alterou = true;

          return deveConcluir
            ? {
                ...aula,
                concluida: true,
                concluidaEm:
                  aula.concluidaEm ??
                  concluidaEmPorAula.get(aula.id) ??
                  concluidaEmPorAssunto.get(assunto.id) ??
                  new Date().toISOString(),
              }
            : aula;
        });

        const todasAsAulasConcluidas =
          aulas.length > 0 && aulas.every((aula) => aula.concluida);
        const deveConcluirAssunto =
          assunto.concluido || assuntoTinhaEvidencia || todasAsAulasConcluidas;

        if (deveConcluirAssunto && !assunto.concluido) alterou = true;

        return {
          ...assunto,
          aulas,
          concluido: deveConcluirAssunto,
          conclusaoOrigem: deveConcluirAssunto
            ? (assunto.conclusaoOrigem ?? "importado")
            : assunto.conclusaoOrigem,
          concluidoEm: deveConcluirAssunto
            ? (
                assunto.concluidoEm ??
                concluidaEmPorAssunto.get(assunto.id) ??
                aulas
                  .map((aula) => aula.concluidaEm)
                  .filter((data): data is string => Boolean(data))
                  .sort()
                  .at(-1) ??
                new Date().toISOString()
              )
            : assunto.concluidoEm,
        };
      }),
    }));

    return {
      ...materia,
      modulos,
      assuntos: modulos.flatMap((modulo) => modulo.assuntos),
    };
  });

  return alterou ? atualizadas : materias;
}

function mesmosIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const conjunto = new Set(a);
  return b.every((id) => conjunto.has(id));
}

function reconciliarEstadoComConteudos(
  estado: EstadoAppNuvem
): EstadoAppNuvem {
  const estadoCursos = reconciliarCursosImportados(estado);
  // Reapply imports after the canonical syllabus so same-label lessons survive.
  const materiasBase = reconciliarCursosImportados({
    ...estadoCursos,
    materias: reconciliarMateriasComPlano(estadoCursos.materias, usaPlanoPadrao(estadoCursos.configuracoes)),
  }).materias;
  const materias = usaPlanoPadrao(estadoCursos.configuracoes) ? recuperarHistoricoPortugues(
    materiasBase,
    estado.missoesConcluidas,
    estado.sessoes,
    estado.revisoes
  ) : materiasBase;
  const sessoes = reconciliarSessoesComConteudos(materias, estado.sessoes);
  const questoes = reconciliarQuestoesComConteudos(materias, estado.questoes);
  const revisoes = reconciliarRevisoesComConteudos(materias, estado.revisoes);
  const missoesConcluidas = usaPlanoPadrao(estadoCursos.configuracoes) ? sincronizarMissoesDeConteudoComMaterias(
    materias,
    estado.missoesConcluidas
  ) : estado.missoesConcluidas;

  return {
    ...estadoCursos,
    materias,
    sessoes,
    questoes,
    revisoes,
    missoesConcluidas,
  };
}

function chaveDaConta(
  userId: string,
  nome: string
) {
  return `pmpe:${userId}:${nome}`;
}

export function AppProvider({ children }: AppProviderProps) {
  const { usuario } = useAuth();
  return <EstadoDaConta key={usuario?.id ?? "sem-usuario"}>{children}</EstadoDaConta>;
}

function EstadoDaConta({
  children,
}: AppProviderProps) {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id;

  const userId =
    usuarioId ?? "sem-usuario";

  const nomeCadastro = typeof usuario?.user_metadata?.nome === "string" ? usuario.user_metadata.nome : "";
  const [configuracoes, setConfiguracoes] = useLocalStorage<ConfiguracoesApp>(
    chaveDaConta(userId, "configuracoes"), criarConfiguracoesIniciais(nomeCadastro)
  );

  const [materias, setMaterias] =
    useLocalStorage<Materia[]>(
      chaveDaConta(userId, "materias"),
      []
    );

  useEffect(() => {
    const reconciliadas =
      reconciliarMateriasComPlano(materias, configuracoes.planoPadraoAtivo !== false);

    if (
      JSON.stringify(reconciliadas) !==
      JSON.stringify(materias)
    ) {
      setMaterias(reconciliadas);
    }
  }, [materias, setMaterias, configuracoes.planoPadraoAtivo]);

  const [questoes, setQuestoes] =
    useLocalStorage<RegistroQuestao[]>(
      chaveDaConta(userId, "questoes"),
      []
    );

  const [sessoes, setSessoes] =
    useLocalStorage<SessaoEstudo[]>(
      chaveDaConta(userId, "sessoes"),
      []
    );

  const [revisoes, setRevisoes] =
    useLocalStorage<Revisao[]>(
      chaveDaConta(userId, "revisoes"),
      []
    );

  const [simulados, setSimulados] =
    useLocalStorage<Simulado[]>(
      chaveDaConta(userId, "simulados"),
      []
    );

  const [bancoQuestoes, setBancoQuestoes] =
    useLocalStorage<QuestaoBanco[]>(
      chaveDaConta(userId, "banco-questoes"),
      []
    );

  const [
    simuladosGerados,
    setSimuladosGerados,
  ] = useLocalStorage<SimuladoGerado[]>(
    chaveDaConta(userId, "simulados-gerados"),
    []
  );

  const [
    missoesConcluidas,
    setMissoesConcluidas,
  ] = useLocalStorage<string[]>(
    chaveDaConta(userId, "missoes-concluidas"),
    []
  );

  // Etapa 15: sessões, questões e revisões antigas passam a apontar para os
  // mesmos IDs canônicos de Conteúdos. Isso também corrige nomes legados de
  // Português sem apagar histórico concluído.
  useEffect(() => {
    const sessoesCanonicas = reconciliarSessoesComConteudos(materias, sessoes);
    const questoesCanonicas = reconciliarQuestoesComConteudos(materias, questoes);
    const revisoesCanonicas = reconciliarRevisoesComConteudos(materias, revisoes);

    if (!referenciasIguais(sessoes, sessoesCanonicas)) {
      setSessoes(sessoesCanonicas);
    }
    if (!referenciasIguais(questoes, questoesCanonicas)) {
      setQuestoes(questoesCanonicas);
    }
    if (!referenciasIguais(revisoes, revisoesCanonicas)) {
      setRevisoes(revisoesCanonicas);
    }
  }, [
    materias,
    sessoes,
    questoes,
    revisoes,
    setSessoes,
    setQuestoes,
    setRevisoes,
  ]);

  // Etapa 14.1: antes de derivar as missões pela árvore canônica, recupera
  // qualquer evidência de progresso de Português gravada por versões antigas.
  // A recuperação roda primeiro e, se alterar a árvore, a sincronização das
  // missões só acontece no render seguinte. Assim nenhum histórico antigo é
  // apagado antes de ser convertido para aula/assunto canônico.
  useEffect(() => {
    if (configuracoes.planoPadraoAtivo === false) return;
    const recuperadas = recuperarHistoricoPortugues(
      materias,
      missoesConcluidas,
      sessoes,
      revisoes
    );

    if (recuperadas !== materias) {
      setMaterias(recuperadas);
      return;
    }

    setMissoesConcluidas((anteriores) => {
      const sincronizadas = sincronizarMissoesDeConteudoComMaterias(
        materias,
        anteriores
      );

      return mesmosIds(anteriores, sincronizadas)
        ? anteriores
        : sincronizadas;
    });
  }, [
    materias,
    missoesConcluidas,
    sessoes,
    revisoes,
    setMaterias,
    setMissoesConcluidas,
    configuracoes.planoPadraoAtivo,
  ]);

  useEffect(() => {
    // Espelho legado: o valor principal já é protegido pelo hook da conta.
    // Falta de espaço neste cache não pode interromper a interface.
    try {
      localStorage.setItem(
        chaveArmazenamentoConta("pmpe_plano_missoes_concluidas", criarEscopoArmazenamento(userId, configuracoes)),
        JSON.stringify(missoesConcluidas)
      );
    } catch { /* A cópia canônica e a fila de sincronização são preservadas. */ }

    window.dispatchEvent(new Event("pmpe-plano-atualizado"));
  }, [missoesConcluidas, userId, configuracoes]);

  const [
    statusNuvem,
    setStatusNuvem,
  ] = useState<StatusNuvem>(
    usuario ? "carregando" : "sincronizado"
  );

  const [erroNuvem, setErroNuvem] =
    useState("");

  const [alteracoesPendentes, setAlteracoesPendentes] =
    useState(0);

  const [ultimaSincronizacao, setUltimaSincronizacao] =
    useState<string | null>(null);

  const nuvemInicializadaRef =
    useRef(false);

  const hidratandoRef =
    useRef(false);

  const timerSalvarRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const ultimoEstadoSalvoRef =
    useRef("");

  const revisaoBaseRef = useRef(0);
  const conflitoRef = useRef(false);

  const dadosAtuaisRef = useRef({
    materias,
    questoes,
    sessoes,
    revisoes,
    simulados,
    bancoQuestoes,
    simuladosGerados,
    configuracoes,
    missoesConcluidas,
  });

  useEffect(() => {
    dadosAtuaisRef.current = {
      materias,
      questoes,
      sessoes,
      revisoes,
      simulados,
      bancoQuestoes,
      simuladosGerados,
      configuracoes,
      missoesConcluidas,
    };
  }, [
    materias,
    questoes,
    sessoes,
    revisoes,
    simulados,
    bancoQuestoes,
    simuladosGerados,
    configuracoes,
    missoesConcluidas,
  ]);

  useEffect(() => {
    if (userId === "sem-usuario" || statusNuvem !== "sincronizado") {
      return;
    }

    let ativo = true;

    async function importarTentativasIA() {
      try {
        const resultados = await listarResultadosQuestoesIA();
        if (!ativo) return;

        try {
          const chave = chaveArmazenamentoConta("pmpe_resultados_simulados_ia", criarEscopoArmazenamento(userId, dadosAtuaisRef.current.configuracoes));
          const locais: unknown = JSON.parse(localStorage.getItem(chave) || "[]");
          if (Array.isArray(locais)) {
            const atualizados = aplicarAuditoriasResultadosLocais(locais, resultados);
            if (atualizados !== locais) {
              localStorage.setItem(chave, JSON.stringify(atualizados));
              window.dispatchEvent(new Event("pmpe-simulado-ia-finalizado"));
            }
          }
        } catch (erro) {
          console.error("Não foi possível atualizar o cache da tentativa revisada:", erro);
        }

        setQuestoes((anteriores) =>
          mesclarResultadosQuestoesIANoHistorico({
            questoes: anteriores,
            simulados: [],
            resultados,
          }).questoes
        );

        setSimulados((anteriores) =>
          mesclarResultadosQuestoesIANoHistorico({
            questoes: [],
            simulados: anteriores,
            resultados,
          }).simulados
        );
      } catch (erro) {
        console.error(
          "Erro ao reconciliar tentativas de questões IA:",
          erro
        );
      }
    }

    function aoSalvarResultadoIA() {
      void importarTentativasIA();
    }

    void importarTentativasIA();
    window.addEventListener(
      "pmpe-resultado-questoes-ia-salvo",
      aoSalvarResultadoIA
    );

    return () => {
      ativo = false;
      window.removeEventListener(
        "pmpe-resultado-questoes-ia-salvo",
        aoSalvarResultadoIA
      );
    };
  }, [
    userId,
    statusNuvem,
    setQuestoes,
    setSimulados,
  ]);

  const aplicarEstadoDaNuvem =
    useCallback(
      (
        estado: EstadoAppNuvem
      ) => {
        hidratandoRef.current = true;

        const estadoReconciliado =
          reconciliarEstadoComConteudos(estado);

        setMaterias(estadoReconciliado.materias);
        setQuestoes(estadoReconciliado.questoes);
        setSessoes(estadoReconciliado.sessoes);
        setRevisoes(estadoReconciliado.revisoes);
        setSimulados(estadoReconciliado.simulados);
        setBancoQuestoes(estadoReconciliado.bancoQuestoes);
        setSimuladosGerados(estadoReconciliado.simuladosGerados);
        setConfiguracoes(estadoReconciliado.configuracoes);
        setMissoesConcluidas(estadoReconciliado.missoesConcluidas);

        ultimoEstadoSalvoRef.current =
          assinaturaEstado(
            estadoReconciliado
          );

        window.setTimeout(() => {
          hidratandoRef.current = false;
        }, 0);
      },
      [
        setMaterias,
        setQuestoes,
        setSessoes,
        setRevisoes,
        setSimulados,
        setBancoQuestoes,
        setSimuladosGerados,
        setConfiguracoes,
        setMissoesConcluidas,
      ]
    );

  function confirmarSincronizacaoLocal(
    idDaConta: string,
    estado: EstadoAppNuvem
  ) {
    revisaoBaseRef.current = obterRevisaoSincronizacao(estado);
    conflitoRef.current = false;
    registrarSincronizacaoConfirmada(idDaConta, estado);
    limparEstadoPendenteSincronizacao(idDaConta);
    setAlteracoesPendentes(0);
    setUltimaSincronizacao(
      estado.atualizadoEm ?? estado.salvoEm
    );
    setErroNuvem("");
    setStatusNuvem("sincronizado");
    ultimoEstadoSalvoRef.current = assinaturaEstado(estado);

    window.dispatchEvent(
      new Event(
        "pmpe-nuvem-sincronizada"
      )
    );
  }

  function marcarConflito(
    erro: ConflitoSincronizacaoError
  ) {
    conflitoRef.current = true;
    setAlteracoesPendentes(1);
    setErroNuvem(erro.message);
    setStatusNuvem("conflito");
  }

  useEffect(() => {
    if (!usuarioId) {
      nuvemInicializadaRef.current = false;
      hidratandoRef.current = false;
      ultimoEstadoSalvoRef.current = "";
      revisaoBaseRef.current = 0;
      conflitoRef.current = false;
      setErroNuvem("");
      setAlteracoesPendentes(0);
      setUltimaSincronizacao(null);
      setStatusNuvem("sincronizado");
      return;
    }

    const idDaConta = usuarioId;
    let ativo = true;

    async function iniciarNuvem() {
      const metadadosLocais =
        obterMetadadosSincronizacaoLocal(idDaConta);
      revisaoBaseRef.current =
        metadadosLocais.ultimaRevisaoConfirmada;
      setUltimaSincronizacao(
        metadadosLocais.ultimaSincronizacaoEm
      );

      const pendenteLocal =
        obterEstadoPendenteSincronizacao(idDaConta);

      if (pendenteLocal) {
        setAlteracoesPendentes(1);
      }

      if (!navegadorEstaOnline()) {
        nuvemInicializadaRef.current = true;
        setStatusNuvem("offline");
        setErroNuvem(
          "Sem conexão. As alterações continuarão salvas neste aparelho e serão sincronizadas quando a internet voltar."
        );
        return;
      }

      try {
        nuvemInicializadaRef.current = false;
        setStatusNuvem("carregando");
        setErroNuvem("");

        const estadoNuvem =
          await carregarEstadoDaNuvem(
            idDaConta
          );

        if (!ativo) return;

        // Uma limpeza solicitada pelo titular prevalece sobre cópias offline antigas.
        // Conflitos comuns continuam protegidos pelo controle de revisão existente.
        if (estadoNuvem && houveReinicioDaConta(
          pendenteLocal?.estado.configuracoes ?? dadosAtuaisRef.current.configuracoes,
          estadoNuvem.configuracoes
        )) {
          aplicarEstadoDaNuvem(estadoNuvem);
          confirmarSincronizacaoLocal(idDaConta, estadoNuvem);
          nuvemInicializadaRef.current = true;
          return;
        }

        // Se havia trabalho offline, ele é enviado primeiro. Isso impede que
        // uma carga da nuvem apague silenciosamente o estado local pendente.
        if (pendenteLocal) {
          const revisaoNuvem = obterRevisaoSincronizacao(estadoNuvem);

          if (
            estadoNuvem &&
            revisaoNuvem !== pendenteLocal.baseRevision
          ) {
            marcarConflito(
              new ConflitoSincronizacaoError(
                revisaoNuvem,
                pendenteLocal.baseRevision
              )
            );
            revisaoBaseRef.current = pendenteLocal.baseRevision;
            nuvemInicializadaRef.current = true;
            return;
          }

          const salvo =
            await salvarEstadoComControleDeRevisao(
              idDaConta,
              pendenteLocal.estado,
              pendenteLocal.baseRevision
            );

          if (!ativo) return;

          aplicarEstadoDaNuvem(salvo);
          confirmarSincronizacaoLocal(idDaConta, salvo);
          nuvemInicializadaRef.current = true;
          return;
        }

        if (estadoNuvem) {
          const estadoReconciliado =
            reconciliarEstadoComConteudos(estadoNuvem);

          const estruturaMudou =
            assinaturaEstado(estadoReconciliado) !==
            assinaturaEstado(estadoNuvem);

          let estadoFinal = estadoReconciliado;

          // Mudança estrutural intencional também avança a revisão. Assim um
          // segundo aparelho antigo não consegue salvar por cima dela depois.
          if (estruturaMudou) {
            const agora = new Date().toISOString();
            estadoFinal = {
              ...estadoReconciliado,
              syncRevision: obterRevisaoSincronizacao(estadoNuvem) + 1,
              atualizadoEm: agora,
              salvoEm: agora,
            };

            await salvarEstadoEstruturalComSeguranca(
              idDaConta,
              estadoNuvem,
              estadoFinal
            );
          }

          if (!ativo) return;

          aplicarEstadoDaNuvem(estadoFinal);
          confirmarSincronizacaoLocal(idDaConta, estadoFinal);
        } else {
          const agora = new Date().toISOString();
          const estadoInicial = {
            ...criarEstadoInicialDaConta(nomeCadastro),
            syncRevision: 1,
            atualizadoEm: agora,
            salvoEm: agora,
          };

          await salvarEstadoNaNuvem(
            idDaConta,
            estadoInicial
          );

          if (!ativo) return;

          aplicarEstadoDaNuvem(
            estadoInicial
          );
          confirmarSincronizacaoLocal(idDaConta, estadoInicial);
        }

        nuvemInicializadaRef.current = true;
      } catch (erro) {
        if (!ativo) return;

        if (erro instanceof ConflitoSincronizacaoError) {
          marcarConflito(erro);
          nuvemInicializadaRef.current = true;
          return;
        }

        const mensagem =
          obterMensagemErro(
            erro,
            "Erro desconhecido na sincronização."
          );

        console.error(
          "Erro ao iniciar nuvem:",
          erro
        );

        // Em falha de rede o estado local continua utilizável e poderá entrar
        // na fila assim que o usuário fizer uma alteração.
        setErroNuvem(mensagem);
        setStatusNuvem(
          navegadorEstaOnline() ? "erro" : "offline"
        );
        nuvemInicializadaRef.current = true;
      }
    }

    void iniciarNuvem();

    return () => {
      ativo = false;

      if (timerSalvarRef.current) {
        clearTimeout(
          timerSalvarRef.current
        );
        timerSalvarRef.current = null;
      }
    };
  }, [
    usuarioId,
    nomeCadastro,
    aplicarEstadoDaNuvem,
  ]);

  const estadoAtual =
    useMemo(
      () =>
        montarEstadoNuvem({
          materias,
          questoes,
          sessoes,
          revisoes,
          simulados,
          bancoQuestoes,
          simuladosGerados,
          configuracoes,
          missoesConcluidas,
        }),
      [
        materias,
        questoes,
        sessoes,
        revisoes,
        simulados,
        bancoQuestoes,
        simuladosGerados,
        configuracoes,
        missoesConcluidas,
      ]
    );

  useEffect(() => {
    if (
      !usuarioId ||
      !nuvemInicializadaRef.current ||
      hidratandoRef.current
    ) {
      return;
    }

    const assinatura =
      assinaturaEstado(
        estadoAtual
      );

    if (
      assinatura ===
      ultimoEstadoSalvoRef.current
    ) {
      return;
    }

    try {
      registrarEstadoPendenteSincronizacao(
        usuarioId,
        estadoAtual,
        revisaoBaseRef.current
      );
      setAlteracoesPendentes(1);
    } catch (erroFila) {
      const mensagem = obterMensagemErro(
        erroFila,
        "Não foi possível criar a cópia local da alteração pendente."
      );
      setErroNuvem(mensagem);
      setStatusNuvem("erro");
      return;
    }

    if (!navegadorEstaOnline()) {
      setStatusNuvem("offline");
      setErroNuvem(
        "Sem conexão. Alteração guardada neste aparelho e aguardando sincronização."
      );
      return;
    }

    if (conflitoRef.current) {
      setStatusNuvem("conflito");
      return;
    }

    if (timerSalvarRef.current) {
      clearTimeout(
        timerSalvarRef.current
      );
    }

    setStatusNuvem("salvando");

    const idDaConta = usuarioId;

    timerSalvarRef.current =
      setTimeout(() => {
        void salvarAlteracao(
          idDaConta,
          estadoAtual,
          assinatura
        );
      }, 1200);

    return () => {
      if (timerSalvarRef.current) {
        clearTimeout(
          timerSalvarRef.current
        );
        timerSalvarRef.current = null;
      }
    };
  }, [
    estadoAtual,
    usuarioId,
  ]);

  async function salvarAlteracao(
    idDaConta: string,
    estado: EstadoAppNuvem,
    assinatura: string
  ) {
    try {
      registrarTentativaPendente(idDaConta);

      const pendente =
        obterEstadoPendenteSincronizacao(idDaConta);
      const revisaoBase =
        pendente?.baseRevision ?? revisaoBaseRef.current;

      const salvo =
        await salvarEstadoComControleDeRevisao(
          idDaConta,
          estado,
          revisaoBase
        );

      ultimoEstadoSalvoRef.current =
        assinatura;

      confirmarSincronizacaoLocal(idDaConta, salvo);
    } catch (erro) {
      if (erro instanceof ConflitoSincronizacaoError) {
        marcarConflito(erro);
        return;
      }

      const mensagem =
        obterMensagemErro(
          erro,
          "Erro ao salvar na nuvem."
        );

      console.error(
        "Erro ao salvar na nuvem:",
        erro
      );

      setErroNuvem(mensagem);
      setStatusNuvem(
        navegadorEstaOnline() ? "erro" : "offline"
      );
      setAlteracoesPendentes(1);
    }
  }

  async function sincronizarAgora() {
    if (!usuario) {
      throw new Error(
        "Nenhum usuário autenticado."
      );
    }

    if (!navegadorEstaOnline()) {
      setStatusNuvem("offline");
      throw new Error("Sem conexão com a internet.");
    }

    try {
      setStatusNuvem("salvando");

      const estado =
        montarEstadoNuvem(
          dadosAtuaisRef.current
        );
      const assinaturaAtual = assinaturaEstado(estado);
      let pendente = obterEstadoPendenteSincronizacao(usuario.id);

      if (pendente) {
        const estadoNuvem = await carregarEstadoDaNuvem(usuario.id);
        if (estadoNuvem && houveReinicioDaConta(pendente.estado.configuracoes, estadoNuvem.configuracoes)) {
          aplicarEstadoDaNuvem(estadoNuvem);
          confirmarSincronizacaoLocal(usuario.id, estadoNuvem);
          return;
        }
      }

      // Sem alteração local pendente, "sincronizar" significa primeiro
      // consultar a nuvem. Assim um aparelho que apenas voltou a ficar online
      // recebe uma revisão mais nova em vez de tentar sobrescrevê-la.
      if (
        !pendente &&
        assinaturaAtual === ultimoEstadoSalvoRef.current
      ) {
        const estadoNuvem = await carregarEstadoDaNuvem(usuario.id);

        if (estadoNuvem) {
          aplicarEstadoDaNuvem(estadoNuvem);
          confirmarSincronizacaoLocal(usuario.id, estadoNuvem);
          return;
        }
      }

      if (!pendente) {
        pendente = registrarEstadoPendenteSincronizacao(
          usuario.id,
          estado,
          revisaoBaseRef.current
        );
      }

      setAlteracoesPendentes(1);
      registrarTentativaPendente(usuario.id);

      const salvo =
        await salvarEstadoComControleDeRevisao(
          usuario.id,
          pendente.estado,
          pendente.baseRevision
        );

      confirmarSincronizacaoLocal(usuario.id, salvo);
    } catch (erro) {
      if (erro instanceof ConflitoSincronizacaoError) {
        marcarConflito(erro);
        throw erro;
      }

      const mensagem =
        obterMensagemErro(
          erro,
          "Erro ao sincronizar."
        );

      setErroNuvem(mensagem);
      setStatusNuvem(
        navegadorEstaOnline() ? "erro" : "offline"
      );
      throw erro;
    }
  }

  async function resolverConflitoSincronizacao(
    preferencia: "nuvem" | "local"
  ) {
    if (!usuario) {
      throw new Error("Nenhum usuário autenticado.");
    }

    if (!navegadorEstaOnline()) {
      throw new Error("É necessário estar online para resolver o conflito.");
    }

    setStatusNuvem("salvando");

    const estadoNuvem = await carregarEstadoDaNuvem(usuario.id);
    const estadoLocal = montarEstadoNuvem(dadosAtuaisRef.current);

    if (preferencia === "nuvem" || (estadoNuvem && houveReinicioDaConta(estadoLocal.configuracoes, estadoNuvem.configuracoes))) {
      if (!estadoNuvem) {
        throw new Error("Não existe estado na nuvem para restaurar.");
      }

      criarBackupAutomaticoLocal(
        usuario.id,
        estadoLocal,
        "antes_resolucao_conflito"
      );

      aplicarEstadoDaNuvem(estadoNuvem);
      confirmarSincronizacaoLocal(usuario.id, estadoNuvem);
      return;
    }

    const agora = new Date().toISOString();
    const revisaoNuvem = obterRevisaoSincronizacao(estadoNuvem);
    const localParaSalvar: EstadoAppNuvem = {
      ...estadoLocal,
      syncRevision: revisaoNuvem + 1,
      atualizadoEm: agora,
      salvoEm: agora,
    };

    validarIntegridadeEstado(localParaSalvar);

    if (estadoNuvem) {
      await salvarEstadoEstruturalComSeguranca(
        usuario.id,
        estadoNuvem,
        localParaSalvar,
        "antes_resolucao_conflito"
      );
    } else {
      await salvarEstadoNaNuvem(usuario.id, localParaSalvar);
    }

    aplicarEstadoDaNuvem(localParaSalvar);
    confirmarSincronizacaoLocal(usuario.id, localParaSalvar);
  }

  async function restaurarEstadoCompleto(
    estado: EstadoAppNuvem
  ) {
    validarIntegridadeEstado(estado);

    const estadoAtualLocal = montarEstadoNuvem(dadosAtuaisRef.current);
    const estadoReconciliado = reconciliarEstadoComConteudos(estado);

    if (!usuario) {
      criarBackupAutomaticoLocal(
        "sem-usuario",
        estadoAtualLocal,
        "antes_restauracao_manual"
      );
      aplicarEstadoDaNuvem(estadoReconciliado);
      return;
    }

    criarBackupAutomaticoLocal(
      usuario.id,
      estadoAtualLocal,
      "antes_restauracao_manual"
    );

    if (!navegadorEstaOnline()) {
      const restauradoOffline: EstadoAppNuvem = {
        ...estadoReconciliado,
        syncRevision: revisaoBaseRef.current,
        atualizadoEm: new Date().toISOString(),
        salvoEm: new Date().toISOString(),
      };

      registrarEstadoPendenteSincronizacao(
        usuario.id,
        restauradoOffline,
        revisaoBaseRef.current
      );
      setAlteracoesPendentes(1);
      aplicarEstadoDaNuvem(restauradoOffline);
      setStatusNuvem("offline");
      setErroNuvem(
        "Backup restaurado neste aparelho. A nuvem será atualizada quando a internet voltar."
      );
      return;
    }

    const estadoNuvem = await carregarEstadoDaNuvem(usuario.id);
    const agora = new Date().toISOString();
    const restaurado: EstadoAppNuvem = {
      ...estadoReconciliado,
      syncRevision: obterRevisaoSincronizacao(estadoNuvem) + 1,
      atualizadoEm: agora,
      salvoEm: agora,
    };

    validarIntegridadeEstado(restaurado);

    if (estadoNuvem) {
      await salvarEstadoEstruturalComSeguranca(
        usuario.id,
        estadoNuvem,
        restaurado,
        "antes_restauracao_manual"
      );
    } else {
      await salvarEstadoNaNuvem(usuario.id, restaurado);
    }

    aplicarEstadoDaNuvem(restaurado);
    confirmarSincronizacaoLocal(usuario.id, restaurado);
  }

  useEffect(() => {
    if (!usuarioId) return;

    function ficouOffline() {
      setStatusNuvem("offline");
      setErroNuvem(
        "Sem conexão. O Study Pro continuará salvando localmente."
      );
    }

    function voltouOnline() {
      if (conflitoRef.current) {
        setStatusNuvem("conflito");
        return;
      }

      void sincronizarAgora().catch(() => {
        // O estado visual e a fila já são atualizados por sincronizarAgora.
      });
    }

    window.addEventListener("offline", ficouOffline);
    window.addEventListener("online", voltouOnline);

    return () => {
      window.removeEventListener("offline", ficouOffline);
      window.removeEventListener("online", voltouOnline);
    };
    // sincronizarAgora lê os dados atuais por refs; o listener deve mudar apenas com a conta.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  function definirConclusaoAssunto(
    materiaId: string,
    assuntoId: string,
    concluido: boolean,
    moduloId?: string,
    modo: "agora" | "ja-estudado" = "agora",
    preservarAulas = false,
    sincronizarMissoes = true
  ) {
    const materia = materias.find(
      (item) => item.id === materiaId
    );

    const localizacao = materia
      ? encontrarAssunto(materia, assuntoId, moduloId)
      : null;

    const assunto = localizacao?.assunto;

    if (!materia || !assunto) return;

    setMaterias((anteriores) =>
      anteriores.map((itemMateria) =>
        itemMateria.id !== materiaId
          ? itemMateria
          : atualizarAssuntoNaArvore(
              itemMateria,
              assuntoId,
              (itemAssunto) => ({
                ...itemAssunto,
                concluido,
                aulas: preservarAulas
                  ? itemAssunto.aulas
                  : itemAssunto.aulas?.map((aula) => ({
                      ...aula,
                      concluida: concluido,
                      concluidaEm: concluido ? (aula.concluidaEm ?? new Date().toISOString()) : undefined,
                    })),
                conclusaoOrigem: concluido
                  ? (modo === "ja-estudado" ? "importado" : "estudo")
                  : undefined,
                concluidoEm: concluido ? new Date().toISOString() : undefined,
                atualizadoEm:
                  new Date().toISOString(),
              }),
              localizacao?.modulo.id
            )
      )
    );

    const missoesRelacionadas = planoPMPE.flatMap((semana) =>
      semana.dias.flatMap((dia) =>
        dia.missoes.filter((missao) => {
          const referencias = obterReferenciasDaMissao(missao);
          if (referencias.length > 0) {
            return referencias.some(
              (referencia) =>
                referencia.materiaId === materia.id &&
                referencia.assuntoId === assunto.id
            );
          }

          return (
            missao.tipo === "conteudo" &&
            normalizarTexto(missao.materia) === normalizarTexto(materia.nome) &&
            normalizarTexto(missao.assunto) === normalizarTexto(assunto.nome)
          );
        })
      )
    );

    const referenciaFicaraConcluida = (
      referencia: ReturnType<typeof obterReferenciasDaMissao>[number]
    ) => {
      const materiaRef = materias.find((item) => item.id === referencia.materiaId);
      const moduloRef = materiaRef
        ? listarModulosDaMateria(materiaRef).find((item) => item.id === referencia.moduloId)
        : undefined;
      const assuntoRef = moduloRef?.assuntos.find((item) => item.id === referencia.assuntoId);
      if (!assuntoRef) return false;

      if (
        referencia.materiaId === materia.id &&
        referencia.assuntoId === assunto.id
      ) {
        return concluido;
      }

      if (referencia.aulaId) {
        return Boolean(assuntoRef.aulas?.find((item) => item.id === referencia.aulaId)?.concluida);
      }

      return assuntoRef.concluido;
    };

    if (sincronizarMissoes) {
      const idsConcluir = missoesRelacionadas
        .filter((missao) => {
          const referencias = obterReferenciasDaMissao(missao);
          return referencias.length > 0 && referencias.every(referenciaFicaraConcluida);
        })
        .map((missao) => missao.id);
      const idsDesmarcar = missoesRelacionadas
        .filter((missao) => {
          const referencias = obterReferenciasDaMissao(missao);
          return referencias.length === 0 || !referencias.every(referenciaFicaraConcluida);
        })
        .map((missao) => missao.id);

      setMissoesConcluidas((anteriores) =>
        Array.from(
          new Set(
            anteriores
              .filter((id) => !idsDesmarcar.includes(id))
              .concat(idsConcluir)
          )
        )
      );
    }


    if (concluido && modo === "agora") {
      setRevisoes((anteriores) => {
        const jaExiste = anteriores.some(
          (revisao) =>
            !revisao.concluida &&
            (
              (revisao.materiaId === materia.id && revisao.assuntoId === assunto.id) ||
              (
                normalizarTexto(revisao.materia) === normalizarTexto(materia.nome) &&
                normalizarTexto(revisao.assunto) === normalizarTexto(assunto.nome)
              )
            )
        );

        if (jaExiste) return anteriores;

        return [
          criarPrimeiraRevisao({
            materiaId: materia.id,
            moduloId: localizacao?.modulo.id,
            assuntoId: assunto.id,
            materia: materia.nome,
            modulo: localizacao?.modulo.nome,
            assunto: assunto.nome,
            revisoesExistentes: anteriores,
            limiteDiario: configuracoes.metaRevisoesDiaria,
          }),
          ...anteriores,
        ];
      });
    } else {
      setRevisoes((anteriores) =>
        anteriores.filter(
          (revisao) =>
            !(
              !revisao.concluida &&
              (
                (revisao.materiaId === materia.id && revisao.assuntoId === assunto.id) ||
                (
                  normalizarTexto(revisao.materia) === normalizarTexto(materia.nome) &&
                  normalizarTexto(revisao.assunto) === normalizarTexto(assunto.nome)
                )
              )
            )
        )
      );
    }

    window.dispatchEvent(new Event("pmpe-materias-atualizadas"));
    window.dispatchEvent(new Event("pmpe-dashboard-atualizado"));
  }

  function definirConclusaoAula(
    materiaId: string,
    assuntoId: string,
    aulaId: string,
    concluida: boolean,
    moduloId?: string
  ) {
    const materia = materias.find((item) => item.id === materiaId);
    const localizacao = materia
      ? encontrarAssunto(materia, assuntoId, moduloId)
      : null;
    const assunto = localizacao?.assunto;
    if (!materia || !assunto || !assunto.aulas?.some((aula) => aula.id === aulaId)) return;

    const agora = new Date().toISOString();
    const aulasAtualizadas = assunto.aulas.map((aula) =>
      aula.id === aulaId
        ? { ...aula, concluida, concluidaEm: concluida ? agora : undefined }
        : aula
    );
    const assuntoCompleto = aulasAtualizadas.length > 0 && aulasAtualizadas.every((aula) => aula.concluida);

    setMaterias((anteriores) =>
      anteriores.map((itemMateria) =>
        itemMateria.id !== materiaId
          ? itemMateria
          : atualizarAssuntoNaArvore(
              itemMateria,
              assuntoId,
              (itemAssunto) => ({
                ...itemAssunto,
                aulas: itemAssunto.aulas?.map((aula) =>
                  aula.id === aulaId
                    ? { ...aula, concluida, concluidaEm: concluida ? agora : undefined }
                    : aula
                ),
                atualizadoEm: agora,
              }),
              localizacao.modulo.id
            )
      )
    );

    const missoesRelacionadas = planoPMPE.flatMap((semana) =>
      semana.dias.flatMap((dia) =>
        dia.missoes.filter((missao) =>
          obterReferenciasDaMissao(missao).some(
            (referencia) =>
              referencia.materiaId === materiaId &&
              referencia.assuntoId === assuntoId &&
              referencia.aulaId === aulaId
          )
        )
      )
    );

    const referenciaFicaraConcluida = (
      referencia: ReturnType<typeof obterReferenciasDaMissao>[number]
    ) => {
      const materiaRef = materias.find((item) => item.id === referencia.materiaId);
      const moduloRef = materiaRef
        ? listarModulosDaMateria(materiaRef).find((item) => item.id === referencia.moduloId)
        : undefined;
      const assuntoRef = moduloRef?.assuntos.find((item) => item.id === referencia.assuntoId);
      if (!assuntoRef) return false;

      if (referencia.aulaId) {
        if (
          referencia.materiaId === materiaId &&
          referencia.assuntoId === assuntoId &&
          referencia.aulaId === aulaId
        ) return concluida;
        return Boolean(assuntoRef.aulas?.find((item) => item.id === referencia.aulaId)?.concluida);
      }

      return assuntoRef.concluido;
    };

    const idsConcluir = missoesRelacionadas
      .filter((missao) => obterReferenciasDaMissao(missao).every(referenciaFicaraConcluida))
      .map((missao) => missao.id);
    const idsDesmarcar = missoesRelacionadas
      .filter((missao) => !obterReferenciasDaMissao(missao).every(referenciaFicaraConcluida))
      .map((missao) => missao.id);

    setMissoesConcluidas((anteriores) =>
      Array.from(new Set(anteriores.filter((id) => !idsDesmarcar.includes(id)).concat(idsConcluir)))
    );

    // A revisão e a conclusão do edital só mudam quando o assunto inteiro
    // passa de incompleto para completo (ou é reaberto). As missões individuais
    // das aulas são sincronizadas acima, para não desmarcar aulas irmãs.
    if (assunto.concluido !== assuntoCompleto) {
      definirConclusaoAssunto(
        materiaId,
        assuntoId,
        assuntoCompleto,
        localizacao.modulo.id,
        "agora",
        true,
        false
      );
    }

    window.dispatchEvent(new Event("pmpe-materias-atualizadas"));
  }

  function importarProgressoMateria(
    materiaId: string,
    moduloId: string,
    assuntoId: string
  ) {
    const materia = materias.find((item) => item.id === materiaId);
    if (!materia) return 0;

    const modulosOrdenados = listarModulosDaMateria(materia)
      .slice()
      .sort((a, b) => a.ordem - b.ordem);
    const alvos: Array<{ moduloId: string; assuntoId: string }> = [];
    let encontrou = false;

    for (const modulo of modulosOrdenados) {
      for (const assunto of modulo.assuntos) {
        alvos.push({ moduloId: modulo.id, assuntoId: assunto.id });
        if (modulo.id === moduloId && assunto.id === assuntoId) {
          encontrou = true;
          break;
        }
      }
      if (encontrou) break;
    }

    if (!encontrou || alvos.length === 0) return 0;

    const idsAssuntos = new Set(alvos.map((item) => item.assuntoId));

    setMaterias((anteriores) =>
      anteriores.map((itemMateria) => {
        if (itemMateria.id !== materiaId) return itemMateria;
        const modulos = listarModulosDaMateria(itemMateria).map((modulo) => ({
          ...modulo,
          assuntos: modulo.assuntos.map((assunto) =>
            idsAssuntos.has(assunto.id)
              ? {
                  ...assunto,
                  concluido: true,
                  aulas: assunto.aulas?.map((aula) => ({
                    ...aula,
                    concluida: true,
                    concluidaEm: aula.concluidaEm ?? new Date().toISOString(),
                  })),
                  conclusaoOrigem: "importado" as const,
                  concluidoEm: assunto.concluidoEm ?? new Date().toISOString(),
                  atualizadoEm: new Date().toISOString(),
                }
              : assunto
          ),
        }));
        return { ...itemMateria, modulos, assuntos: modulos.flatMap((modulo) => modulo.assuntos) };
      })
    );

    // Itens importados são histórico: remove somente revisões pendentes ligadas a eles.
    setRevisoes((anteriores) =>
      anteriores.filter(
        (revisao) =>
          revisao.concluida ||
          revisao.materiaId !== materiaId ||
          !idsAssuntos.has(revisao.assuntoId)
      )
    );

    const nomesAlvo = new Set(
      listarAssuntosDaMateria(materia)
        .filter((assunto) => idsAssuntos.has(assunto.id))
        .map((assunto) => normalizarTexto(assunto.nome))
    );
    const idsMissoes = planoPMPE.flatMap((semana) =>
      semana.dias.flatMap((dia) =>
        dia.missoes
          .filter((missao) => {
            const referencias = obterReferenciasDaMissao(missao);
            if (referencias.length > 0) {
              return referencias.every(
                (referencia) =>
                  referencia.materiaId === materiaId &&
                  idsAssuntos.has(referencia.assuntoId)
              );
            }

            return (
              missao.tipo === "conteudo" &&
              normalizarTexto(missao.materia) === normalizarTexto(materia.nome) &&
              nomesAlvo.has(normalizarTexto(missao.assunto))
            );
          })
          .map((missao) => missao.id)
      )
    );
    setMissoesConcluidas((anteriores) =>
      Array.from(new Set([...anteriores, ...idsMissoes]))
    );

    window.dispatchEvent(new Event("pmpe-materias-atualizadas"));
    window.dispatchEvent(new Event("pmpe-dashboard-atualizado"));
    return alvos.length;
  }

  return (
    <AppContext.Provider
      value={{
        materias,
        setMaterias,
        questoes,
        setQuestoes,
        sessoes,
        setSessoes,
        revisoes,
        setRevisoes,
        simulados,
        setSimulados,
        bancoQuestoes,
        setBancoQuestoes,
        simuladosGerados,
        setSimuladosGerados,
        configuracoes,
        setConfiguracoes,
        missoesConcluidas,
        setMissoesConcluidas,
        statusNuvem,
        erroNuvem,
        alteracoesPendentes,
        ultimaSincronizacao,
        sincronizarAgora,
        resolverConflitoSincronizacao,
        restaurarEstadoCompleto,
        definirConclusaoAssunto,
        definirConclusaoAula,
        importarProgressoMateria,
      }}
    >
      {statusNuvem === "carregando" ? <div role="status">Carregando seus dados...</div> : <ArmazenamentoConta>{children}</ArmazenamentoConta>}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context =
    useContext(AppContext);

  if (!context) {
    throw new Error(
      "useApp deve ser utilizado dentro de AppProvider."
    );
  }

  return context;
}

function assinaturaEstado(
  estado: EstadoAppNuvem
) {
  const {
    salvoEm: _salvoEm,
    syncRevision: _syncRevision,
    atualizadoEm: _atualizadoEm,
    ...dados
  } = estado;

  return JSON.stringify(dados);
}

function obterMensagemErro(
  erro: unknown,
  padrao: string
) {
  return erro instanceof Error
    ? erro.message
    : padrao;
}
