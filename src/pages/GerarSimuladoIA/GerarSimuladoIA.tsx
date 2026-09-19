import { armazenamentoLocalDaConta as localStorage, armazenamentoSessaoDaConta as sessionStorage } from "../../services/armazenamentoConta";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import "./GerarSimuladoIA.css";

import { useApp } from "../../context/AppContext";

import {
  aguardarGeracaoQuestoesIA,
  gerarQuestoesIA,
  iniciarGeracaoQuestoesIA,
  listarJobsGeracaoIA,
  type DificuldadeIA,
  type JobGeracaoIAPublico,
  type ParametrosGeracaoIA,
} from "../../services/gemini";

import {
  salvarAtividadeGeracaoIA,
  type EtapaGeracaoIA,
} from "../../services/geracaoIAAtividadeService";

import {
  listarModulosDaMateria,
} from "../../services/conteudos/navegarConteudos";

import {
  listarSemanasDoPlano,
  pegarAssuntosDaSemana,
} from "../../utils/conteudosSemana";

import {
  ativarCadernoSimuladoIA,
  definirTipoSessaoQuestoesIAAtiva,
  listarCadernosSimuladosIA,
  registrarQuestoesAtuaisComoCaderno,
  type CadernoSimuladoIA,
} from "../../services/cadernosSimuladosIAService";

import {
  salvarQuestoesGeradasNoCatalogo,
  selecionarDoCatalogoIA,
} from "../../services/catalogoQuestoesIAService";

import {
  embaralhar,
  type PreferenciaReusoIA,
} from "../../services/catalogoQuestoesIAUtils";

import {
  calcularTotalQuestoesMultiAssunto,
  consolidarBlocosMultiAssunto,
  LIMITE_QUESTOES_SESSAO,
  validarGeracaoMultiAssunto,
} from "../../utils/geracaoMultiAssunto";

import type {
  QuestaoIA,
} from "../../types/index";

type OrigemGeracao =
  | "assunto"
  | "semana";

type AssuntoSelecionavel = {
  chave: string;
  modulo: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
};

type PrefillPendente = {
  modulo?: string;
  assunto: string;
};

type SelecaoCatalogoBloco =
  Awaited<ReturnType<typeof selecionarDoCatalogoIA>>;

type PlanoBlocoAssunto = {
  item: AssuntoSelecionavel;
  selecaoCatalogo: SelecaoCatalogoBloco;
  parametrosIA?: ParametrosGeracaoIA;
  job?: JobGeracaoIAPublico;
};

type GeracaoPendente = {
  id: string;
  criadaEm: string;
  origem: OrigemGeracao;
  materiaSelecionada: string;
  assuntosSelecionados: string[];
  assuntoPersonalizado: string;
  semanaSelecionada: number;
  banca: string;
  dificuldade: DificuldadeIA;
  quantidade: number;
  salvarNoBanco: boolean;
  preferenciaReuso: PreferenciaReusoIA;
};

type AbaHistoricoIA =
  | "todos"
  | "gerando"
  | "finalizados";

type GrupoJobGeracaoIA = {
  id: string;
  jobs: JobGeracaoIAPublico[];
  status: "gerando" | "finalizado" | "erro";
  progresso: number;
  titulo: string;
  descricao: string;
  quantidade: number;
  criadaEm: string;
  erro?: string;
};

const CHAVE_QUESTOES_IA = "pmpe_questoes_ia";
const CHAVE_BANCO_IA = "pmpe_banco_questoes_ia";
const CHAVE_GERACAO_PENDENTE = "pmpe:geracao-questoes-ia:pendente";
const QUANTIDADES_DISPONIVEIS = [5, 10, 15, 20, 30, 40, 50, 60];

