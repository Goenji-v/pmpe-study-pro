import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  BookOpen,
  FileText,
  Landmark,
  Lightbulb,
  Monitor,
  Scale,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import type { RegistroQuestao, Simulado } from "../../types/index";
import Dashboard from "./Dashboard";
import "./DashboardDesempenhoDonut.css";
import "./DashboardDesempenhoCards.css";

const USAR_DESEMPENHO_CARDS = true;

export default function DashboardOficial() {
  const navigate = useNavigate();
  const { questoes, revisoes, simulados } = useApp();
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);

  const materiasDesempenho = useMemo(() => calcularDesempenhoPorMateria(questoes), [questoes]);

  const desempenho = useMemo(() => {
    const simuladosContabilizaveis = filtrarSimuladosSemEspelhoQuestoes(simulados, questoes);

    const certas =
      questoes.reduce((total, registro) => total + Math.max(0, Number(registro.certas) || 0), 0) +
      simuladosContabilizaveis.reduce((total, simulado) => total + Math.max(0, Number(simulado.certas) || 0), 0);

    const erros =
      questoes.reduce((total, registro) => total + Math.max(0, Number(registro.erradas) || 0), 0) +
      simuladosContabilizaveis.reduce((total, simulado) => total + Math.max(0, Number(simulado.erradas) || 0), 0);

    const total = certas + erros;
    const aproveitamento = total === 0 ? 0 : Math.round((certas / total) * 100);
    const percentualErros = total === 0 ? 0 : Math.max(0, 100 - aproveitamento);
    const emRevisao = revisoes.filter((revisao) => !revisao.concluida).length;

    return { certas, erros, total, aproveitamento, percentualErros, emRevisao };
  }, [questoes, revisoes, simulados]);

  useEffect(() => {
    let cancelado = false;
    let tentativas = 0;
    let timer = 0;

    const localizarPainel = () => {
      if (cancelado) return;

      const painel = document.querySelector<HTMLElement>(".dashboard-pro-performance");
      if (painel) {
        painel.classList.add("dashboard-pro-performance-donut-ready");
        setAlvo(painel);
        return;
      }

      tentativas += 1;
      if (tentativas < 20) {
        timer = window.setTimeout(localizarPainel, 50);
      }
    };

    localizarPainel();

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      const painel = document.querySelector<HTMLElement>(".dashboard-pro-performance");
      painel?.classList.remove("dashboard-pro-performance-donut-ready");
    };
  }, []);

  return (
    <>
      <Dashboard />
      {alvo && createPortal(
        USAR_DESEMPENHO_CARDS ? (
          <DesempenhoGeralCards
            aproveitamento={desempenho.aproveitamento}
            totalQuestoes={desempenho.total}
            materias={materiasDesempenho}
            onDetalhes={() => navigate("/desempenho")}
          />
        ) : (
          <DesempenhoGeral
            aproveitamento={desempenho.aproveitamento}
            percentualErros={desempenho.percentualErros}
            emRevisao={desempenho.emRevisao}
            totalQuestoes={desempenho.total}
            onDetalhes={() => navigate("/desempenho")}
          />
        ),
        alvo
      )}
    </>
  );
}

type MateriaDesempenho = {
  materia: string;
  percentual: number;
  total: number;
};

type StatusMateria = "bom" | "atencao" | "evoluindo";

