import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Square,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import AnaliseSimuladoStudyPro from "../../components/AnaliseSimuladoStudyPro/AnaliseSimuladoStudyPro";
import type {
  MarcacaoQuestaoSimulado,
  QuestaoAnaliseSimulado,
} from "../../utils/analiseSimuladoStudyPro";
import {
  analisarSimuladoPdf,
  type AnaliseSimuladoPdf,
} from "../../services/simuladoPdfAnaliseService";
import {
  limparRascunhoSimuladoPdf,
  obterRascunhoSimuladoPdf,
  type RascunhoSimuladoPdf,
} from "../../services/simuladoPdfDraft";
import {
  carregarAnalisePersistida,
  carregarArquivosSimuladoPdf,
  carregarProcessoSimuladoPdf,
  excluirProcessoSimuladoPdf,
  salvarAnalisePersistida,
  salvarArquivosSimuladoPdf,
  salvarProcessoSimuladoPdf,
  type ProcessoSimuladoPdfPersistido,
} from "../../services/simuladoPdfPersistencia";
import PdfAnotavel from "./PdfAnotavel";
import "./SimuladoPdf.css";

const LETRAS = ["A", "B", "C", "D", "E"];

export default function SimuladoPdf() {
  const navigate = useNavigate();
  const recebido = obterRascunhoSimuladoPdf();
  const execucaoAnaliseRef = useRef(0);

  const [rascunho, setRascunho] = useState<RascunhoSimuladoPdf | null>(recebido);
  const [nome, setNome] = useState(recebido?.nome ?? "Simulado de domingo");
  const [totalTexto, setTotalTexto] = useState(
    recebido?.totalQuestoes ? String(recebido.totalQuestoes) : "60"
  );
  const [caderno, setCaderno] = useState<File | null>(recebido?.caderno ?? null);
  const [comentado, setComentado] = useState<File | null>(recebido?.comentado ?? null);
  const [iniciado, setIniciado] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [questaoAtual, setQuestaoAtual] = useState(1);
  const [analise, setAnalise] = useState<AnaliseSimuladoPdf | null>(null);
  const [estadoAnalise, setEstadoAnalise] = useState<
    "parado" | "analisando" | "concluida" | "erro"
  >("parado");
  const [progressoAnalise, setProgressoAnalise] = useState(0);
  const [erroAnalise, setErroAnalise] = useState("");
  const [finalizarQuandoPronto, setFinalizarQuandoPronto] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [abaMobile, setAbaMobile] = useState<"pdf" | "respostas">("pdf");
  const [criadoEm, setCriadoEm] = useState(() => new Date().toISOString());
  const [processoRecuperavel, setProcessoRecuperavel] =
    useState<ProcessoSimuladoPdfPersistido | null>(null);
  const [checandoRecuperacao, setChecandoRecuperacao] = useState(!recebido);
  const [restaurando, setRestaurando] = useState(false);

  const totalQuestoes = rascunho?.totalQuestoes ?? (Number(totalTexto) || 0);

  const executarAnalise = useCallback(
    async (
      proximo: RascunhoSimuladoPdf,
      progressoInicial = 4
    ) => {
      const execucao = ++execucaoAnaliseRef.current;
      setEstadoAnalise("analisando");
      setErroAnalise("");
      setProgressoAnalise((atual) =>
        Math.max(atual, Math.max(4, Math.min(92, progressoInicial)))
      );

      const intervalo = window.setInterval(() => {
        setProgressoAnalise((atual) => {
          if (atual >= 94) return atual;
          const incremento = atual < 45 ? 3 : atual < 75 ? 2 : 1;
          return Math.min(94, atual + incremento);
        });
      }, 1400);

      try {
        const resultado = await analisarSimuladoPdf({
          prova: proximo.caderno,
          comentado: proximo.comentado,
          totalInformado: proximo.totalQuestoes,
        });

        if (execucaoAnaliseRef.current !== execucao) return;

        setAnalise(resultado);
        setEstadoAnalise("concluida");
        setProgressoAnalise(100);

        await salvarAnalisePersistida(proximo.id, resultado).catch(() => {
          // A tela continua utilizável mesmo se o armazenamento local falhar.
        });
      } catch (erro) {
        if (execucaoAnaliseRef.current !== execucao) return;

        setEstadoAnalise("erro");
        setErroAnalise(
          erro instanceof Error
            ? erro.message
            : "A análise da IA não pôde ser concluída."
        );
      } finally {
        window.clearInterval(intervalo);
      }
    },
    []
  );

  const iniciar = useCallback(
    (proximo: RascunhoSimuladoPdf) => {
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
      setProgressoAnalise(4);
      setEstadoAnalise("analisando");

      void salvarArquivosSimuladoPdf({
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
        respostas: {},
        questaoAtual: 1,
        segundos: 0,
        pausado: false,
        finalizado: false,
        finalizarQuandoPronto: false,
        estadoAnalise: "analisando",
        progressoAnalise: 4,
        criadoEm: agora,
      });

      void executarAnalise(proximo, 4);
    },
    [executarAnalise]
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
    if (rascunho && !iniciado && estadoAnalise === "parado" && !processoRecuperavel) {
      iniciar(rascunho);
    }
  }, [estadoAnalise, iniciado, iniciar, processoRecuperavel, rascunho]);

  useEffect(() => {
    if (!iniciado || pausado || finalizado) return;

    const id = window.setInterval(() => {
      setSegundos((valor) => valor + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, [finalizado, iniciado, pausado]);

  useEffect(() => {
    if (finalizarQuandoPronto && estadoAnalise === "concluida" && analise) {
      setPausado(true);
      setFinalizado(true);
      setFinalizarQuandoPronto(false);
    }
  }, [analise, estadoAnalise, finalizarQuandoPronto]);

  const persistirEstadoAtual = useCallback(
    (segundosAtuais = segundos) => {
      if (!iniciado || !rascunho) return;

      salvarProcessoSimuladoPdf({
        id: rascunho.id,
        nome,
        totalQuestoes: rascunho.totalQuestoes,
        semana: rascunho.semana,
        dia: rascunho.dia,
        respostas,
        questaoAtual,
        segundos: segundosAtuais,
        pausado,
        finalizado,
        finalizarQuandoPronto,
        estadoAnalise:
          estadoAnalise === "concluida" || estadoAnalise === "erro"
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
    return () => window.removeEventListener("beforeunload", antesDeSair);
  }, [persistirEstadoAtual]);

  const respostasPreenchidas = Object.values(respostas).filter(Boolean).length;

  const questoesResultado = useMemo<QuestaoAnaliseSimulado[]>(
    () =>
      (analise?.questoes ?? []).map((item) => ({
        id: "pdf-" + item.numero,
        numero: item.numero,
        materia: item.materia,
        assunto: item.assunto,
        subassunto: item.subassunto,
        dificuldade: item.dificuldade,
        enunciado: item.enunciado,
        alternativas: item.alternativas,
        gabarito: item.gabarito,
        explicacao: item.comentario,
        anulada: !item.gabarito || item.confianca < 35,
      })),
    [analise]
  );

  const respostasResultado = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: totalQuestoes }, (_, indice) => {
          const numero = indice + 1;
          return ["pdf-" + numero, respostas[String(numero)]];
        })
      ),
    [respostas, totalQuestoes]
  );

  function iniciarDoFormulario() {
    const total = Number(totalTexto);

    if (!caderno) {
      window.alert("Selecione o PDF do caderno de questões.");
      return;
    }

    if (!Number.isInteger(total) || total < 1 || total > 200) {
      window.alert("Informe uma quantidade entre 1 e 200 questões.");
      return;
    }

    iniciar({
      id: crypto.randomUUID(),
      nome: nome.trim() || "Simulado de domingo",
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
      const arquivos = await carregarArquivosSimuladoPdf(processo.id);

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
      };

      const analiseSalva = await carregarAnalisePersistida(processo.id);
      const atualizadoEm = Date.parse(processo.atualizadoEm);
      const tempoFora =
        !processo.pausado &&
        !processo.finalizado &&
        Number.isFinite(atualizadoEm)
          ? Math.max(0, Math.floor((Date.now() - atualizadoEm) / 1000))
          : 0;

      setRascunho(proximo);
      setCaderno(proximo.caderno);
      setComentado(proximo.comentado ?? null);
      setNome(processo.nome);
      setTotalTexto(String(processo.totalQuestoes));
      setCriadoEm(processo.criadoEm);
      setRespostas(processo.respostas);
      setQuestaoAtual(
        Math.max(1, Math.min(processo.totalQuestoes, processo.questaoAtual))
      );
      setSegundos(processo.segundos + tempoFora);
      setPausado(processo.pausado);
      setFinalizado(processo.finalizado);
      setFinalizarQuandoPronto(processo.finalizarQuandoPronto);
      setProgressoAnalise(processo.progressoAnalise);
      setErroAnalise(processo.erroAnalise ?? "");
      setIniciado(true);
      setProcessoRecuperavel(null);

      if (analiseSalva) {
        setAnalise(analiseSalva);
        setEstadoAnalise("concluida");
        setProgressoAnalise(100);
      } else if (processo.estadoAnalise === "erro") {
        setEstadoAnalise("erro");
      } else {
        setEstadoAnalise("analisando");
        void executarAnalise(proximo, processo.progressoAnalise);
      }
    } finally {
      setRestaurando(false);
    }
  }

  async function excluirProcessoAnterior() {
    const processo = processoRecuperavel;
    if (!processo) return;

    setRestaurando(true);
    try {
      await excluirProcessoSimuladoPdf(processo.id);
      setProcessoRecuperavel(null);
    } finally {
      setRestaurando(false);
    }
  }

  function responder(numero: number, letra: string) {
    if (finalizado || pausado) return;

    setRespostas((atuais) => ({
      ...atuais,
      [String(numero)]: letra,
    }));
    setQuestaoAtual(Math.min(totalQuestoes, numero + 1));
  }

  function finalizar() {
    if (estadoAnalise === "concluida" && analise) {
      setPausado(true);
      setFinalizado(true);
      return;
    }

    if (estadoAnalise === "erro") {
      window.alert(
        "A análise da IA falhou. Recarregue a análise antes de finalizar para não corrigir com gabarito incompleto."
      );
      return;
    }

    setFinalizarQuandoPronto(true);
    setPausado(true);
  }

  function cancelar() {
    const confirmar = window.confirm(
      "Cancelar este simulado? As respostas e o processo salvo neste aparelho serão descartados."
    );
    if (!confirmar) return;

    execucaoAnaliseRef.current += 1;
    limparRascunhoSimuladoPdf();
    void excluirProcessoSimuladoPdf(rascunho?.id);

    setRascunho(null);
    setIniciado(false);
    setFinalizado(false);
    setAnalise(null);
    setEstadoAnalise("parado");
    setProgressoAnalise(0);
    setRespostas({});
    setSegundos(0);
  }

  if (checandoRecuperacao) {
    return (
      <main className="simulado-pdf-workspace setup">
        <div className="simulado-pdf-recuperando">Verificando simulado em andamento…</div>
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
            Este simulado não foi encerrado. Você pode continuar de onde parou
            ou excluir o processo e começar outro.
          </p>

          <div className="simulado-pdf-retomar-resumo">
            <div>
              <small>Simulado</small>
              <strong>{processoRecuperavel.nome}</strong>
            </div>
            <div>
              <small>Respostas</small>
              <strong>
                {Object.values(processoRecuperavel.respostas).filter(Boolean).length}/
                {processoRecuperavel.totalQuestoes}
              </strong>
            </div>
            <div>
              <small>Análise</small>
              <strong>{processoRecuperavel.progressoAnalise}%</strong>
            </div>
          </div>

          <div className="simulado-pdf-retomar-acoes">
            <button
              type="button"
              className="continuar"
              disabled={restaurando}
              onClick={() => void continuarProcessoAnterior()}
            >
              <Play size={18} />
              {restaurando ? "Recuperando…" : "Continuar processo"}
            </button>
            <button
              type="button"
              className="excluir"
              disabled={restaurando}
              onClick={() => void excluirProcessoAnterior()}
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
          <button type="button" className="voltar" onClick={() => navigate(-1)}>
            <ChevronLeft size={18} />
            Voltar
          </button>

          <div>
            <span>PRÉVIA · SIMULADO DE DOMINGO</span>
            <h1>PDF + folha de respostas</h1>
            <p>
              Informe a quantidade para começar imediatamente. A IA analisa o
              PDF em segundo plano enquanto você resolve a prova.
            </p>
          </div>

          <label>
            <span>Nome do simulado</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Simulado de domingo"
            />
          </label>

          <label>
            <span>Quantidade de questões</span>
            <input
              type="number"
              min={1}
              max={200}
              value={totalTexto}
              onChange={(e) => setTotalTexto(e.target.value)}
            />
            <small>Esse número libera a folha de respostas sem esperar a IA.</small>
          </label>

          <label className="arquivo">
            <span>Caderno de questões · obrigatório</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setCaderno(e.target.files?.[0] ?? null)}
            />
            <strong>{caderno?.name ?? "Selecionar PDF"}</strong>
          </label>

          <label className="arquivo">
            <span>PDF comentado/gabarito · opcional</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setComentado(e.target.files?.[0] ?? null)}
            />
            <strong>{comentado?.name ?? "Adicionar segundo PDF"}</strong>
          </label>

          <button type="button" className="comecar" onClick={iniciarDoFormulario}>
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
          <button type="button" onClick={cancelar}>
            <ChevronLeft size={18} />
            Voltar
          </button>
          <div>
            <span>SIMULADO FINALIZADO</span>
            <strong>{formatarTempo(segundos)}</strong>
          </div>
        </div>

        <AnaliseSimuladoStudyPro
          origem="ia"
          tentativaId={rascunho?.id ?? "preview-pdf"}
          simuladoId={rascunho?.id}
          nome={nome}
          data={criadoEm}
          questoes={questoesResultado}
          respostas={respostasResultado}
          marcacoes={{} as Record<string, MarcacaoQuestaoSimulado>}
          persistir={false}
          agendarAutomaticamente={false}
          somenteLeitura
        />
      </main>
    );
  }

  return (
    <main className="simulado-pdf-workspace prova">
      <header className="simulado-pdf-topbar">
        <div className="identidade">
          <button type="button" onClick={cancelar} aria-label="Cancelar simulado">
            <X size={18} />
          </button>
          <div>
            <span>SIMULADO EM ANDAMENTO</span>
            <strong>{nome}</strong>
          </div>
        </div>

        <div className={"analise-status " + estadoAnalise}>
          <span />
          <div>
            <strong>
              {estadoAnalise === "analisando"
                ? "Processando questões · " + progressoAnalise + "%"
                : rotuloAnalise(estadoAnalise)}
            </strong>
            <div className="analise-progresso" aria-hidden="true">
              <i style={{ width: String(progressoAnalise) + "%" }} />
            </div>
            <small>
              {estadoAnalise === "concluida"
                ? String(analise?.questoes.length ?? totalQuestoes) +
                  " questões processadas · análise mantida neste aparelho"
                : estadoAnalise === "erro"
                  ? erroAnalise
                  : "Você pode responder normalmente enquanto a análise continua."}
            </small>
          </div>
        </div>

        <div className="cronometro">
          <strong>{formatarTempo(segundos)}</strong>
          <button
            type="button"
            onClick={() => setPausado((valor) => !valor)}
            className={pausado ? "retomar" : ""}
          >
            {pausado ? <Play size={16} /> : <Pause size={16} />}
            <span>{pausado ? "Retomar" : "Pausar"}</span>
          </button>
          <button type="button" className="finalizar" onClick={finalizar}>
            <Square size={15} />
            <span>Finalizar</span>
          </button>
        </div>
      </header>

      {finalizarQuandoPronto && (
        <div className="aguardando-final">
          <span className="spinner" />
          Você terminou. A IA está fechando o gabarito antes da correção.
        </div>
      )}

      <div className="simulado-pdf-mobile-tabs">
        <button
          type="button"
          className={abaMobile === "pdf" ? "ativo" : ""}
          onClick={() => setAbaMobile("pdf")}
        >
          PDF
        </button>
        <button
          type="button"
          className={abaMobile === "respostas" ? "ativo" : ""}
          onClick={() => setAbaMobile("respostas")}
        >
          Respostas · {respostasPreenchidas}/{totalQuestoes}
        </button>
      </div>

      <div className="simulado-pdf-corpo">
        <section
          className={
            "simulado-pdf-painel-pdf " +
            (abaMobile !== "pdf" ? "mobile-oculto" : "")
          }
        >
          <PdfAnotavel arquivo={caderno} pausado={pausado} />
        </section>

        <aside
          className={
            "simulado-pdf-gabarito " +
            (abaMobile !== "respostas" ? "mobile-oculto" : "")
          }
        >
          <div className="gabarito-cabecalho">
            <div>
              <span>FOLHA DE RESPOSTAS</span>
              <strong>
                {respostasPreenchidas}/{totalQuestoes}
              </strong>
            </div>
            <small>A correção só aparece depois que você finalizar.</small>
          </div>

          <div className="gabarito-lista">
            {Array.from({ length: totalQuestoes }, (_, indice) => {
              const numero = indice + 1;
              const marcada = respostas[String(numero)];

              return (
                <div
                  key={numero}
                  className={questaoAtual === numero ? "atual" : ""}
                  onClick={() => setQuestaoAtual(numero)}
                >
                  <strong>{numero}</strong>
                  <div>
                    {LETRAS.map((letra) => (
                      <button
                        key={letra}
                        type="button"
                        disabled={pausado}
                        className={marcada === letra ? "marcada" : ""}
                        onClick={(e) => {
                          e.stopPropagation();
                          responder(numero, letra);
                        }}
                      >
                        {letra}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {abaMobile === "pdf" && (
        <div className="simulado-pdf-resposta-rapida">
          <button
            type="button"
            onClick={() => setQuestaoAtual(Math.max(1, questaoAtual - 1))}
            aria-label="Questão anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <strong>Q{questaoAtual}</strong>

          <div>
            {LETRAS.map((letra) => (
              <button
                key={letra}
                type="button"
                disabled={pausado}
                className={
                  respostas[String(questaoAtual)] === letra ? "marcada" : ""
                }
                onClick={() => responder(questaoAtual, letra)}
              >
                {letra}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setQuestaoAtual(Math.min(totalQuestoes, questaoAtual + 1))
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

function rotuloAnalise(
  estado: "parado" | "analisando" | "concluida" | "erro"
) {
  if (estado === "concluida") return "Análise pronta · 100%";
  if (estado === "erro") return "Análise precisa ser refeita";
  return "Preparando análise";
}

function formatarTempo(totalSegundos: number) {
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  return [horas, minutos, segundos]
    .map((valor) => String(valor).padStart(2, "0"))
    .join(":");
}
