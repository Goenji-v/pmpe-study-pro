import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useApp } from "./AppContext";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import {
  listarModulosDaMateria,
} from "../services/conteudos/navegarConteudos";
import { obterReferenciasDaMissao, planoPMPE } from "../data/planoPMPE";
import { criarDadosSessaoDaMissao } from "../services/conteudos/sincronizacaoCanonica";
import {
  aplicarAlteracoesComVinculoSeguro,
  missaoPossuiReferenciaCanonica,
  obterMateriaEfetivaDaSessao,
} from "../utils/vinculoPlano";

import type {
  Dificuldade,
  SessaoEstudo,
  TipoSessao,
} from "../types/index";

type StatusCronometro =
  | "parado"
  | "rodando"
  | "pausado";

export type SessaoAtiva = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  aulaId?: string;
  tipo: TipoSessao;
  formatoRevisao?: "teoria" | "questoes";
  objetivo: string;
  observacao: string;
  status: StatusCronometro;
  iniciadoEm: string | null;
  pausadoEm: string | null;
  segundosPausados: number;
  missaoId?: string;
  semana?: number;
  dia?: number;
  urlAula?: string;
  urlQuestoes?: string;
};

export type DadosIniciarSessao = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  aulaId?: string;
  tipo: TipoSessao;
  formatoRevisao?: "teoria" | "questoes";
  objetivo?: string;
  observacao?: string;
  missaoId?: string;
  semana?: number;
  dia?: number;
  urlAula?: string;
  urlQuestoes?: string;
};

export type DadosFinalizacaoSessao = {
  minutosReais: number;
  observacao?: string;

  quantidadeQuestoes?: number;
  quantidadeAcertos?: number;
  quantidadeErros?: number;
  banca?: string;
  dificuldade?: Dificuldade;

  avaliacaoRevisao?:
    | "facil"
    | "media"
    | "dificil";

  formatoRevisao?: "teoria" | "questoes";

  concluirAssunto?: boolean;
};

type ResultadoFinalizacao = {
  sessao: SessaoEstudo;
  revisaoCriada: boolean;
};

type CronometroContextType = {
  sessaoAtiva: SessaoAtiva;
  segundosDecorridos: number;
  cronometroAtivo: boolean;
  iniciar: (dados: DadosIniciarSessao) => boolean;
  atualizarDados: (
    dados: Partial<
      Pick<
        SessaoAtiva,
        "materia" | "materiaId" | "modulo" | "moduloId" |
        "assunto" | "assuntoId" | "aulaId" | "tipo" | "formatoRevisao" |
        "objetivo" | "observacao" |
        "missaoId" | "semana" | "dia" |
        "urlAula" | "urlQuestoes"
      >
    >
  ) => void;
  prepararSessao: (
    dados: DadosIniciarSessao
  ) => void;
  pausar: () => void;
  continuar: () => void;
  finalizar: (
    dados: DadosFinalizacaoSessao
  ) => ResultadoFinalizacao | null;
  cancelar: (
    pedirConfirmacao?: boolean
  ) => void;
};

const sessaoInicial: SessaoAtiva = {
  materia: "",
  assunto: "",
  tipo: "aula",
  objetivo: "",
  observacao: "",
  status: "parado",
  iniciadoEm: null,
  pausadoEm: null,
  segundosPausados: 0,
};

const CronometroContext =
  createContext<CronometroContextType | null>(
    null
  );

function chaveSessao(
  userId: string
) {
  return `pmpe:${userId}:cronometro-sessao-ativa`;
}