function DesempenhoGeralCards({
  aproveitamento,
  totalQuestoes,
  materias,
  onDetalhes,
}: {
  aproveitamento: number;
  totalQuestoes: number;
  materias: MateriaDesempenho[];
  onDetalhes: () => void;
}) {
  const mensagem = obterMensagemDesempenho(aproveitamento, totalQuestoes);
  const pontosAtencao = materias
    .filter((item) => item.percentual < aproveitamento)
    .sort((a, b) => a.percentual - b.percentual)
    .slice(0, 2);
  const nomesAtencao = pontosAtencao.map((item) => item.materia);
  const recomendacao = nomesAtencao.length > 0
    ? `Inclua mais questões e revisões de ${nomesAtencao.join(" e ")} na sua rotina desta semana.`
    : "Mantenha o ritmo atual e use as revisões para consolidar o desempenho.";

  return (
    <div className="dashboard-geral-cards-card">
      <header className="dashboard-geral-donut-header">
        <div>
          <span className="dashboard-pro-kicker">DESEMPENHO</span>
          <div className="dashboard-geral-cards-titleline">
            <h2>Desempenho geral</h2>
            <strong>{aproveitamento}%</strong>
          </div>
          <p>Seu esforço, traduzido em evolução.</p>
        </div>
        <button type="button" onClick={onDetalhes}>Ver detalhes ↗</button>
      </header>

      <div className="dashboard-geral-cards-content">
        <section className="dashboard-cards-area" aria-label="Desempenho por matéria">
          {materias.length > 0 ? (
            <div className="dashboard-cards-grid">
              {materias.map((item, indice) => {
                const status = obterStatusMateria(item.percentual);
                const Icone = obterIconeMateria(item.materia);

                return (
                  <button
                    type="button"
                    className={`dashboard-materia-card dashboard-materia-tone-${indice + 1}`}
                    key={item.materia}
                    title={`${item.materia}: ${item.percentual}% (${item.total} questões)`}
                    aria-label={`Abrir desempenho de ${item.materia}`}
                    onClick={onDetalhes}
                  >
                    <div className="dashboard-materia-card-top">
                      <span className="dashboard-materia-icon" aria-hidden="true">
                        <Icone size={18} strokeWidth={2.1} />
                      </span>
                      <strong>{item.materia}</strong>
                      <span className={`dashboard-materia-status dashboard-materia-status-${status}`}>
                        {status === "atencao" ? "atenção" : status}
                      </span>
                    </div>

                    <div className="dashboard-materia-percentual">{item.percentual}%</div>

                    <div
                      className="dashboard-materia-progress"
                      role="img"
                      aria-label={`${item.materia}: ${item.percentual}% de aproveitamento`}
                    >
                      <span style={{ width: `${Math.max(0, Math.min(100, item.percentual))}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-cards-empty">
              <BarChart3 size={26} aria-hidden="true" />
              <strong>Seu desempenho por matéria começa nas primeiras questões</strong>
              <span>Resolva questões para o Study Pro montar os cards automaticamente.</span>
            </div>
          )}
        </section>

        <aside className="dashboard-cards-insight">
          <span className="dashboard-cards-insight-icon" aria-hidden="true">
            <TrendingUp size={22} strokeWidth={2.2} />
          </span>
          <h3>Foque nos pontos de atenção</h3>
          <p>{mensagem.texto}</p>

          <div className="dashboard-cards-recomendacao">
            <span aria-hidden="true"><Lightbulb size={17} /></span>
            <div>
              <strong>Recomendação</strong>
              <p>{recomendacao}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function obterStatusMateria(percentual: number): StatusMateria {
  if (percentual >= 75) return "evoluindo";
  if (percentual >= 65) return "bom";
  return "atencao";
}

function obterIconeMateria(materia: string) {
  const nome = materia.toLocaleLowerCase("pt-BR");

  if (nome.includes("constitucional")) return Scale;
  if (nome.includes("legisla")) return FileText;
  if (nome.includes("inform")) return Monitor;
  if (nome.includes("portugu")) return BookOpen;
  if (nome.includes("hist")) return Landmark;
  return BarChart3;
}


function DesempenhoGeral({
  aproveitamento,
  percentualErros,
  emRevisao,
  totalQuestoes,
  onDetalhes,
}: {
  aproveitamento: number;
  percentualErros: number;
  emRevisao: number;
  totalQuestoes: number;
  onDetalhes: () => void;
}) {
  const mensagem = obterMensagemDesempenho(aproveitamento, totalQuestoes);
  const estiloDonut = {
    "--dashboard-donut-acertos": `${Math.max(0, Math.min(100, aproveitamento))}%`,
  } as CSSProperties;

  return (
    <div className="dashboard-geral-donut-card">
      <header className="dashboard-geral-donut-header">
        <div>
          <span className="dashboard-pro-kicker">DESEMPENHO</span>
          <h2>Desempenho geral</h2>
          <p>Seu esforço, traduzido em evolução.</p>
        </div>
        <button type="button" onClick={onDetalhes}>Ver detalhes ↗</button>
      </header>

      <div className="dashboard-geral-donut-content">
        <div className="dashboard-geral-donut-metricas">
          <div
            className="dashboard-geral-donut"
            style={estiloDonut}
            role="img"
            aria-label={`Aproveitamento geral de ${aproveitamento}%`}
          >
            <div className="dashboard-geral-donut-centro">
              <strong>{aproveitamento}<small>%</small></strong>
              <span>APROVEITAMENTO</span>
            </div>
          </div>

          <div className="dashboard-geral-donut-legenda">
            <div><i className="acertos" /><span>Acertos</span><strong>{aproveitamento}%</strong></div>
            <div><i className="revisao" /><span>Em revisão</span><strong>{emRevisao}</strong></div>
            <div><i className="erros" /><span>Erros</span><strong>{percentualErros}%</strong></div>
          </div>
        </div>

        <div className="dashboard-geral-donut-feedback">
          <span className="dashboard-geral-feedback-icone">⌁</span>
          <div>
            <h3>{mensagem.titulo}</h3>
            <p>{mensagem.texto}</p>
            <button
              type="button"
              className="dashboard-geral-feedback-cta"
              onClick={onDetalhes}
            >
              ↗ {mensagem.acao}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function obterMensagemDesempenho(aproveitamento: number, totalQuestoes: number) {
  if (totalQuestoes === 0) {
    return {
      titulo: "Seu desempenho começa na primeira questão",
      texto: "Resolva questões para o Study Pro montar seu aproveitamento geral e mostrar sua evolução.",
      acao: "Comece e acompanhe sua evolução",
    };
  }

  if (aproveitamento >= 80) {
    return {
      titulo: "Excelente desempenho",
      texto: `Seu aproveitamento atual é ${aproveitamento}%. Continue revisando os pontos mais difíceis para sustentar esse nível.`,
      acao: "Mantenha esse ritmo",
    };
  }

  if (aproveitamento >= 65) {
    return {
      titulo: "Você está no caminho certo",
      texto: `Seu aproveitamento atual é ${aproveitamento}%. Continue acompanhando seus resultados para evoluir com consistência.`,
      acao: "Continue com essa constância",
    };
  }

  if (aproveitamento >= 50) {
    return {
      titulo: "Boa evolução, com espaço para subir",
      texto: `Seu aproveitamento atual é ${aproveitamento}%. Revisar os erros mais recorrentes pode acelerar sua evolução.`,
      acao: "Ataque os pontos fracos",
    };
  }

  return {
    titulo: "Hora de reforçar a base",
    texto: `Seu aproveitamento atual é ${aproveitamento}%. Use as revisões e o histórico de erros para priorizar o que mais precisa de atenção.`,
    acao: "Transforme erros em revisão",
  };
}

function calcularDesempenhoPorMateria(questoes: RegistroQuestao[]): MateriaDesempenho[] {
  const mapa = new Map<string, { certas: number; erradas: number }>();

  questoes.forEach((registro) => {
    const materia = String(registro.materia || "").trim();
    if (!materia) return;

    const atual = mapa.get(materia) ?? { certas: 0, erradas: 0 };
    mapa.set(materia, {
      certas: atual.certas + Math.max(0, Number(registro.certas) || 0),
      erradas: atual.erradas + Math.max(0, Number(registro.erradas) || 0),
    });
  });

  return [...mapa.entries()]
    .map(([materia, dados]) => {
      const total = dados.certas + dados.erradas;
      return {
        materia,
        total,
        percentual: total === 0 ? 0 : Math.round((dados.certas / total) * 100),
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total || b.percentual - a.percentual)
    .slice(0, 6);
}

function filtrarSimuladosSemEspelhoQuestoes(
  simulados: Simulado[],
  questoes: RegistroQuestao[]
): Simulado[] {
  const tentativasJaContabilizadas = new Set(
    questoes
      .map((registro) => registro.tentativaId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );

  return simulados.filter(
    (simulado) => !simulado.tentativaId || !tentativasJaContabilizadas.has(simulado.tentativaId)
  );
}
