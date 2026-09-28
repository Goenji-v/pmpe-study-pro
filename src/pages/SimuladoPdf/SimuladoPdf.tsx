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
import PdfAnotavel from "./PdfAnotavel";
import "./SimuladoPdf.css";

const LETRAS = ["A", "B", "C", "D", "E"];

export default function SimuladoPdf() {
  const navigate = useNavigate();
  const recebido = obterRascunhoSimuladoPdf();

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
  const [erroAnalise, setErroAnalise] = useState("");
  const [finalizarQuandoPronto, setFinalizarQuandoPronto] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [abaMobile, setAbaMobile] = useState<"pdf" | "respostas">("pdf");

  const totalQuestoes = rascunho?.totalQuestoes ?? Number(totalTexto) || 0;

  const iniciar = useCallback((proximo: RascunhoSimuladoPdf) => {
    setRascunho(proximo);
    setCaderno(proximo.caderno);
    setComentado(proximo.comentado ?? null);
    setNome(proximo.nome);
    setTotalTexto(String(proximo.totalQuestoes));
    setIniciado(true);
    setPausado(false);
    setSegundos(0);
    setRespostas({});
    setQuestaoAtual(1);
    setFinalizado(false);
    setFinalizarQuandoPronto(false);
    setAnalise(null);
    setErroAnalise("");
    setEstadoAnalise("analisando");

    void analisarSimuladoPdf({
      prova: proximo.caderno,
      comentado: proximo.comentado,
      totalInformado: proximo.totalQuestoes,
    })
      .then((resultado) => {
        setAnalise(resultado);
        setEstadoAnalise("concluida");
      })
      .catch((erro) => {
        setEstadoAnalise("erro");
        setErroAnalise(
          erro instanceof Error
            ? erro.message
            : "A análise da IA não pôde ser concluída."
        );
      });
  }, []);

  useEffect(() => {
    if (rascunho && !iniciado && estadoAnalise === "parado") {
      iniciar(rascunho);
    }
  }, [estadoAnalise, iniciado, iniciar, rascunho]);

  useEffect(() => {
    if (!iniciado || pausado || finalizado) return;
    const id = window.setInterval(() => setSegundos((valor) => valor + 1), 1000);
    return () => window.clearInterval(id);
  }, [finalizado, iniciado, pausado]);

  useEffect(() => {
    if (finalizarQuandoPronto && estadoAnalise === "concluida" && analise) {
      setPausado(true);
      setFinalizado(true);
      setFinalizarQuandoPronto(false);
    }
  }, [analise, estadoAnalise, finalizarQuandoPronto]);

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

  function responder(numero: number, letra: string) {
    if (finalizado || pausado) return;
    setRespostas((atuais) => ({ ...atuais, [String(numero)]: letra }));
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
      "Cancelar este simulado? As respostas e anotações desta prévia serão descartadas."
    );
    if (!confirmar) return;

    limparRascunhoSimuladoPdf();
    setRascunho(null);
    setIniciado(false);
    setFinalizado(false);
    setAnalise(null);
    setEstadoAnalise("parado");
    setRespostas({});
    setSegundos(0);
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
          data={new Date().toISOString()}
          questoes={questoesResultado}
          respostas={respostasResultado}
          marcacoes={{} as Record<string, MarcacaoQuestaoSimulado>}
          persistir={false}
          agendarAutomaticamente={false}
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
            <strong>{rotuloAnalise(estadoAnalise)}</strong>
            <small>
              {estadoAnalise === "concluida"
                ? String(analise?.questoes.length ?? totalQuestoes) +
                  " questões processadas"
                : estadoAnalise === "erro"
                  ? erroAnalise
                  : "Você pode continuar respondendo normalmente."}
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
  if (estado === "analisando") return "IA analisando o PDF em segundo plano";
  if (estado === "concluida") return "Análise pronta";
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