export function CronometroProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { usuario } = useAuth();

  const {
    materias,
    setSessoes,
    setQuestoes,
    setSimulados,
    setMissoesConcluidas,
    definirConclusaoAssunto,
    definirConclusaoAula,
  } = useApp();

  const { showToast } = useToast();

  const chaveStorage =
    chaveSessao(
      usuario?.id ?? "sem-usuario"
    );

  const [
    sessaoAtiva,
    setSessaoAtiva,
  ] = useState<SessaoAtiva>(
    () => carregarSessao(chaveStorage)
  );

  const [agora, setAgora] =
    useState(Date.now());

  useEffect(() => {
    setSessaoAtiva(
      carregarSessao(chaveStorage)
    );
  }, [chaveStorage]);

  useEffect(() => {
    if (sessaoAtiva.status === "parado") {
      localStorage.removeItem(chaveStorage);
      return;
    }

    localStorage.setItem(
      chaveStorage,
      JSON.stringify(sessaoAtiva)
    );
  }, [chaveStorage, sessaoAtiva]);

  // Sessões vinculadas a conteúdo canônico são revalidadas após atualizações
  // do catálogo. Missões livres/adaptativas preservam a matéria escolhida pelo
  // diagnóstico e não podem ser sobrescritas pela definição estática do plano.
  useEffect(() => {
    if (!sessaoAtiva.missaoId || materias.length === 0) return;

    const missao = planoPMPE
      .flatMap((semana) => semana.dias)
      .flatMap((dia) => dia.missoes)
      .find((item) => item.id === sessaoAtiva.missaoId);

    if (!missaoPossuiReferenciaCanonica(missao)) return;

    const canonica = criarDadosSessaoDaMissao(
      materias,
      missao,
      sessaoAtiva.semana ?? 1,
      sessaoAtiva.dia ?? 1
    );

    const precisaAtualizar =
      sessaoAtiva.materiaId !== canonica.materiaId ||
      sessaoAtiva.moduloId !== canonica.moduloId ||
      sessaoAtiva.assuntoId !== canonica.assuntoId ||
      sessaoAtiva.aulaId !== canonica.aulaId ||
      sessaoAtiva.materia !== canonica.materia ||
      sessaoAtiva.modulo !== canonica.modulo ||
      sessaoAtiva.assunto !== canonica.assunto;

    if (!precisaAtualizar) return;

    setSessaoAtiva((anterior) => ({
      ...anterior,
      materia: canonica.materia,
      materiaId: canonica.materiaId,
      modulo: canonica.modulo,
      moduloId: canonica.moduloId,
      assunto: canonica.assunto,
      assuntoId: canonica.assuntoId,
      aulaId: canonica.aulaId,
      urlAula: canonica.urlAula,
      urlQuestoes: canonica.urlQuestoes,
    }));
  }, [materias, sessaoAtiva.missaoId]);

  useEffect(() => {
    if (sessaoAtiva.status !== "rodando") {
      return;
    }

    const intervalo =
      window.setInterval(
        () => setAgora(Date.now()),
        1000
      );

    return () =>
      window.clearInterval(intervalo);
  }, [sessaoAtiva.status]);

  const segundosDecorridos =
    useMemo(
      () =>
        calcularSegundos(
          sessaoAtiva,
          agora
        ),
      [sessaoAtiva, agora]
    );

  const cronometroAtivo =
    sessaoAtiva.status !== "parado";

  function iniciar(
    dados: DadosIniciarSessao
  ) {
    if (cronometroAtivo) {
      const substituir =
        window.confirm(
          "Já existe uma sessão em andamento. Deseja substituí-la?"
        );

      if (!substituir) {
        return false;
      }
    }

    const materiaEfetiva =
      obterMateriaEfetivaDaSessao(
        dados.tipo,
        dados.materia
      );

    if (!materiaEfetiva) {
      showToast(
        "Selecione uma matéria.",
        "warning"
      );
      return false;
    }

    if (!dados.assunto.trim()) {
      showToast(
        "Selecione ou informe um assunto.",
        "warning"
      );
      return false;
    }

    setSessaoAtiva({
      materia: materiaEfetiva,
      materiaId: dados.materiaId,
      modulo: dados.modulo?.trim() || undefined,
      moduloId: dados.moduloId,
      assunto: dados.assunto.trim(),
      assuntoId: dados.assuntoId,
      aulaId: dados.aulaId,
      tipo: dados.tipo,
      formatoRevisao: dados.formatoRevisao,
      objetivo: dados.objetivo?.trim() ?? "",
      observacao: dados.observacao?.trim() ?? "",
      status: "rodando",
      iniciadoEm: new Date().toISOString(),
      pausadoEm: null,
      segundosPausados: 0,
      missaoId: dados.missaoId,
      semana: dados.semana,
      dia: dados.dia,
      urlAula: dados.urlAula,
      urlQuestoes: dados.urlQuestoes,
    });

    setAgora(Date.now());

    showToast(
      "Sessão de estudo iniciada.",
      "success"
    );

    return true;
  }

  function atualizarDados(
    dados: Partial<
      Pick<
        SessaoAtiva,
        "materia" | "materiaId" | "modulo" | "moduloId" |
        "assunto" | "assuntoId" | "aulaId" | "tipo" | "formatoRevisao" |
        "objetivo" | "observacao" |
        "missaoId" | "semana" | "dia" |
        "urlAula" | "urlQuestoes"
      >
    >
  ) {
    if (cronometroAtivo) {
      return;
    }

    setSessaoAtiva(
      (anterior) =>
        aplicarAlteracoesComVinculoSeguro(
          anterior,
          dados
        )
    );
  }

  function prepararSessao(
    dados: DadosIniciarSessao
  ) {
    const novaSessao: SessaoAtiva = {
      ...sessaoInicial,
      materia: dados.materia.trim(),
      materiaId: dados.materiaId,
      modulo: dados.modulo?.trim() || undefined,
      moduloId: dados.moduloId,
      assunto: dados.assunto.trim(),
      assuntoId: dados.assuntoId,
      aulaId: dados.aulaId,
      tipo: dados.tipo,
      formatoRevisao: dados.formatoRevisao,
      objetivo: dados.objetivo?.trim() ?? "",
      observacao: dados.observacao?.trim() ?? "",
      missaoId: dados.missaoId,
      semana: dados.semana,
      dia: dados.dia,
      urlAula: dados.urlAula,
      urlQuestoes: dados.urlQuestoes,
      status: "parado",
      iniciadoEm: null,
      pausadoEm: null,
      segundosPausados: 0,
    };

    setSessaoAtiva(novaSessao);
    localStorage.removeItem(chaveStorage);
  }

  function pausar() {
    if (sessaoAtiva.status !== "rodando") {
      return;
    }

    setSessaoAtiva(
      (anterior) => ({
        ...anterior,
        status: "pausado",
        pausadoEm:
          new Date().toISOString(),
      })
    );
  }

  function continuar() {
    if (
      sessaoAtiva.status !== "pausado" ||
      !sessaoAtiva.pausadoEm
    ) {
      return;
    }

    const segundosDaPausa =
      Math.max(
        0,
        Math.floor(
          (
            Date.now() -
            new Date(
              sessaoAtiva.pausadoEm
            ).getTime()
          ) / 1000
        )
      );

    setSessaoAtiva(
      (anterior) => ({
        ...anterior,
        status: "rodando",
        pausadoEm: null,
        segundosPausados:
          anterior.segundosPausados +
          segundosDaPausa,
      })
    );

    setAgora(Date.now());
  }

  function finalizar(
    dados: DadosFinalizacaoSessao
  ): ResultadoFinalizacao | null {
    if (!cronometroAtivo) {
      return null;
    }

    const minutos =
      dados.minutosReais;

    if (
      !Number.isFinite(minutos) ||
      minutos < 1 ||
      minutos > 1440
    ) {
      showToast(
        "Informe um tempo válido entre 1 e 1440 minutos.",
        "warning"
      );
      return null;
    }

    const finalizadaEm =
      new Date().toISOString();

    const novaSessao:
      SessaoEstudo = {
      id: crypto.randomUUID(),
      tipo: sessaoAtiva.tipo,
      materia: sessaoAtiva.materia,
      materiaId: sessaoAtiva.materiaId,
      modulo: sessaoAtiva.modulo,
      moduloId: sessaoAtiva.moduloId,
      assunto: sessaoAtiva.assunto,
      assuntoId: sessaoAtiva.assuntoId,
      objetivo:
        sessaoAtiva.objetivo ||
        undefined,
      observacao:
        dados.observacao?.trim() ||
        sessaoAtiva.observacao ||
        undefined,

      minutos:
        Math.round(minutos),

      quantidadeQuestoes:
        dados.quantidadeQuestoes,

      quantidadeAcertos:
        dados.quantidadeAcertos,

      quantidadeErros:
        dados.quantidadeErros,

      banca:
        dados.banca?.trim() ||
        undefined,

      dificuldade:
        dados.dificuldade,

      avaliacaoRevisao:
        dados.avaliacaoRevisao,
      formatoRevisao:
        dados.formatoRevisao,
      data: finalizadaEm,
      iniciadaEm:
        sessaoAtiva.iniciadoEm ??
        finalizadaEm,
      finalizadaEm,
      missaoId: sessaoAtiva.missaoId,
      semana: sessaoAtiva.semana,
      dia: sessaoAtiva.dia,
    };

    // Simulado possui histórico próprio. Persisti-lo também como sessão faria
    // o Dashboard somar o mesmo tempo duas vezes.
    if (sessaoAtiva.tipo !== "simulado") {
      setSessoes(
        (anteriores) => [
          novaSessao,
          ...anteriores,
        ]
      );
    }

    const quantidadeAcertos =
      dados.quantidadeAcertos;

    const quantidadeErros =
      dados.quantidadeErros;

    if (
      (sessaoAtiva.tipo === "questoes" ||
        (sessaoAtiva.tipo === "revisao" && dados.formatoRevisao === "questoes")) &&
      typeof quantidadeAcertos === "number" &&
      typeof quantidadeErros === "number"
    ) {
      setQuestoes(
        (anteriores) => [
          {
            id: crypto.randomUUID(),
            materia: sessaoAtiva.materia,
            materiaId: sessaoAtiva.materiaId,
            modulo: sessaoAtiva.modulo,
            moduloId: sessaoAtiva.moduloId,
            assunto: sessaoAtiva.assunto,
            assuntoId: sessaoAtiva.assuntoId,
            banca: dados.banca?.trim() || "Não informada",
            certas: quantidadeAcertos,
            erradas: quantidadeErros,
            // O tempo já pertence à Sessão de Estudo criada acima.
            minutos: 0,
            data: finalizadaEm,
            observacao: dados.observacao?.trim() || undefined,
          },
          ...anteriores,
        ]
      );
    }

    if (
      sessaoAtiva.tipo === "simulado" &&
      typeof quantidadeAcertos === "number" &&
      typeof quantidadeErros === "number"
    ) {
      setSimulados((anteriores) => [
        {
          id: crypto.randomUUID(),
          nome: sessaoAtiva.assunto || "Simulado",
          banca: dados.banca?.trim() || "Não informada",
          certas: quantidadeAcertos,
          erradas: quantidadeErros,
          anuladas: 0,
          totalQuestoes: quantidadeAcertos + quantidadeErros,
          minutos: Math.round(minutos),
          data: finalizadaEm,
          observacao:
            dados.observacao?.trim() ||
            sessaoAtiva.observacao ||
            undefined,
          origem: "manual",
        },
        ...anteriores,
      ]);
    }

    const missaoPlano = sessaoAtiva.missaoId
      ? planoPMPE
          .flatMap((semana) => semana.dias)
          .flatMap((dia) => dia.missoes)
          .find((missao) => missao.id === sessaoAtiva.missaoId)
      : undefined;

    const referenciasMissao = missaoPlano
      ? obterReferenciasDaMissao(missaoPlano)
      : [];
    const referenciaMissao = referenciasMissao.find(
      (referencia) =>
        (!sessaoAtiva.materiaId || referencia.materiaId === sessaoAtiva.materiaId) &&
        (!sessaoAtiva.assuntoId || referencia.assuntoId === sessaoAtiva.assuntoId) &&
        (!sessaoAtiva.aulaId || referencia.aulaId === sessaoAtiva.aulaId)
    ) ?? referenciasMissao[0];
    let revisaoCriada = false;

    const referenciaConcluidaAposFinalizacao = (
      referencia: (typeof referenciasMissao)[number]
    ) => {
      const materia = materias.find((item) => item.id === referencia.materiaId);
      const modulo = materia
        ? listarModulosDaMateria(materia).find((item) => item.id === referencia.moduloId)
        : undefined;
      const assunto = modulo?.assuntos.find((item) => item.id === referencia.assuntoId);
      if (!assunto) return false;

      const ehReferenciaAtual = Boolean(
        referenciaMissao &&
        referencia.materiaId === referenciaMissao.materiaId &&
        referencia.assuntoId === referenciaMissao.assuntoId &&
        referencia.aulaId === referenciaMissao.aulaId
      );

      if (referencia.aulaId) {
        const aula = assunto.aulas?.find((item) => item.id === referencia.aulaId);
        return Boolean(aula?.concluida || ehReferenciaAtual);
      }

      return Boolean(assunto.concluido || ehReferenciaAtual);
    };

    if (sessaoAtiva.missaoId && referenciaMissao) {
      const materiaDaMissao = materias.find((item) => item.id === referenciaMissao.materiaId);
      const moduloDaMissao = materiaDaMissao
        ? listarModulosDaMateria(materiaDaMissao).find((item) => item.id === referenciaMissao.moduloId)
        : undefined;
      const assuntoDaMissao = moduloDaMissao?.assuntos.find((item) => item.id === referenciaMissao.assuntoId);

      if (referenciaMissao.aulaId) {
        const vaiConcluirAssunto = Boolean(
          assuntoDaMissao &&
          !assuntoDaMissao.concluido &&
          (assuntoDaMissao.aulas ?? []).length > 0 &&
          (assuntoDaMissao.aulas ?? []).every(
            (aula) => aula.id === referenciaMissao.aulaId || aula.concluida
          )
        );
        const aulaExiste = Boolean(
          assuntoDaMissao?.aulas?.some((aula) => aula.id === referenciaMissao.aulaId)
        );

        if (aulaExiste) {
          definirConclusaoAula(
            referenciaMissao.materiaId,
            referenciaMissao.assuntoId,
            referenciaMissao.aulaId,
            true,
            referenciaMissao.moduloId
          );
          revisaoCriada = vaiConcluirAssunto;
        } else if (assuntoDaMissao) {
          definirConclusaoAssunto(
            referenciaMissao.materiaId,
            referenciaMissao.assuntoId,
            true,
            referenciaMissao.moduloId
          );
          revisaoCriada = !assuntoDaMissao.concluido;
        }
      } else if (assuntoDaMissao) {
        definirConclusaoAssunto(
          referenciaMissao.materiaId,
          referenciaMissao.assuntoId,
          true,
          referenciaMissao.moduloId
        );
        revisaoCriada = !assuntoDaMissao.concluido;
      }

      const missaoCompleta = referenciasMissao.length > 0 &&
        referenciasMissao.every(referenciaConcluidaAposFinalizacao);

      setMissoesConcluidas((anteriores) =>
        missaoCompleta
          ? Array.from(new Set([...anteriores, sessaoAtiva.missaoId as string]))
          : anteriores.filter((id) => id !== sessaoAtiva.missaoId)
      );
    } else if (sessaoAtiva.missaoId) {
      setMissoesConcluidas((anteriores) =>
        Array.from(new Set([...anteriores, sessaoAtiva.missaoId as string]))
      );
    }

    // Sessões abertas fora do Plano continuam exigindo confirmação explícita
    // para concluir o assunto. Missões do Plano já concluíram a aula exata acima.
    if (
      dados.concluirAssunto === true &&
      tipoPermiteConcluirAssunto(sessaoAtiva.tipo) &&
      !referenciaMissao
    ) {
      const materia = materias.find((item) => mesmoTexto(item.nome, sessaoAtiva.materia));
      const assunto = materia
        ? listarModulosDaMateria(materia)
            .flatMap((modulo) => modulo.assuntos.map((item) => ({ modulo, assunto: item })))
            .find(({ modulo, assunto }) =>
              (!sessaoAtiva.moduloId || modulo.id === sessaoAtiva.moduloId) &&
              (assunto.id === sessaoAtiva.assuntoId || mesmoTexto(assunto.nome, sessaoAtiva.assunto))
            )
        : undefined;

      if (materia && assunto) {
        definirConclusaoAssunto(materia.id, assunto.assunto.id, true, assunto.modulo.id);
        revisaoCriada = true;
      }
    }

    setSessaoAtiva({
      ...sessaoInicial,
    });

    localStorage.removeItem(chaveStorage);

    [
      "pmpe-sessoes-atualizadas",
      "pmpe-plano-atualizado",
      "pmpe-materias-atualizadas",
      "pmpe-revisoes-atualizadas",
      "pmpe-dashboard-atualizado",
    ].forEach(
      (nome) =>
        window.dispatchEvent(
          new Event(nome)
        )
    );

    showToast(
      sessaoAtiva.tipo === "simulado"
        ? "Simulado finalizado e salvo."
        : "Sessão finalizada e salva.",
      "success"
    );

    return {
      sessao: novaSessao,
      revisaoCriada,
    };
  }

  function cancelar(
    pedirConfirmacao = true
  ) {
    if (
      cronometroAtivo &&
      pedirConfirmacao &&
      !window.confirm(
        "Deseja cancelar esta sessão? O tempo não será salvo."
      )
    ) {
      return;
    }

    setSessaoAtiva({
      ...sessaoInicial,
    });

    localStorage.removeItem(chaveStorage);
  }

  return (
    <CronometroContext.Provider
      value={{
        sessaoAtiva,
        segundosDecorridos,
        cronometroAtivo,
        iniciar,
        atualizarDados,
        prepararSessao,
        pausar,
        continuar,
        finalizar,
        cancelar,
      }}
    >
      {children}
    </CronometroContext.Provider>
  );
}