export default function GerarSimuladoIA() {
  const navigate = useNavigate();
  const { materias, configuracoes } = useApp();

  const [origem, setOrigem] = useState<OrigemGeracao>("assunto");
  const [materiaSelecionada, setMateriaSelecionada] = useState("");
  const [assuntosSelecionados, setAssuntosSelecionados] = useState<string[]>([]);
  const [assuntoPersonalizado, setAssuntoPersonalizado] = useState("");
  const [prefillPendente, setPrefillPendente] = useState<PrefillPendente | null>(null);
  const [semanaSelecionada, setSemanaSelecionada] = useState(1);
  const [banca, setBanca] = useState("AOCP");
  const [dificuldade, setDificuldade] = useState<DificuldadeIA>("Mista");
  const [quantidade, setQuantidade] = useState(5);
  const [salvarNoBanco, setSalvarNoBanco] = useState(true);
  const [preferenciaReuso, setPreferenciaReuso] =
    useState<PreferenciaReusoIA>("nao_respondidas");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [questoesGeradas, setQuestoesGeradas] = useState<QuestaoIA[]>([]);
  const [geracaoPendente, setGeracaoPendente] =
    useState<GeracaoPendente | null>(null);
  const [abaHistorico, setAbaHistorico] =
    useState<AbaHistoricoIA>("todos");
  const [jobsRecentes, setJobsRecentes] =
    useState<JobGeracaoIAPublico[]>([]);
  const [cadernosRecentes, setCadernosRecentes] =
    useState<CadernoSimuladoIA[]>([]);

  useEffect(() => {
    const pendente = carregarGeracaoPendente();
    if (pendente) {
      setOrigem(pendente.origem);
      setMateriaSelecionada(pendente.materiaSelecionada);
      setAssuntosSelecionados(pendente.assuntosSelecionados);
      setAssuntoPersonalizado(pendente.assuntoPersonalizado);
      setSemanaSelecionada(pendente.semanaSelecionada);
      setBanca(pendente.banca);
      setDificuldade(pendente.dificuldade);
      setQuantidade(pendente.quantidade);
      setSalvarNoBanco(pendente.salvarNoBanco);
      setPreferenciaReuso(pendente.preferenciaReuso);
      setGeracaoPendente(pendente);
      return;
    }
    const modoSolicitado = sessionStorage.getItem("pmpe:gerar-ia:modo");
    if (modoSolicitado === "simulado") setOrigem("semana");
    if (modoSolicitado === "questoes") setOrigem("assunto");
    sessionStorage.removeItem("pmpe:gerar-ia:modo");

    const salvo = sessionStorage.getItem("pmpe:gerar-ia:prefill");
    if (!salvo) return;

    try {
      const prefill = JSON.parse(salvo) as {
        materia?: string;
        modulo?: string;
        assunto?: string;
      };

      setOrigem("assunto");
      if (prefill.materia) setMateriaSelecionada(prefill.materia);
      if (prefill.assunto) {
        setPrefillPendente({
          modulo: prefill.modulo,
          assunto: prefill.assunto,
        });
      }
    } finally {
      sessionStorage.removeItem("pmpe:gerar-ia:prefill");
    }
  }, []);

  useEffect(() => {
    let ativo = true;

    const atualizarHistorico = async () => {
      try {
        const [jobs, cadernos] = await Promise.all([
          listarJobsGeracaoIA(),
          listarCadernosSimuladosIA(),
        ]);

        if (!ativo) return;
        setJobsRecentes(jobs);
        setCadernosRecentes(cadernos);
      } catch (erroHistorico) {
        console.error(
          "Erro ao atualizar histórico de gerações IA:",
          erroHistorico
        );
      }
    };

    void atualizarHistorico();

    const timer = window.setInterval(
      () => void atualizarHistorico(),
      2_500
    );

    const aoAtualizar = () => {
      void atualizarHistorico();
    };

    window.addEventListener(
      "pmpe-questoes-ia-atualizadas",
      aoAtualizar
    );

    return () => {
      ativo = false;
      window.clearInterval(timer);
      window.removeEventListener(
        "pmpe-questoes-ia-atualizadas",
        aoAtualizar
      );
    };
  }, []);

  const semanas = useMemo(
    () => listarSemanasDoPlano(),
    []
  );

  const materiaAtual = useMemo(
    () =>
      materias.find(
        (materia) => materia.nome === materiaSelecionada
      ),
    [materias, materiaSelecionada]
  );

  const modulosDisponiveis = useMemo(
    () =>
      materiaAtual
        ? listarModulosDaMateria(materiaAtual)
        : [],
    [materiaAtual]
  );

  const opcoesAssuntos = useMemo<AssuntoSelecionavel[]>(
    () =>
      modulosDisponiveis.flatMap((modulo) =>
        modulo.assuntos.map((assunto) => ({
          chave: `${modulo.id}::${assunto.id}`,
          modulo: modulo.nome,
          moduloId: modulo.id,
          assunto: assunto.nome,
          assuntoId: assunto.id,
        }))
      ),
    [modulosDisponiveis]
  );

  useEffect(() => {
    if (!prefillPendente || opcoesAssuntos.length === 0) return;

    const correspondencia =
      opcoesAssuntos.find(
        (item) =>
          normalizarTexto(item.assunto) ===
            normalizarTexto(prefillPendente.assunto) &&
          (!prefillPendente.modulo ||
            normalizarTexto(item.modulo) ===
              normalizarTexto(prefillPendente.modulo))
      ) ??
      opcoesAssuntos.find(
        (item) =>
          normalizarTexto(item.assunto) ===
          normalizarTexto(prefillPendente.assunto)
      );

    if (correspondencia) {
      setAssuntosSelecionados([correspondencia.chave]);
      setAssuntoPersonalizado("");
    } else {
      setAssuntoPersonalizado(prefillPendente.assunto);
    }

    setPrefillPendente(null);
  }, [opcoesAssuntos, prefillPendente]);

  const assuntosParaGerar = useMemo<AssuntoSelecionavel[]>(() => {
    const chaves = new Set(assuntosSelecionados);
    const selecionados = opcoesAssuntos.filter((item) => chaves.has(item.chave));
    const livre = assuntoPersonalizado.trim();

    if (
      livre &&
      !selecionados.some(
        (item) => normalizarTexto(item.assunto) === normalizarTexto(livre)
      )
    ) {
      selecionados.push({
        chave: `personalizado::${normalizarTexto(livre)}`,
        modulo: "Geral",
        assunto: livre,
      });
    }

    return selecionados;
  }, [assuntoPersonalizado, assuntosSelecionados, opcoesAssuntos]);

  const validacaoMultiAssunto = useMemo(
    () =>
      validarGeracaoMultiAssunto(
        assuntosParaGerar.length,
        quantidade
      ),
    [assuntosParaGerar.length, quantidade]
  );

  const quantidadeTotalPrevista =
    origem === "assunto"
      ? validacaoMultiAssunto.total
      : quantidade;

  const conteudosSemana = useMemo(
    () => pegarAssuntosDaSemana(semanaSelecionada),
    [semanaSelecionada]
  );

  const resumoPorMateria = useMemo(() => {
    const mapa = new Map<string, string[]>();

    conteudosSemana.forEach((conteudo) => {
      const assuntos = mapa.get(conteudo.materia) ?? [];
      if (!assuntos.includes(conteudo.assunto)) {
        assuntos.push(conteudo.assunto);
      }
      mapa.set(conteudo.materia, assuntos);
    });

    return Array.from(mapa.entries());
  }, [conteudosSemana]);

  function alterarOrigem(novaOrigem: OrigemGeracao) {
    if (gerando) return;
    setOrigem(novaOrigem);
    setErro("");
    setSucesso("");
    setQuestoesGeradas([]);
    localStorage.removeItem(CHAVE_GERACAO_PENDENTE);
    setGeracaoPendente(null);
    salvarAtividadeGeracaoIA(null);
  }

  function alterarMateria(novaMateria: string) {
    setMateriaSelecionada(novaMateria);
    setAssuntosSelecionados([]);
    setAssuntoPersonalizado("");
    setPrefillPendente(null);
    setErro("");
    setSucesso("");
  }

  function alternarAssunto(chave: string) {
    setAssuntosSelecionados((atuais) =>
      atuais.includes(chave)
        ? atuais.filter((item) => item !== chave)
        : [...atuais, chave]
    );
    setErro("");
    setSucesso("");
  }

  function selecionarTodosAssuntos() {
    const totalSeSelecionarTodos = calcularTotalQuestoesMultiAssunto(
      opcoesAssuntos.length + (assuntoPersonalizado.trim() ? 1 : 0),
      quantidade
    );

    if (totalSeSelecionarTodos > LIMITE_QUESTOES_SESSAO) {
      setErro(
        `Selecionar todos criaria ${totalSeSelecionarTodos} questões. O limite da sessão é ${LIMITE_QUESTOES_SESSAO}.`
      );
      return;
    }

    setAssuntosSelecionados(opcoesAssuntos.map((item) => item.chave));
    setErro("");
  }

  async function prepararBlocoAssunto(
    item: AssuntoSelecionavel,
    indice: number,
    operacao: GeracaoPendente,
    retomando: boolean
  ): Promise<PlanoBlocoAssunto> {
    const concursoAlvo = configuracoes.concurso || "PMPE";

    const selecaoCatalogo = await selecionarDoCatalogoIA({
      materia: materiaSelecionada,
      materiaId: materiaAtual?.id,
      modulo: item.modulo,
      moduloId: item.moduloId,
      assunto: item.assunto,
      assuntoId: item.assuntoId,
      banca: banca.trim(),
      dificuldade,
      quantidade,
      preferencia: preferenciaReuso,
      concursoAlvo,
    });

    if (selecaoCatalogo.quantidadeGerar <= 0) {
      return {
        item,
        selecaoCatalogo,
      };
    }

    const parametrosIA: ParametrosGeracaoIA = {
      origem: "assunto",
      materia: materiaSelecionada,
      modulo: item.modulo,
      moduloId: item.moduloId,
      assunto: item.assunto,
      banca: banca.trim(),
      dificuldade,
      quantidade: selecaoCatalogo.quantidadeGerar,
      enunciadosEvitar: selecaoCatalogo.reutilizadas.map(
        (questao) => questao.enunciado
      ),
      requestId: `${operacao.id}:assunto:${indice}`,
      retomarErro: retomando,
    };

    const job = await iniciarGeracaoQuestoesIA(parametrosIA);

    return {
      item,
      selecaoCatalogo,
      parametrosIA,
      job,
    };
  }

  async function concluirBlocoAssunto(
    plano: PlanoBlocoAssunto,
    operacao: GeracaoPendente,
    blocoAtual: number,
    blocosTotal: number
  ): Promise<{
    questoes: QuestaoIA[];
    reutilizadas: number;
    novas: number;
  }> {
    const concursoAlvo = configuracoes.concurso || "PMPE";
    let novasQuestoes: QuestaoIA[] = [];

    if (plano.job && plano.parametrosIA) {
      const resposta = await aguardarGeracaoQuestoesIA(
        plano.job,
        {
          ...plano.parametrosIA,
          onEtapa: (etapa) =>
            atualizarAtividadeGeracao(
              operacao,
              etapa,
              `${plano.item.assunto} · ${dificuldade} · ${banca.trim()}`,
              blocoAtual,
              blocosTotal
            ),
        }
      );

      novasQuestoes = resposta.questoes;
    }

    if (salvarNoBanco && novasQuestoes.length > 0) {
      novasQuestoes = await salvarQuestoesGeradasNoCatalogo(
        novasQuestoes,
        {
          concursoAlvo,
          editalAlvo: concursoAlvo,
          materiaId: materiaAtual?.id,
          assuntoId: plano.item.assuntoId,
        }
      );
    }

    const questoes = [
      ...plano.selecaoCatalogo.reutilizadas,
      ...novasQuestoes,
    ]
      .slice(0, quantidade)
      .map((questao) => ({
        ...questao,
        materia: materiaSelecionada,
        materiaId: materiaAtual?.id ?? questao.materiaId,
        modulo: plano.item.modulo,
        moduloId: plano.item.moduloId ?? questao.moduloId,
        assunto: plano.item.assunto,
        assuntoId: plano.item.assuntoId ?? questao.assuntoId,
      }));

    if (questoes.length !== quantidade) {
      throw new Error(
        `O subassunto “${plano.item.assunto}” ficou com ${questoes.length} questões, mas eram esperadas ${quantidade}. Tente gerar novamente.`
      );
    }

    return {
      questoes,
      reutilizadas: plano.selecaoCatalogo.reutilizadas.length,
      novas: novasQuestoes.length,
    };
  }

  function atualizarAtividadeGeracao(
    operacao: GeracaoPendente,
    etapa: EtapaGeracaoIA,
    descricao: string,
    blocoAtual = 1,
    blocosTotal = 1,
    erroDetalhe?: string
  ) {
    const totalQuestoes =
      operacao.origem === "assunto"
        ? Math.max(operacao.quantidade, quantidadeTotalPrevista)
        : operacao.quantidade;

    salvarAtividadeGeracaoIA({
      id: operacao.id,
      etapa,
      titulo:
        operacao.origem === "semana"
          ? `Simulado da Semana ${operacao.semanaSelecionada}`
          : operacao.materiaSelecionada || "Questões por assunto",
      descricao,
      quantidade: totalQuestoes,
      blocoAtual,
      blocosTotal,
      criadaEm: operacao.criadaEm,
      atualizadaEm: new Date().toISOString(),
      ...(erroDetalhe ? { erro: erroDetalhe } : {}),
    });
  }

  async function gerarSimulado(operacaoExistente?: GeracaoPendente) {
    setErro("");
    setSucesso("");

    if (origem === "assunto" && !materiaSelecionada.trim()) {
      setErro("Selecione uma matéria.");
      return;
    }

    if (origem === "assunto" && !validacaoMultiAssunto.valida) {
      setErro(validacaoMultiAssunto.mensagem);
      return;
    }

    if (origem === "semana" && conteudosSemana.length === 0) {
      setErro("A semana selecionada não possui conteúdos válidos.");
      return;
    }

    if (!banca.trim()) {
      setErro("Informe a banca.");
      return;
    }

    if (quantidade < 1 || quantidade > LIMITE_QUESTOES_SESSAO) {
      setErro(`A quantidade deve ficar entre 1 e ${LIMITE_QUESTOES_SESSAO}.`);
      return;
    }

    const retomando = Boolean(operacaoExistente);

    const operacao: GeracaoPendente =
      operacaoExistente ?? {
        id: crypto.randomUUID(),
        criadaEm: new Date().toISOString(),
        origem,
        materiaSelecionada,
        assuntosSelecionados: [...assuntosSelecionados],
        assuntoPersonalizado,
        semanaSelecionada,
        banca,
        dificuldade,
        quantidade,
        salvarNoBanco,
        preferenciaReuso,
      };

    localStorage.setItem(CHAVE_GERACAO_PENDENTE, JSON.stringify(operacao));
    setGeracaoPendente(operacao);

    const totalBlocos =
      operacao.origem === "assunto"
        ? Math.max(1, assuntosParaGerar.length)
        : 1;

    atualizarAtividadeGeracao(
      operacao,
      "preparando",
      operacao.origem === "assunto"
        ? `${banca.trim()} · ${dificuldade} · preparando os subassuntos`
        : `${banca.trim()} · ${dificuldade} · preparando o simulado`,
      1,
      totalBlocos
    );

    try {
      setGerando(true);
      setQuestoesGeradas([]);

      let questoesFinais: QuestaoIA[] = [];
      let totalReutilizadas = 0;
      let totalNovas = 0;

      if (origem === "assunto") {
        atualizarAtividadeGeracao(
          operacao,
          "preparando",
          "Enfileirando todos os subassuntos no servidor",
          1,
          totalBlocos
        );

        const planos = await Promise.all(
          assuntosParaGerar.map((item, indice) =>
            prepararBlocoAssunto(
              item,
              indice,
              operacao,
              retomando
            )
          )
        );

        const blocos: QuestaoIA[][] = [];

        for (const [indice, plano] of planos.entries()) {
          const blocoAtual = indice + 1;

          const bloco = await concluirBlocoAssunto(
            plano,
            operacao,
            blocoAtual,
            totalBlocos
          );

          blocos.push(bloco.questoes);
          totalReutilizadas += bloco.reutilizadas;
          totalNovas += bloco.novas;
        }

        questoesFinais = embaralhar(
          consolidarBlocosMultiAssunto(blocos, quantidade)
        );
      } else {
        const resposta = await gerarQuestoesIA({
          origem: "semana",
          semana: semanaSelecionada,
          conteudosSemana,
          banca: banca.trim(),
          dificuldade,
          quantidade,
          requestId: `${operacao.id}:semana`,
          onEtapa: (etapa) =>
            atualizarAtividadeGeracao(
              operacao,
              etapa,
              `Semana ${semanaSelecionada} · ${banca.trim()}`,
              1,
              1
            ),
          retomarErro: retomando,
        });

        let novasQuestoes = resposta.questoes;

        if (salvarNoBanco && novasQuestoes.length > 0) {
          const concursoAlvo = configuracoes.concurso || "PMPE";
          novasQuestoes = await salvarQuestoesGeradasNoCatalogo(
            novasQuestoes,
            {
              concursoAlvo,
              editalAlvo: concursoAlvo,
            }
          );
        }

        totalNovas = novasQuestoes.length;
        questoesFinais = embaralhar(novasQuestoes).slice(0, quantidade);
      }

      atualizarAtividadeGeracao(
        operacao,
        "salvando",
        "Organizando e salvando o caderno",
        totalBlocos,
        totalBlocos
      );

      localStorage.setItem(
        CHAVE_QUESTOES_IA,
        JSON.stringify(questoesFinais)
      );

      if (salvarNoBanco) {
        salvarQuestoesNoBanco(questoesFinais);
      }

      const tipoSessao = origem === "assunto" ? "questoes" : "simulado";
      definirTipoSessaoQuestoesIAAtiva(tipoSessao);
      await registrarQuestoesAtuaisComoCaderno(
        tipoSessao,
        operacao.id
      );

      setQuestoesGeradas(questoesFinais);

      setSucesso(
        origem === "assunto"
          ? `${questoesFinais.length} questões prontas em ${assuntosParaGerar.length} subassunto(s): ${totalReutilizadas} reutilizadas do banco e ${totalNovas} novas geradas por IA.${salvarNoBanco && totalNovas > 0 ? " As novas aguardam curadoria antes de entrarem no banco compartilhado." : ""}`
          : `${questoesFinais.length} questões prontas para o simulado da semana.${salvarNoBanco && totalNovas > 0 ? " As novas aguardam curadoria antes de entrarem no banco compartilhado." : ""}`
      );

      localStorage.removeItem(CHAVE_GERACAO_PENDENTE);
      setGeracaoPendente(null);

      atualizarAtividadeGeracao(
        operacao,
        "concluida",
        "Caderno pronto para resolver",
        totalBlocos,
        totalBlocos
      );

      window.dispatchEvent(
        new Event("pmpe-questoes-ia-atualizadas")
      );
    } catch (erroGeracao) {
      const mensagem =
        erroGeracao instanceof Error
          ? erroGeracao.message
          : "Erro desconhecido ao gerar questões.";

      console.error("Erro ao gerar questões:", erroGeracao);
      setErro(
        `${mensagem} A operação foi preservada para uma retomada segura.`
      );
      atualizarAtividadeGeracao(
        operacao,
        "erro",
        "A operação foi preservada para retomada",
        1,
        totalBlocos,
        mensagem
      );
    } finally {
      setGerando(false);
    }
  }

  function resolverAgora() {
    if (questoesGeradas.length === 0) {
      setErro("Gere as questões antes de abrir a sessão.");
      return;
    }

    navigate("/resolver-simulado-ia");
  }

  function limparFormulario() {
    if (gerando) return;

    setOrigem("assunto");
    setMateriaSelecionada("");
    setAssuntosSelecionados([]);
    setAssuntoPersonalizado("");
    setPrefillPendente(null);
    setSemanaSelecionada(1);
    setBanca("AOCP");
    setDificuldade("Mista");
    setQuantidade(5);
    setSalvarNoBanco(true);
    setPreferenciaReuso("nao_respondidas");
    setErro("");
    setSucesso("");
    setQuestoesGeradas([]);
    salvarAtividadeGeracaoIA(null);
  }

  const gruposJobs = useMemo(
    () => agruparJobsGeracaoIA(jobsRecentes),
    [jobsRecentes]
  );

  const idsCadernosPorGeracao = useMemo(
    () =>
      new Set(
        cadernosRecentes
          .map((caderno) => caderno.geracaoId)
          .filter((id): id is string => Boolean(id))
      ),
    [cadernosRecentes]
  );

  const gruposVisiveis = useMemo(
    () =>
      gruposJobs.filter((grupo) => {
        if (
          grupo.status === "finalizado" &&
          idsCadernosPorGeracao.has(grupo.id)
        ) {
          return false;
        }

        if (abaHistorico === "gerando") {
          return grupo.status !== "finalizado";
        }

        if (abaHistorico === "finalizados") {
          return grupo.status === "finalizado";
        }

        return true;
      }),
    [abaHistorico, gruposJobs, idsCadernosPorGeracao]
  );

  const cadernosVisiveis = useMemo(
    () =>
      abaHistorico === "gerando"
        ? []
        : cadernosRecentes,
    [abaHistorico, cadernosRecentes]
  );

  const totalEmGeracao = gruposJobs.filter(
    (grupo) => grupo.status !== "finalizado"
  ).length;

  function abrirCaderno(caderno: CadernoSimuladoIA) {
    ativarCadernoSimuladoIA(caderno);
    navigate("/resolver-simulado-ia");
  }

  function irParaNovoPedido() {
    document
      .querySelector(".gerar-ia-card")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  const todosSelecionados =
    opcoesAssuntos.length > 0 &&
    opcoesAssuntos.every((item) => assuntosSelecionados.includes(item.chave));

  return (
    <section className="gerar-ia-container">
      <div className="gerar-ia-cabecalho">
        <div>
          <h1>🤖 Questões e Simulados IA</h1>
          <p>
            Pratique um ou vários subassuntos da mesma matéria ou monte um
            simulado com os conteúdos da semana.
          </p>
        </div>

        <div className="gerar-ia-status">
          <span>Banco disponível</span>
          <strong>{carregarBancoIA().length} questões</strong>
        </div>
      </div>

      <section
        className="gerar-ia-historico"
        aria-label="Central de gerações e simulados"
      >
        <div className="gerar-ia-historico-topo">
          <div>
            <span>Central de gerações</span>
            <h2>Questões e simulados</h2>
            <p>
              A IA continua trabalhando no servidor mesmo se você sair desta tela.
            </p>
          </div>

          <button
            type="button"
            className="gerar-ia-novo"
            onClick={irParaNovoPedido}
          >
            ＋ Nova geração
          </button>
        </div>

        <div
          className="gerar-ia-historico-abas"
          role="tablist"
          aria-label="Filtrar gerações"
        >
          <button
            type="button"
            role="tab"
            aria-selected={abaHistorico === "todos"}
            className={abaHistorico === "todos" ? "ativo" : ""}
            onClick={() => setAbaHistorico("todos")}
          >
            Todos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaHistorico === "gerando"}
            className={abaHistorico === "gerando" ? "ativo" : ""}
            onClick={() => setAbaHistorico("gerando")}
          >
            Em geração
            {totalEmGeracao > 0 && <strong>{totalEmGeracao}</strong>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaHistorico === "finalizados"}
            className={abaHistorico === "finalizados" ? "ativo" : ""}
            onClick={() => setAbaHistorico("finalizados")}
          >
            Finalizados
          </button>
        </div>

        <div className="gerar-ia-historico-lista">
          {gruposVisiveis.map((grupo) => {
            const finalizado = grupo.status === "finalizado";
            const comErro = grupo.status === "erro";
            const podeFinalizar =
              finalizado &&
              geracaoPendente?.id === grupo.id;

            return (
              <article
                key={grupo.id}
                className={
                  comErro
                    ? "gerar-ia-historico-item erro"
                    : finalizado
                      ? "gerar-ia-historico-item finalizado"
                      : "gerar-ia-historico-item gerando"
                }
              >
                <div className="gerar-ia-historico-item-cabecalho">
                  <span
                    className="gerar-ia-historico-icone"
                    aria-hidden="true"
                  >
                    {comErro ? "!" : finalizado ? "✓" : "✦"}
                  </span>

                  <div className="gerar-ia-historico-item-titulo">
                    <div>
                      <strong>{grupo.titulo}</strong>
                      <span>
                        {comErro
                          ? "Precisa de atenção"
                          : finalizado
                            ? "IA finalizada"
                            : obterRotuloGrupoJob(grupo)}
                      </span>
                    </div>
                    <p>
                      {grupo.quantidade} questão
                      {grupo.quantidade === 1 ? "" : "ões"} ·{" "}
                      {grupo.descricao}
                    </p>
                  </div>
                </div>

                {!finalizado && !comErro && (
                  <div className="gerar-ia-historico-progresso">
                    <div>
                      <span>{obterTextoGrupoJob(grupo)}</span>
                      <strong>{grupo.progresso}%</strong>
                    </div>
                    <div
                      className="gerar-ia-historico-barra"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={grupo.progresso}
                    >
                      <span
                        style={{
                          width: `${grupo.progresso}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {comErro && grupo.erro && (
                  <p className="gerar-ia-historico-erro">
                    {grupo.erro}
                  </p>
                )}

                <div className="gerar-ia-historico-acoes">
                  {(comErro || podeFinalizar) && geracaoPendente && (
                    <button
                      type="button"
                      onClick={() =>
                        void gerarSimulado(geracaoPendente)
                      }
                    >
                      {comErro
                        ? "Retomar geração"
                        : "Finalizar caderno"}
                    </button>
                  )}
                  {finalizado && !podeFinalizar && (
                    <span>
                      Processamento concluído no servidor
                    </span>
                  )}
                </div>
              </article>
            );
          })}

          {cadernosVisiveis.map((caderno) => (
            <article
              key={caderno.id}
              className="gerar-ia-historico-item finalizado"
            >
              <div className="gerar-ia-historico-item-cabecalho">
                <span
                  className="gerar-ia-historico-icone"
                  aria-hidden="true"
                >
                  ✓
                </span>
                <div className="gerar-ia-historico-item-titulo">
                  <div>
                    <strong>{caderno.nome}</strong>
                    <span>Finalizado</span>
                  </div>
                  <p>
                    {caderno.questoes.length} questão
                    {caderno.questoes.length === 1 ? "" : "ões"} ·{" "}
                    {caderno.banca} · {caderno.dificuldade}
                  </p>
                </div>
              </div>

              <div className="gerar-ia-historico-acoes">
                <button
                  type="button"
                  onClick={() => abrirCaderno(caderno)}
                >
                  Resolver simulado
                </button>
              </div>
            </article>
          ))}

          {gruposVisiveis.length === 0 &&
            cadernosVisiveis.length === 0 && (
              <div className="gerar-ia-historico-vazio">
                <span>⌁</span>
                <strong>
                  {abaHistorico === "gerando"
                    ? "Nenhuma geração em andamento"
                    : abaHistorico === "finalizados"
                      ? "Nenhum simulado finalizado ainda"
                      : "Nenhuma geração registrada ainda"}
                </strong>
                <p>
                  Faça uma nova geração e acompanhe o processamento por aqui.
                </p>
              </div>
            )}
        </div>
      </section>

      {erro && (
        <div className="gerar-ia-mensagem gerar-ia-erro" role="alert">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="gerar-ia-mensagem gerar-ia-sucesso" role="status">
          {sucesso}
        </div>
      )}

      <div className="gerar-ia-card">
        <div className="gerar-ia-origem">
          <h2>Modo de treino</h2>
          <div>
            <button
              type="button"
              className={origem === "assunto" ? "ativo" : ""}
              onClick={() => alterarOrigem("assunto")}
              disabled={gerando}
            >
              📝 Questões por assunto
            </button>

            <button
              type="button"
              className={origem === "semana" ? "ativo" : ""}
              onClick={() => alterarOrigem("semana")}
              disabled={gerando}
            >
              🎯 Simulado da semana
            </button>
          </div>
        </div>

        {origem === "assunto" ? (
          <>
            <div className="gerar-ia-form-grid gerar-ia-materia-grid">
              <div className="gerar-ia-campo">
                <label htmlFor="gerar-ia-materia">Matéria</label>
                <select
                  id="gerar-ia-materia"
                  value={materiaSelecionada}
                  onChange={(evento) => alterarMateria(evento.target.value)}
                  disabled={gerando}
                >
                  <option value="">Selecione a matéria</option>
                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.nome}>
                      {materia.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="gerar-ia-campo">
                <label>Seleção atual</label>
                <div className="gerar-ia-contador">
                  <strong>{assuntosParaGerar.length}</strong>
                  <span>
                    subassunto{assuntosParaGerar.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>

            <section className="gerar-ia-multiassunto" aria-label="Seleção de subassuntos">
              <div className="gerar-ia-multiassunto-topo">
                <div>
                  <h2>Subassuntos</h2>
                  <p>
                    Marque um ou mais tópicos da mesma matéria. Eles podem estar
                    em módulos diferentes.
                  </p>
                </div>

                {materiaSelecionada && opcoesAssuntos.length > 0 && (
                  <div className="gerar-ia-multiassunto-acoes">
                    <button
                      type="button"
                      onClick={selecionarTodosAssuntos}
                      disabled={gerando || todosSelecionados}
                    >
                      Selecionar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssuntosSelecionados([])}
                      disabled={gerando || assuntosSelecionados.length === 0}
                    >
                      Limpar seleção
                    </button>
                  </div>
                )}
              </div>

              {!materiaSelecionada ? (
                <p className="gerar-ia-multiassunto-vazio">
                  Selecione uma matéria para ver os subassuntos disponíveis.
                </p>
              ) : opcoesAssuntos.length === 0 ? (
                <p className="gerar-ia-multiassunto-vazio">
                  Essa matéria ainda não possui subassuntos cadastrados.
                </p>
              ) : (
                <div className="gerar-ia-modulos-assuntos">
                  {modulosDisponiveis.map((modulo) => (
                    <article key={modulo.id}>
                      <strong>{modulo.nome}</strong>
                      <div className="gerar-ia-assuntos-grid">
                        {modulo.assuntos.map((assunto) => {
                          const chave = `${modulo.id}::${assunto.id}`;
                          const marcado = assuntosSelecionados.includes(chave);

                          return (
                            <label
                              key={chave}
                              className={
                                marcado
                                  ? "gerar-ia-assunto-chip selecionado"
                                  : "gerar-ia-assunto-chip"
                              }
                            >
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => alternarAssunto(chave)}
                                disabled={gerando}
                              />
                              <span>{assunto.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="gerar-ia-campo gerar-ia-assunto-personalizado">
                <label htmlFor="gerar-ia-assunto-livre">
                  Outro subassunto (opcional)
                </label>
                <input
                  id="gerar-ia-assunto-livre"
                  value={assuntoPersonalizado}
                  onChange={(evento) => setAssuntoPersonalizado(evento.target.value)}
                  disabled={gerando || !materiaSelecionada}
                  placeholder="Digite um tópico que ainda não está cadastrado"
                />
              </div>

              {assuntosParaGerar.length > 0 && (
                <div
                  className={
                    validacaoMultiAssunto.valida
                      ? "gerar-ia-resumo-multi"
                      : "gerar-ia-resumo-multi invalido"
                  }
                  role="status"
                >
                  <strong>
                    {assuntosParaGerar.length} subassunto(s) × {quantidade} questões
                  </strong>
                  <span>{validacaoMultiAssunto.total} questões no total</span>
                  {!validacaoMultiAssunto.valida && (
                    <small>{validacaoMultiAssunto.mensagem}</small>
                  )}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <div className="gerar-ia-form-grid">
              <div className="gerar-ia-campo">
                <label htmlFor="gerar-ia-semana">Semana</label>
                <select
                  id="gerar-ia-semana"
                  value={semanaSelecionada}
                  onChange={(evento) =>
                    setSemanaSelecionada(Number(evento.target.value))
                  }
                  disabled={gerando}
                >
                  {semanas.map((semana) => (
                    <option key={semana.numero} value={semana.numero}>
                      {semana.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="gerar-ia-campo">
                <label>Conteúdos encontrados</label>
                <div className="gerar-ia-contador">
                  <strong>{conteudosSemana.length}</strong>
                  <span>
                    conteúdo{conteudosSemana.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>

            <div className="gerar-ia-conteudos-semana">
              <h2>Conteúdos da Semana {semanaSelecionada}</h2>
              {resumoPorMateria.length === 0 ? (
                <p>Nenhum conteúdo válido foi encontrado.</p>
              ) : (
                <div>
                  {resumoPorMateria.map(([materia, assuntos]) => (
                    <article key={materia}>
                      <strong>{materia}</strong>
                      <ul>
                        {assuntos.map((assunto) => (
                          <li key={assunto}>{assunto}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="gerar-ia-form-grid gerar-ia-opcoes">
          <div className="gerar-ia-campo">
            <label htmlFor="gerar-ia-banca">Banca</label>
            <input
              id="gerar-ia-banca"
              value={banca}
              onChange={(evento) => setBanca(evento.target.value)}
              disabled={gerando}
              placeholder="Ex.: AOCP"
            />
          </div>

          <div className="gerar-ia-campo">
            <label htmlFor="gerar-ia-dificuldade">Dificuldade</label>
            <select
              id="gerar-ia-dificuldade"
              value={dificuldade}
              onChange={(evento) =>
                setDificuldade(evento.target.value as DificuldadeIA)
              }
              disabled={gerando}
            >
              <option value="Fácil">Fácil</option>
              <option value="Média">Média</option>
              <option value="Difícil">Difícil</option>
              <option value="Mista">Mista</option>
            </select>
          </div>

          <div className="gerar-ia-campo">
            <label htmlFor="gerar-ia-quantidade">
              {origem === "assunto"
                ? "Questões por subassunto"
                : "Quantidade total"}
            </label>
            <select
              id="gerar-ia-quantidade"
              value={quantidade}
              onChange={(evento) => setQuantidade(Number(evento.target.value))}
              disabled={gerando}
            >
              {QUANTIDADES_DISPONIVEIS.map((valor) => {
                const total = calcularTotalQuestoesMultiAssunto(
                  assuntosParaGerar.length,
                  valor
                );
                const excede =
                  origem === "assunto" &&
                  assuntosParaGerar.length > 0 &&
                  total > LIMITE_QUESTOES_SESSAO;

                return (
                  <option key={valor} value={valor} disabled={excede}>
                    {valor} {origem === "assunto" ? "por subassunto" : "questões"}
                    {excede ? ` — ${total} no total` : ""}
                  </option>
                );
              })}
            </select>
            {origem === "assunto" && assuntosParaGerar.length > 0 && (
              <small className="gerar-ia-ajuda-campo">
                Total atual: {quantidadeTotalPrevista} de {LIMITE_QUESTOES_SESSAO}
              </small>
            )}
          </div>

          <div className="gerar-ia-campo">
            <label htmlFor="gerar-ia-reuso">Seleção do banco</label>
            <select
              id="gerar-ia-reuso"
              value={preferenciaReuso}
              onChange={(evento) =>
                setPreferenciaReuso(evento.target.value as PreferenciaReusoIA)
              }
              disabled={gerando || origem === "semana"}
            >
              <option value="nao_respondidas">Somente não respondidas</option>
              <option value="misturar">Misturar com já respondidas</option>
            </select>
          </div>
        </div>

        <label className="gerar-ia-checkbox">
          <input
            type="checkbox"
            checked={salvarNoBanco}
            onChange={(evento) => setSalvarNoBanco(evento.target.checked)}
            disabled={gerando}
          />
          <span>Enviar as novas para curadoria do banco compartilhado</span>
        </label>

        {gerando && (
          <div className="gerar-ia-carregando">
            <div className="gerar-ia-spinner" />
            <div>
              <strong>Gerando {quantidadeTotalPrevista} questões...</strong>
              <span>
                {origem === "assunto"
                  ? "Os subassuntos são montados separadamente e misturados no final."
                  : "Você pode navegar para outra área ou fechar o navegador. O servidor continua processando e a Central recupera o status quando você voltar."}
              </span>
            </div>
          </div>
        )}

        <div className="gerar-ia-acoes">
          <button
            type="button"
            className="gerar-ia-limpar"
            onClick={limparFormulario}
            disabled={gerando}
          >
            Limpar
          </button>

          <button
            type="button"
            className="gerar-ia-gerar"
            onClick={() => void gerarSimulado()}
            disabled={
              gerando ||
              (origem === "assunto" && !validacaoMultiAssunto.valida)
            }
          >
            {gerando
              ? "Gerando..."
              : origem === "assunto"
                ? `✨ Gerar ${quantidadeTotalPrevista || ""} questões`.trim()
                : "✨ Gerar simulado"}
          </button>
        </div>
      </div>

      {questoesGeradas.length > 0 && (
        <div className="gerar-ia-resultado">
          <div>
            <h2>{origem === "assunto" ? "Questões prontas" : "Simulado pronto"}</h2>
            <p>{questoesGeradas.length} questões foram salvas.</p>
          </div>
          <button type="button" onClick={resolverAgora}>
            Resolver agora →
          </button>
        </div>
      )}
    </section>
  );
}

function agruparJobsGeracaoIA(
  jobs: JobGeracaoIAPublico[]
): GrupoJobGeracaoIA[] {
  const porGeracao = new Map<string, JobGeracaoIAPublico[]>();

  jobs.forEach((job) => {
    const raiz = obterRaizRequestId(job.requestId);
    const lista = porGeracao.get(raiz) ?? [];
    lista.push(job);
    porGeracao.set(raiz, lista);
  });

  return Array.from(porGeracao.entries())
    .map(([id, itens]) => {
      const ordenados = [...itens].sort(
        (a, b) =>
          new Date(a.criadaEm || 0).getTime() -
          new Date(b.criadaEm || 0).getTime()
      );
      const erro = ordenados.find(
        (job) => job.status === "erro"
      );
      const finalizado =
        !erro &&
        ordenados.length > 0 &&
        ordenados.every(
          (job) => job.status === "concluida"
        );
      const progresso = Math.round(
        ordenados.reduce(
          (total, job) =>
            total +
            (job.status === "concluida"
              ? 100
              : Math.max(
                  0,
                  Math.min(100, job.progresso || 0)
                )),
          0
        ) / Math.max(1, ordenados.length)
      );
      const descricoes = Array.from(
        new Set(
          ordenados
            .map((job) => job.descricao)
            .filter(Boolean)
        )
      );
      const quantidade = ordenados.reduce(
        (total, job) =>
          total +
          Math.max(
            0,
            Number(job.quantidade) ||
              job.resultado?.questoes?.length ||
              0
          ),
        0
      );
      const primeiro = ordenados[0];

      return {
        id,
        jobs: ordenados,
        status: erro
          ? "erro"
          : finalizado
            ? "finalizado"
            : "gerando",
        progresso,
        titulo:
          primeiro?.titulo ||
          "Geração de questões",
        descricao:
          descricoes.slice(0, 2).join(" · ") ||
          "Processamento da IA",
        quantidade,
        criadaEm:
          primeiro?.criadaEm ||
          new Date().toISOString(),
        erro: erro?.erro || undefined,
      } satisfies GrupoJobGeracaoIA;
    })
    .sort(
      (a, b) =>
        new Date(b.criadaEm).getTime() -
        new Date(a.criadaEm).getTime()
    );
}

function obterRaizRequestId(
  requestId: string
) {
  return requestId
    .replace(/:assunto:\d+$/, "")
    .replace(/:semana$/, "");
}

function obterRotuloGrupoJob(
  grupo: GrupoJobGeracaoIA
) {
  const atual =
    grupo.jobs.find(
      (job) =>
        job.status === "fila" ||
        job.status === "processando"
    ) ?? grupo.jobs[grupo.jobs.length - 1];

  switch (atual?.etapa) {
    case "fila":
      return "Na fila";
    case "gerando":
      return "Gerando";
    case "revisando":
      return "Revisando";
    case "corrigindo":
      return "Corrigindo";
    case "salvando":
      return "Salvando";
    default:
      return "Em geração";
  }
}

function obterTextoGrupoJob(
  grupo: GrupoJobGeracaoIA
) {
  const indice = grupo.jobs.findIndex(
    (job) =>
      job.status === "fila" ||
      job.status === "processando"
  );
  const atual =
    indice >= 0
      ? grupo.jobs[indice]
      : grupo.jobs[grupo.jobs.length - 1];
  const bloco =
    grupo.jobs.length > 1
      ? ` · bloco ${Math.max(1, indice + 1)}/${grupo.jobs.length}`
      : "";

  switch (atual?.etapa) {
    case "fila":
      return `Aguardando no servidor${bloco}`;
    case "gerando":
      return `A IA está gerando as questões${bloco}`;
    case "revisando":
      return `Revisão independente de qualidade${bloco}`;
    case "corrigindo":
      return `Corrigindo uma revisão rejeitada${bloco}`;
    case "salvando":
      return `Finalizando o lote${bloco}`;
    default:
      return `Processando${bloco}`;
  }
}

function carregarGeracaoPendente(): GeracaoPendente | null {
  const salvo = localStorage.getItem(CHAVE_GERACAO_PENDENTE);
  if (!salvo) return null;

  try {
    const valor = JSON.parse(salvo) as Partial<GeracaoPendente>;
    if (
      typeof valor.id !== "string" ||
      (valor.origem !== "assunto" && valor.origem !== "semana") ||
      typeof valor.banca !== "string" ||
      !Number.isFinite(Number(valor.quantidade))
    ) {
      localStorage.removeItem(CHAVE_GERACAO_PENDENTE);
      return null;
    }

    return {
      id: valor.id,
      criadaEm:
        typeof valor.criadaEm === "string"
          ? valor.criadaEm
          : new Date().toISOString(),
      origem: valor.origem,
      materiaSelecionada:
        typeof valor.materiaSelecionada === "string"
          ? valor.materiaSelecionada
          : "",
      assuntosSelecionados: Array.isArray(valor.assuntosSelecionados)
        ? valor.assuntosSelecionados.filter(
            (item): item is string => typeof item === "string"
          )
        : [],
      assuntoPersonalizado:
        typeof valor.assuntoPersonalizado === "string"
          ? valor.assuntoPersonalizado
          : "",
      semanaSelecionada: Math.max(1, Number(valor.semanaSelecionada) || 1),
      banca: valor.banca,
      dificuldade:
        valor.dificuldade === "Fácil" ||
        valor.dificuldade === "Média" ||
        valor.dificuldade === "Difícil" ||
        valor.dificuldade === "Mista"
          ? valor.dificuldade
          : "Mista",
      quantidade: Math.max(1, Number(valor.quantidade) || 5),
      salvarNoBanco: valor.salvarNoBanco !== false,
      preferenciaReuso:
        valor.preferenciaReuso === "misturar"
          ? "misturar"
          : "nao_respondidas",
    };
  } catch {
    localStorage.removeItem(CHAVE_GERACAO_PENDENTE);
    return null;
  }
}

function carregarBancoIA(): QuestaoIA[] {
  const salvo = localStorage.getItem(CHAVE_BANCO_IA);
  if (!salvo) return [];

  try {
    const valor: unknown = JSON.parse(salvo);
    return Array.isArray(valor) ? (valor as QuestaoIA[]) : [];
  } catch {
    return [];
  }
}

function salvarQuestoesNoBanco(novasQuestoes: QuestaoIA[]) {
  const atuais = carregarBancoIA();
  const mapa = new Map<string, QuestaoIA>();

  atuais.forEach((questao) => {
    mapa.set(gerarChaveQuestao(questao), questao);
  });

  novasQuestoes.forEach((questao) => {
    const chave = gerarChaveQuestao(questao);
    if (!mapa.has(chave)) mapa.set(chave, questao);
  });

  localStorage.setItem(
    CHAVE_BANCO_IA,
    JSON.stringify(Array.from(mapa.values()))
  );
}

function gerarChaveQuestao(questao: QuestaoIA) {
  return normalizarTexto(
    [questao.materia, questao.assunto, questao.enunciado].join("::")
  );
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
