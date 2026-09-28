import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RefreshCcw,
  Square,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import AnaliseSimuladoStudyPro from "../../components/AnaliseSimuladoStudyPro/AnaliseSimuladoStudyPro";
import { useApp } from "../../context/AppContext";
import type { Simulado } from "../../types";
import type {
  MarcacaoQuestaoSimulado,
  QuestaoAnaliseSimulado,
} from "../../utils/analiseSimuladoStudyPro";
import {
  consultarAnaliseSimuladoPdf,
  excluirAnaliseSimuladoPdf,
  iniciarAnaliseSimuladoPdf,
  type AnaliseSimuladoPdf,
  type JobAnaliseSimuladoPdf,
} from "../../services/simuladoPdfAnaliseService";
import {
  limparRascunhoSimuladoPdf,
  obterRascunhoSimuladoPdf,
  type RascunhoSimuladoPdf,
} from "../../services/simuladoPdfDraft";
import {
  carregarAnalisePersistida,
  carregarAnotacoesSimuladoPdf,
  carregarArquivosSimuladoPdf,
  carregarProcessoSimuladoPdf,
  excluirProcessoSimuladoPdf,
  salvarAnalisePersistida,
  salvarAnotacoesSimuladoPdf,
  salvarArquivosSimuladoPdf,
  salvarProcessoSimuladoPdf,
  type ProcessoSimuladoPdfPersistido,
} from "../../services/simuladoPdfPersistencia";
import PdfAnotavel, {
  type AnotacoesPdf,
} from "./PdfAnotavel";
import "./SimuladoPdf.css";

const LETRAS = ["A", "B", "C", "D", "E"];
const INTERVALO_POLLING_MS = 2_500;