export function useCronometro() {
  const contexto =
    useContext(CronometroContext);

  if (!contexto) {
    throw new Error(
      "useCronometro deve ser utilizado dentro de CronometroProvider."
    );
  }

  return contexto;
}

function carregarSessao(
  chave: string
): SessaoAtiva {
  const salvo =
    localStorage.getItem(chave);

  if (!salvo) {
    return {
      ...sessaoInicial,
    };
  }

  try {
    return {
      ...sessaoInicial,
      ...JSON.parse(salvo),
    } as SessaoAtiva;
  } catch {
    return {
      ...sessaoInicial,
    };
  }
}

function calcularSegundos(
  sessao: SessaoAtiva,
  momentoAtual: number
) {
  if (
    sessao.status === "parado" ||
    !sessao.iniciadoEm
  ) {
    return 0;
  }

  const fim =
    sessao.status === "pausado" &&
    sessao.pausadoEm
      ? new Date(
          sessao.pausadoEm
        ).getTime()
      : momentoAtual;

  const inicio =
    new Date(
      sessao.iniciadoEm
    ).getTime();

  return Math.max(
    0,
    Math.floor(
      (fim - inicio) / 1000
    ) -
      sessao.segundosPausados
  );
}

function tipoPermiteConcluirAssunto(
  tipo: TipoSessao
) {
  return [
    "aula",
    "videoaula",
    "estudo",
    "leitura",
    "questoes",
  ].includes(tipo);
}

function mesmoTexto(
  a: string,
  b: string
) {
  return normalizar(a) === normalizar(b);
}

function normalizar(
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
    .replace(/\s+/g, " ");
}

export function formatarTempo(
  segundos: number
) {
  const horas =
    Math.floor(segundos / 3600);

  const minutos =
    Math.floor(
      (segundos % 3600) / 60
    );

  const segundosRestantes =
    segundos % 60;

  return [
    horas,
    minutos,
    segundosRestantes,
  ]
    .map(
      (valor) =>
        String(valor).padStart(
          2,
          "0"
        )
    )
    .join(":");
}
