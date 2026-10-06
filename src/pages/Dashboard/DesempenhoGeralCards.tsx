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
import type { DesempenhoMateria } from "../../utils/desempenhoMaterias";
import "./DashboardDesempenhoDonut.css";
import "./DashboardDesempenhoCards.css";

type StatusMateria = "bom" | "atencao" | "evoluindo";

export default function DesempenhoGeralCards({
  aproveitamento,
  totalQuestoes,
  materias,
  pontosAtencao,
  onDetalhes,
}: {
  aproveitamento: number;
  totalQuestoes: number;
  /** Matérias exibidas nos cards (já selecionadas pelo chamador). */
  materias: DesempenhoMateria[];
  /** Pontos de atenção calculados sobre TODAS as matérias (amostra mínima). */
  pontosAtencao: DesempenhoMateria[];
  onDetalhes: () => void;
}) {
  const mensagem = obterMensagemDesempenho(aproveitamento, totalQuestoes);
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