export default function SimuladoPdf() {
  const navigate = useNavigate();
  const recebido = obterRascunhoSimuladoPdf();
  const { setSimulados, setMissoesConcluidas } = useApp();

  const [rascunho, setRascunho] =
    useState<RascunhoSimuladoPdf | null>(recebido);
  const [nome, setNome] =
    useState(recebido?.nome ?? "Simulado de domingo");
  const [totalTexto, setTotalTexto] = useState(
    recebido?.totalQuestoes ? String(recebido.totalQuestoes) : "60"
  );
  const [caderno, setCaderno] =
    useState<File | null>(recebido?.caderno ?? null);
  const [comentado, setComentado] =
    useState<File | null>(recebido?.comentado ?? null);
  const [iniciado, setIniciado] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [respostas, setRespostas] =
    useState<Record<string, string>>({});
  const [questaoAtual, setQuestaoAtual] = useState(1);
  const [analise, setAnalise] =
    useState<AnaliseSimuladoPdf | null>(null);
  const [estadoAnalise, setEstadoAnalise] = useState<
    "parado" | "analisando" | "concluida" | "erro"
  >("parado");
  const [progressoAnalise, setProgressoAnalise] = useState(0);
  const [descricaoAnalise, setDescricaoAnalise] = useState(
    "Preparando análise."
  );
  const [erroAnalise, setErroAnalise] = useState("");
  const [finalizarQuandoPronto, setFinalizarQuandoPronto] =
    useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [abaMobile, setAbaMobile] =
    useState<"pdf" | "respostas">("pdf");
  const [criadoEm, setCriadoEm] =
    useState(() => new Date().toISOString());
  const [anotacoesIniciais, setAnotacoesIniciais] =
    useState<AnotacoesPdf | undefined>(undefined);
  const [processoRecuperavel, setProcessoRecuperavel] =
    useState<ProcessoSimuladoPdfPersistido | null>(null);
  const [checandoRecuperacao, setChecandoRecuperacao] =
    useState(!recebido);
  const [restaurando, setRestaurando] = useState(false);
  const [reiniciandoAnalise, setReiniciandoAnalise] =
    useState(false);

  const totalQuestoes =
    rascunho?.totalQuestoes ?? (Number(totalTexto) || 0);

  const requestIdAtual = rascunho
    ? requestIdDoProcesso(rascunho.id)
    : "";

  const aplicarJob = useCallback(
    async (
      job: JobAnaliseSimuladoPdf,
      processoId?: string
    ) => {
      setProgressoAnalise(job.progresso);
      setDescricaoAnalise(job.descricao || "Processando questões.");

      if (job.status === "erro") {
        setEstadoAnalise("erro");
        setErroAnalise(
          job.erro || "A análise precisa ser retomada."
        );
        return;
      }

      if (job.status === "concluida" && job.resultado) {
        setAnalise(job.resultado);
        setEstadoAnalise("concluida");
        setProgressoAnalise(100);
        setDescricaoAnalise("Análise pronta.");

        if (processoId) {
          await salvarAnalisePersistida(
            processoId,
            job.resultado
          ).catch(() => {
            // A análise continua disponível na tela.
          });
        }
        return;
      }

      setEstadoAnalise("analisando");
      setErroAnalise("");
    },
    []
  );

  const iniciarOuRetomarJob = useCallback(
    async (
      proximo: RascunhoSimuladoPdf,
      retomar = false
    ) => {
      setEstadoAnalise("analisando");
      setErroAnalise("");
      setDescricaoAnalise(
        retomar
          ? "Retomando a análise do simulado."
          : "Enviando o PDF para análise."
      );

      const job = await iniciarAnaliseSimuladoPdf({
        requestId: requestIdDoProcesso(proximo.id),
        prova: proximo.caderno,
        comentado: proximo.comentado,
        totalInformado: proximo.totalQuestoes,
        titulo: proximo.nome,
        retomar,
      });

      await aplicarJob(job, proximo.id);
    },
    [aplicarJob]
  );

  const iniciar = useCallback(
    async (proximo: RascunhoSimuladoPdf) => {
      const agora = new Date().toISOString();

      setRascunho(proximo);
      setCaderno(proximo.caderno);
      setComentado(proximo.comentado ?? null);
      setNome(proximo.nome);
      setTotalTexto(String(proximo.totalQuestoes));
      setCriadoEm(agora);
      setIniciado(true);
      setPausado(false);
      setSegundos(0);
      setRespostas({});
      setQuestaoAtual(1);
      setFinalizado(false);
      setFinalizarQuandoPronto(false);
      setAnalise(null);
      setErroAnalise("");
      setDescricaoAnalise("Preparando o PDF.");
      setProgressoAnalise(0);
      setEstadoAnalise("analisando");
      setAnotacoesIniciais({});

      await salvarArquivosSimuladoPdf({
        processoId: proximo.id,
        caderno: proximo.caderno,
        comentado: proximo.comentado,
      });

      salvarProcessoSimuladoPdf({
        id: proximo.id,
        nome: proximo.nome,
        totalQuestoes: proximo.totalQuestoes,
        semana: proximo.semana,
        dia: proximo.dia,
        missaoId: proximo.missaoId,
        respostas: {},
        questaoAtual: 1,
        segundos: 0,
        pausado: false,
        finalizado: false,
        finalizarQuandoPronto: false,
        estadoAnalise: "analisando",
        progressoAnalise: 0,
        criadoEm: agora,
      });

      try {
        await iniciarOuRetomarJob(proximo, false);
      } catch (erro) {
        setEstadoAnalise("erro");
        setErroAnalise(
          erro instanceof Error
            ? erro.message
            : "Não foi possível iniciar a análise."
        );
      }
    },
    [iniciarOuRetomarJob]
  );

  useEffect(() => {
    if (recebido) {
      setChecandoRecuperacao(false);
      return;
    }

    const processo = carregarProcessoSimuladoPdf();
    setProcessoRecuperavel(processo);
    setChecandoRecuperacao(false);
  }, [recebido]);

  useEffect(() => {
    if (
      rascunho &&
      !iniciado &&
      estadoAnalise === "parado" &&
      !processoRecuperavel
    ) {
      void iniciar(rascunho);
    }
  }, [
    estadoAnalise,
    iniciado,
    iniciar,
    processoRecuperavel,
    rascunho,
  ]);

  useEffect(() => {
    if (
      !iniciado ||
      !requestIdAtual ||
      estadoAnalise !== "analisando"
    ) {
      return;
    }

    let ativo = true;

    const consultar = async () => {
      try {
        const job =
          await consultarAnaliseSimuladoPdf(requestIdAtual);

        if (!ativo) return;
        await aplicarJob(job, rascunho?.id);
      } catch (erro) {
        if (!ativo) return;

        setDescricaoAnalise(
          "A análise continua salva. Tentando reconectar ao servidor."
        );

        if (erro instanceof Error && erro.message) {
          setErroAnalise(erro.message);
        }
      }
    };

    const id = window.setInterval(
      () => void consultar(),
      INTERVALO_POLLING_MS
    );

    void consultar();

    return () => {
      ativo = false;
      window.clearInterval(id);
    };
  }, [
    aplicarJob,
    estadoAnalise,
    iniciado,
    rascunho?.id,
    requestIdAtual,
  ]);

  useEffect(() => {
    if (!iniciado || pausado || finalizado) return;

    const id = window.setInterval(() => {
      setSegundos((valor) => valor + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, [finalizado, iniciado, pausado]);

  useEffect(() => {
    if (
      finalizarQuandoPronto &&
      estadoAnalise === "concluida" &&
      analise
    ) {
      setPausado(true);
      setFinalizado(true);
      setFinalizarQuandoPronto(false);
    }
  }, [
    analise,
    estadoAnalise,
    finalizarQuandoPronto,
  ]);

  const persistirEstadoAtual = useCallback(
    (segundosAtuais = segundos) => {
      if (!iniciado || !rascunho) return;

      salvarProcessoSimuladoPdf({
        id: rascunho.id,
        nome,
        totalQuestoes: rascunho.totalQuestoes,
        semana: rascunho.semana,
        dia: rascunho.dia,
        missaoId: rascunho.missaoId,
        respostas,
        questaoAtual,
        segundos: segundosAtuais,
        pausado,
        finalizado,
        finalizarQuandoPronto,
        estadoAnalise:
          estadoAnalise === "concluida" ||
          estadoAnalise === "erro"
            ? estadoAnalise
            : "analisando",
        progressoAnalise,
        erroAnalise: erroAnalise || undefined,
        criadoEm,
      });
    },
    [
      criadoEm,
      erroAnalise,
      estadoAnalise,
      finalizado,
      finalizarQuandoPronto,
      iniciado,
      nome,
      pausado,
      progressoAnalise,
      questaoAtual,
      rascunho,
      respostas,
      segundos,
    ]
  );

  useEffect(() => {
    persistirEstadoAtual();
  }, [
    estadoAnalise,
    finalizado,
    finalizarQuandoPronto,
    pausado,
    progressoAnalise,
    questaoAtual,
    respostas,
    persistirEstadoAtual,
  ]);

  useEffect(() => {
    if (segundos === 0 || segundos % 5 !== 0) return;
    persistirEstadoAtual(segundos);
  }, [persistirEstadoAtual, segundos]);

  useEffect(() => {
    const antesDeSair = () => persistirEstadoAtual();

    window.addEventListener("beforeunload", antesDeSair);
    return () =>
      window.removeEventListener("beforeunload", antesDeSair);
  }, [persistirEstadoAtual]);

  useEffect(() => {
    if (!finalizado || !analise || !rascunho) return;

    const questoesValidas = analise.questoes.filter(
      (item) =>
        item.status === "valida" &&
        Boolean(item.gabarito) &&
        item.confianca >= 50
    );
    const certas = questoesValidas.filter(
      (item) =>
        respostas[String(item.numero)] === item.gabarito
    ).length;
    const erradas = Math.max(
      0,
      questoesValidas.length - certas
    );
    const anuladas = Math.max(
      0,
      analise.totalQuestoes - questoesValidas.length
    );

    const registro: Simulado = {
      id: "pdf-" + rascunho.id,
      nome,
      banca: comentado ? "PDF comentado" : "Gabarito IA",
      certas,
      erradas,
      anuladas,
      minutos: Math.max(1, Math.ceil(segundos / 60)),
      observacao:
        "Simulado realizado pelo leitor de PDF do Study Pro.",
      data: criadoEm,
    };

    setSimulados((anteriores) =>
      anteriores.some((item) => item.id === registro.id)
        ? anteriores
        : [registro, ...anteriores]
    );

    if (rascunho.missaoId) {
      setMissoesConcluidas((anteriores) =>
        anteriores.includes(rascunho.missaoId as string)
          ? anteriores
          : [rascunho.missaoId as string, ...anteriores]
      );
    }
  }, [
    analise,
    comentado,
    criadoEm,
    finalizado,
    nome,
    rascunho,
    respostas,
    segundos,
    setMissoesConcluidas,
    setSimulados,
  ]);

  const respostasPreenchidas =
    Object.values(respostas).filter(Boolean).length;

  const questoesResultado = useMemo<
    QuestaoAnaliseSimulado[]
  >(
    () =>
      (analise?.questoes ?? []).map((item) => ({
        id: "pdf-" + item.numero,
        numero: item.numero,
        materia: item.materia,
        modulo: item.modulo,
        assunto: item.assunto,
        subassunto: item.subassunto,
        dificuldade: item.dificuldade,
        enunciado: item.enunciado,
        alternativas: item.alternativas,
        gabarito: item.gabarito,
        explicacao: item.comentario,
        norma: item.norma,
        dispositivo: item.dispositivo,
        anulada:
          item.status !== "valida" ||
          !item.gabarito ||
          item.confianca < 50,
      })),
    [analise]
  );

  const respostasResultado = useMemo(
    () =>
      Object.fromEntries(
        Array.from(
          { length: totalQuestoes },
          (_, indice) => {
            const numero = indice + 1;
            return [
              "pdf-" + numero,
              respostas[String(numero)],
            ];
          }
        )
      ),
    [respostas, totalQuestoes]
  );

  const persistirAnotacoes = useCallback(
    (valor: AnotacoesPdf) => {
      if (!rascunho?.id) return;

      void salvarAnotacoesSimuladoPdf(
        rascunho.id,
        valor
      ).catch(() => {
        // Anotações continuam disponíveis na sessão atual.
      });
    },
    [rascunho?.id]
  );

  function iniciarDoFormulario() {
    const total = Number(totalTexto);

    if (!caderno) {
      window.alert(
        "Selecione o PDF do caderno de questões."
      );
      return;
    }

    if (
      !Number.isInteger(total) ||
      total < 1 ||
      total > 200
    ) {
      window.alert(
        "Informe uma quantidade entre 1 e 200 questões."
      );
      return;
    }

    void iniciar({
      id: crypto.randomUUID(),
      nome:
        nome.trim() ||
        "Simulado de domingo",
      totalQuestoes: total,
      caderno,
      comentado,
    });
  }

  async function continuarProcessoAnterior() {
    const processo = processoRecuperavel;
    if (!processo) return;

    setRestaurando(true);

    try {
      const [arquivos, analiseSalva, anotacoesSalvas] =
        await Promise.all([
          carregarArquivosSimuladoPdf(processo.id),
          carregarAnalisePersistida(processo.id),
          carregarAnotacoesSimuladoPdf<AnotacoesPdf>(
            processo.id
          ),
        ]);

      if (!arquivos?.caderno) {
        await excluirProcessoSimuladoPdf(processo.id);
        setProcessoRecuperavel(null);
        window.alert(
          "O processo foi encontrado, mas o PDF não estava mais salvo neste aparelho. Inicie o simulado novamente."
        );
        return;
      }

      const proximo: RascunhoSimuladoPdf = {
        id: processo.id,
        nome: processo.nome,
        totalQuestoes: processo.totalQuestoes,
        caderno: arquivos.caderno,
        comentado: arquivos.comentado,
        semana: processo.semana,
        dia: processo.dia,
        missaoId: processo.missaoId,
      };

      const atualizadoEm = Date.parse(
        processo.atualizadoEm
      );
      const tempoFora =
        !processo.pausado &&
        !processo.finalizado &&
        Number.isFinite(atualizadoEm)
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - atualizadoEm) / 1000
              )
            )
          : 0;

      setRascunho(proximo);
      setCaderno(proximo.caderno);
      setComentado(proximo.comentado ?? null);
      setNome(processo.nome);
      setTotalTexto(
        String(processo.totalQuestoes)
      );
      setCriadoEm(processo.criadoEm);
      setRespostas(processo.respostas);
      setQuestaoAtual(
        Math.max(
          1,
          Math.min(
            processo.totalQuestoes,
            processo.questaoAtual
          )
        )
      );
      setSegundos(
        processo.segundos + tempoFora
      );
      setPausado(processo.pausado);
      setFinalizado(processo.finalizado);
      setFinalizarQuandoPronto(
        processo.finalizarQuandoPronto
      );
      setProgressoAnalise(
        processo.progressoAnalise
      );
      setErroAnalise(
        processo.erroAnalise ?? ""
      );
      setAnotacoesIniciais(
        anotacoesSalvas ?? {}
      );
      setIniciado(true);
      setProcessoRecuperavel(null);

      if (analiseSalva) {
        setAnalise(analiseSalva);
        setEstadoAnalise("concluida");
        setProgressoAnalise(100);
        setDescricaoAnalise("Análise pronta.");
      } else {
        await iniciarOuRetomarJob(
          proximo,
          processo.estadoAnalise === "erro"
        );
      }
    } catch (erro) {
      setEstadoAnalise("erro");
      setErroAnalise(
        erro instanceof Error
          ? erro.message
          : "Não foi possível recuperar o simulado."
      );
    } finally {
      setRestaurando(false);
    }
  }

  async function excluirProcessoAnterior() {
    const processo = processoRecuperavel;
    if (!processo) return;

    setRestaurando(true);

    try {
      await Promise.allSettled([
        excluirProcessoSimuladoPdf(
          processo.id
        ),
        excluirAnaliseSimuladoPdf(
          requestIdDoProcesso(processo.id)
        ),
      ]);
      setProcessoRecuperavel(null);
    } finally {
      setRestaurando(false);
    }
  }

  async function tentarNovamenteAnalise() {
    if (!rascunho) return;

    setReiniciandoAnalise(true);

    try {
      await iniciarOuRetomarJob(
        rascunho,
        true
      );
    } catch (erro) {
      setEstadoAnalise("erro");
      setErroAnalise(
        erro instanceof Error
          ? erro.message
          : "Não foi possível retomar a análise."
      );
    } finally {
      setReiniciandoAnalise(false);
    }
  }

  function responder(
    numero: number,
    letra: string
  ) {
    if (finalizado || pausado) return;

    setRespostas((atuais) => ({
      ...atuais,
      [String(numero)]: letra,
    }));
    setQuestaoAtual(
      Math.min(totalQuestoes, numero + 1)
    );
  }

  function finalizar() {
    if (
      estadoAnalise === "concluida" &&
      analise
    ) {
      setPausado(true);
      setFinalizado(true);
      return;
    }

    if (estadoAnalise === "erro") {
      window.alert(
        "A análise ainda precisa ser retomada antes da correção. Suas respostas continuam salvas."
      );
      return;
    }

    setFinalizarQuandoPronto(true);
    setPausado(true);
  }

  function cancelar() {
    const confirmar = window.confirm(
      "Cancelar este simulado? As respostas, anotações e o processo em andamento serão descartados."
    );
    if (!confirmar) return;

    const id = rascunho?.id;

    limparRascunhoSimuladoPdf();

    if (id) {
      void Promise.allSettled([
        excluirProcessoSimuladoPdf(id),
        excluirAnaliseSimuladoPdf(
          requestIdDoProcesso(id)
        ),
      ]);
    }

    setRascunho(null);
    setIniciado(false);
    setFinalizado(false);
    setAnalise(null);
    setEstadoAnalise("parado");
    setProgressoAnalise(0);
    setRespostas({});
    setSegundos(0);
    setAnotacoesIniciais(undefined);
  }

  function encerrarEVoltar() {
    const id = rascunho?.id;

    limparRascunhoSimuladoPdf();

    if (id) {
      void Promise.allSettled([
        excluirProcessoSimuladoPdf(id),
        excluirAnaliseSimuladoPdf(
          requestIdDoProcesso(id)
        ),
      ]);
    }

    navigate("/plano");
  }

  if (checandoRecuperacao) {
    return (
      <main className="simulado-pdf-workspace setup">
        <div className="simulado-pdf-recuperando">
          Verificando simulado em andamento…
        </div>
      </main>
    );
  }

  if (processoRecuperavel) {
    return (
      <main className="simulado-pdf-workspace setup">
        <section className="simulado-pdf-retomar">
          <span>SIMULADO EM ANDAMENTO</span>
          <h1>Encontramos um processo salvo</h1>
          <p>
            Este simulado não foi encerrado.
            Você pode continuar de onde parou ou
            excluir o processo e começar outro.
          </p>

          <div className="simulado-pdf-retomar-resumo">
            <div>
              <small>Simulado</small>
              <strong>
                {processoRecuperavel.nome}
              </strong>
            </div>
            <div>
              <small>Respostas</small>
              <strong>
                {
                  Object.values(
                    processoRecuperavel.respostas
                  ).filter(Boolean).length
                }
                /{
                  processoRecuperavel.totalQuestoes
                }
              </strong>
            </div>
            <div>
              <small>Análise</small>
              <strong>
                {
                  processoRecuperavel
                    .progressoAnalise
                }
                %
              </strong>
            </div>
          </div>

          <div className="simulado-pdf-retomar-acoes">
            <button
              type="button"
              className="continuar"
              disabled={restaurando}
              onClick={() =>
                void continuarProcessoAnterior()
              }
            >
              <Play size={18} />
              {restaurando
                ? "Recuperando…"
                : processoRecuperavel.finalizado
                  ? "Ver resultado"
                  : "Continuar processo"}
            </button>

            <button
              type="button"
              className="excluir"
              disabled={restaurando}
              onClick={() =>
                void excluirProcessoAnterior()
              }
            >
              <X size={18} />
              Excluir processo
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!iniciado || !caderno) {
    return (
      <main className="simulado-pdf-workspace setup">
        <section className="simulado-pdf-setup">
          <button
            type="button"
            className="voltar"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={18} />
            Voltar
          </button>

          <div>
            <span>
              PRÉVIA · SIMULADO DE DOMINGO
            </span>
            <h1>
              PDF + folha de respostas
            </h1>
            <p>
              Informe a quantidade para começar
              imediatamente. A IA analisa o PDF
              em segundo plano enquanto você resolve
              a prova.
            </p>
          </div>

          <label>
            <span>Nome do simulado</span>
            <input
              value={nome}
              onChange={(e) =>
                setNome(e.target.value)
              }
              placeholder="Simulado de domingo"
            />
          </label>

          <label>
            <span>
              Quantidade de questões
            </span>
            <input
              type="number"
              min={1}
              max={200}
              value={totalTexto}
              onChange={(e) =>
                setTotalTexto(e.target.value)
              }
            />
            <small>
              Esse número libera a folha de
              respostas sem esperar a IA.
            </small>
          </label>

          <label className="arquivo">
            <span>
              Caderno de questões · obrigatório
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) =>
                setCaderno(
                  e.target.files?.[0] ?? null
                )
              }
            />
            <strong>
              {caderno?.name ??
                "Selecionar PDF"}
            </strong>
          </label>

          <label className="arquivo">
            <span>
              PDF comentado/gabarito · opcional
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) =>
                setComentado(
                  e.target.files?.[0] ?? null
                )
              }
            />
            <strong>
              {comentado?.name ??
                "Adicionar segundo PDF"}
            </strong>
          </label>

          <button
            type="button"
            className="comecar"
            onClick={iniciarDoFormulario}
          >
            <Play size={18} />
            Começar simulado
          </button>
        </section>
      </main>
    );
  }

  if (finalizado && analise) {
    return (
      <main className="simulado-pdf-workspace resultado">
        <div className="simulado-pdf-resultado-topo">
          <button
            type="button"
            onClick={encerrarEVoltar}
          >
            <ChevronLeft size={18} />
            Voltar ao plano
          </button>

          <div>
            <span>SIMULADO FINALIZADO</span>
            <strong>
              {formatarTempo(segundos)}
            </strong>
          </div>
        </div>

        {analise.alertas.length > 0 && (
          <div className="simulado-pdf-alertas">
            <strong>
              Conferência da análise
            </strong>
            {analise.alertas.map(
              (alerta, indice) => (
                <span key={indice}>
                  {alerta}
                </span>
              )
            )}
          </div>
        )}

        <AnaliseSimuladoStudyPro
          origem="pdf"
          tentativaId={rascunho.id}
          simuladoId={rascunho.id}
          nome={nome}
          data={criadoEm}
          questoes={questoesResultado}
          respostas={respostasResultado}
          marcacoes={
            {} as Record<
              string,
              MarcacaoQuestaoSimulado
            >
          }
        />
      </main>
    );
  }

  return (
    <main className="simulado-pdf-workspace prova">
      <header className="simulado-pdf-topbar">
        <div className="identidade">
          <button
            type="button"
            onClick={cancelar}
            aria-label="Cancelar simulado"
          >
            <X size={18} />
          </button>
          <div>
            <span>
              SIMULADO EM ANDAMENTO
            </span>
            <strong>{nome}</strong>
          </div>
        </div>

        <div
          className={
            "analise-status " +
            estadoAnalise
          }
        >
          <span />
          <div>
            <strong>
              {estadoAnalise ===
              "analisando"
                ? "Processando questões · " +
                  progressoAnalise +
                  "%"
                : rotuloAnalise(
                    estadoAnalise
                  )}
            </strong>

            <div
              className="analise-progresso"
              aria-hidden="true"
            >
              <i
                style={{
                  width:
                    String(
                      progressoAnalise
                    ) + "%",
                }}
              />
            </div>

            <small>
              {estadoAnalise ===
              "concluida"
                ? String(
                    analise?.questoes
                      .length ??
                      totalQuestoes
                  ) +
                  " questões processadas · análise pronta para a correção"
                : estadoAnalise ===
                    "erro"
                  ? erroAnalise
                  : descricaoAnalise}
            </small>

            {estadoAnalise === "erro" && (
              <button
                type="button"
                className="analise-retomar"
                disabled={
                  reiniciandoAnalise
                }
                onClick={() =>
                  void tentarNovamenteAnalise()
                }
              >
                <RefreshCcw size={14} />
                {reiniciandoAnalise
                  ? "Retomando…"
                  : "Tentar novamente"}
              </button>
            )}
          </div>
        </div>

        <div className="cronometro">
          <strong>
            {formatarTempo(segundos)}
          </strong>
          <button
            type="button"
            onClick={() =>
              setPausado(
                (valor) => !valor
              )
            }
            className={
              pausado ? "retomar" : ""
            }
          >
            {pausado ? (
              <Play size={16} />
            ) : (
              <Pause size={16} />
            )}
            <span>
              {pausado
                ? "Retomar"
                : "Pausar"}
            </span>
          </button>

          <button
            type="button"
            className="finalizar"
            onClick={finalizar}
          >
            <Square size={15} />
            <span>Finalizar</span>
          </button>
        </div>
      </header>

      {finalizarQuandoPronto && (
        <div className="aguardando-final">
          <span className="spinner" />
          Você terminou. A IA está
          fechando o gabarito antes da
          correção.
        </div>
      )}

      <div className="simulado-pdf-mobile-tabs">
        <button
          type="button"
          className={
            abaMobile === "pdf"
              ? "ativo"
              : ""
          }
          onClick={() =>
            setAbaMobile("pdf")
          }
        >
          PDF
        </button>

        <button
          type="button"
          className={
            abaMobile === "respostas"
              ? "ativo"
              : ""
          }
          onClick={() =>
            setAbaMobile("respostas")
          }
        >
          Respostas · {respostasPreenchidas}/
          {totalQuestoes}
        </button>
      </div>

      <div className="simulado-pdf-corpo">
        <section
          className={
            "simulado-pdf-painel-pdf " +
            (abaMobile !== "pdf"
              ? "mobile-oculto"
              : "")
          }
        >
          <PdfAnotavel
            arquivo={caderno}
            pausado={pausado}
            anotacoesIniciais={
              anotacoesIniciais
            }
            onAnotacoesChange={
              persistirAnotacoes
            }
          />
        </section>

        <aside
          className={
            "simulado-pdf-gabarito " +
            (abaMobile !== "respostas"
              ? "mobile-oculto"
              : "")
          }
        >
          <div className="gabarito-cabecalho">
            <div>
              <span>
                FOLHA DE RESPOSTAS
              </span>
              <strong>
                {respostasPreenchidas}/
                {totalQuestoes}
              </strong>
            </div>

            <small>
              A correção só aparece
              depois que você finalizar.
            </small>
          </div>

          <div className="gabarito-lista">
            {Array.from(
              { length: totalQuestoes },
              (_, indice) => {
                const numero =
                  indice + 1;
                const marcada =
                  respostas[
                    String(numero)
                  ];

                return (
                  <div
                    key={numero}
                    className={
                      questaoAtual ===
                      numero
                        ? "atual"
                        : ""
                    }
                    onClick={() =>
                      setQuestaoAtual(
                        numero
                      )
                    }
                  >
                    <strong>
                      {numero}
                    </strong>

                    <div>
                      {LETRAS.map(
                        (letra) => (
                          <button
                            key={letra}
                            type="button"
                            disabled={
                              pausado
                            }
                            className={
                              marcada ===
                              letra
                                ? "marcada"
                                : ""
                            }
                            onClick={(
                              e
                            ) => {
                              e.stopPropagation();
                              responder(
                                numero,
                                letra
                              );
                            }}
                          >
                            {letra}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </aside>
      </div>

      {abaMobile === "pdf" && (
        <div className="simulado-pdf-resposta-rapida">
          <button
            type="button"
            onClick={() =>
              setQuestaoAtual(
                Math.max(
                  1,
                  questaoAtual - 1
                )
              )
            }
            aria-label="Questão anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <strong>
            Q{questaoAtual}
          </strong>

          <div>
            {LETRAS.map((letra) => (
              <button
                key={letra}
                type="button"
                disabled={pausado}
                className={
                  respostas[
                    String(
                      questaoAtual
                    )
                  ] === letra
                    ? "marcada"
                    : ""
                }
                onClick={() =>
                  responder(
                    questaoAtual,
                    letra
                  )
                }
              >
                {letra}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setQuestaoAtual(
                Math.min(
                  totalQuestoes,
                  questaoAtual + 1
                )
              )
            }
            aria-label="Próxima questão"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </main>
  );
}

function requestIdDoProcesso(
  processoId: string
) {
  return "simulado-pdf-" + processoId;
}

function rotuloAnalise(
  estado:
    | "parado"
    | "analisando"
    | "concluida"
    | "erro"
) {
  if (estado === "concluida") {
    return "Análise pronta · 100%";
  }

  if (estado === "erro") {
    return "Análise precisa ser retomada";
  }

  return "Preparando análise";
}

function formatarTempo(
  totalSegundos: number
) {
  const horas = Math.floor(
    totalSegundos / 3600
  );
  const minutos = Math.floor(
    (totalSegundos % 3600) / 60
  );
  const segundos =
    totalSegundos % 60;

  return [
    horas,
    minutos,
    segundos,
  ]
    .map((valor) =>
      String(valor).padStart(2, "0")
    )
    .join(":");
}
