import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileQuestion,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

import "./DemoEstatisticas.css";

type Periodo = "Tudo" | "Hoje" | "7 dias" | "30 dias" | "Este mês";

const desempenhoMaterias = [
  { nome: "Direito Constitucional", percentual: 88, questoes: 74, status: "forte" },
  { nome: "História de Pernambuco", percentual: 83, questoes: 46, status: "forte" },
  { nome: "Português", percentual: 79, questoes: 81, status: "bom" },
  { nome: "Legislação PMPE", percentual: 76, questoes: 58, status: "bom" },
  { nome: "Direitos Humanos", percentual: 69, questoes: 47, status: "atencao" },
  { nome: "Raciocínio Lógico", percentual: 62, questoes: 36, status: "atencao" },
];

const evolucao = [64, 68, 66, 71, 73, 76, 78, 75, 80, 82, 79, 84];

const atividade = [
  1, 2, 2, 0, 3, 1, 2,
  2, 3, 1, 2, 3, 2, 0,
  1, 3, 3, 2, 1, 3, 2,
  2, 2, 3, 3, 2, 1, 3,
];

function Brand() {
  return (
    <div className="stats-brand">
      <div className="stats-brand-shield" aria-hidden="true">S</div>
      <div>
        <strong>STUDIO <span>PRO</span></strong>
        <small>ESTUDO HOJE. CONQUISTA SEMPRE.</small>
      </div>
    </div>
  );
}

function Ring() {
  return (
    <div className="stats-ring" aria-label="78% de aproveitamento">
      <div className="stats-ring-core">
        <strong>78%</strong>
        <span>aproveitamento</span>
      </div>
    </div>
  );
}

function TrendChart() {
  const points = useMemo(() => {
    return evolucao.map((valor, index) => {
      const x = 8 + index * (284 / (evolucao.length - 1));
      const y = 110 - ((valor - 55) / 35) * 82;
      return `${x},${Math.max(18, Math.min(108, y))}`;
    }).join(" ");
  }, []);

  return (
    <div className="stats-trend-chart">
      <div className="stats-chart-grid" />
      <svg viewBox="0 0 300 120" preserveAspectRatio="none" aria-label="Evolução de aproveitamento">
        <defs>
          <linearGradient id="statsLine" x1="0" x2="1">
            <stop offset="0" stopColor="#1687ff" />
            <stop offset="1" stopColor="#ffd15b" />
          </linearGradient>
          <linearGradient id="statsArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1687ff" stopOpacity=".26" />
            <stop offset="1" stopColor="#1687ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`8,112 ${points} 292,112`} fill="url(#statsArea)" />
        <polyline points={points} fill="none" stroke="url(#statsLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {evolucao.map((valor, index) => {
          const x = 8 + index * (284 / (evolucao.length - 1));
          const y = 110 - ((valor - 55) / 35) * 82;
          return <circle key={`${valor}-${index}`} cx={x} cy={Math.max(18, Math.min(108, y))} r="3.3" fill="#071421" stroke="#72bbff" strokeWidth="2" />;
        })}
      </svg>
      <div className="stats-chart-labels"><span>Out</span><span>Nov</span><span>Dez</span><span>Jan</span><span>Fev</span><span>Mar</span></div>
    </div>
  );
}

export default function DemoEstatisticas() {
  const [periodo, setPeriodo] = useState<Periodo>("30 dias");
  const [materia, setMateria] = useState("Todas as matérias");

  const melhorMateria = desempenhoMaterias[0];
  const focoMateria = desempenhoMaterias[desempenhoMaterias.length - 1];

  return (
    <main className="stats-preview">
      <div className="stats-glow stats-glow-one" />
      <div className="stats-glow stats-glow-two" />

      <header className="stats-topbar">
        <Brand />
        <div className="stats-top-actions">
          <Link to="/demo" className="stats-back"><ArrowLeft size={17} /> Dashboard</Link>
          <span className="stats-preview-badge"><Sparkles size={14} /> PRÉVIA PREMIUM</span>
        </div>
      </header>

      <section className="stats-content">
        <div className="stats-heading-row">
          <div>
            <span className="stats-eyebrow">ANÁLISE DE DESEMPENHO</span>
            <h1>Estatísticas</h1>
            <p>Entenda sua evolução, descubra seus pontos fortes e veja exatamente onde concentrar o próximo estudo.</p>
          </div>
          <div className="stats-rank-box">
            <Trophy size={25} />
            <div><small>NÍVEL DE DESEMPENHO</small><strong>Excelente</strong></div>
            <span>TOP 18%</span>
          </div>
        </div>

        <section className="stats-filter-panel">
          <div className="stats-periods">
            {(["Tudo", "Hoje", "7 dias", "30 dias", "Este mês"] as Periodo[]).map((item) => (
              <button key={item} type="button" className={periodo === item ? "active" : ""} onClick={() => setPeriodo(item)}>{item}</button>
            ))}
          </div>
          <label className="stats-select">
            <BookOpen size={15} />
            <select value={materia} onChange={(event) => setMateria(event.target.value)}>
              <option>Todas as matérias</option>
              {desempenhoMaterias.map((item) => <option key={item.nome}>{item.nome}</option>)}
            </select>
            <ChevronDown size={15} />
          </label>
          <label className="stats-select muted">
            <Target size={15} />
            <select defaultValue="Todos os assuntos"><option>Todos os assuntos</option></select>
            <ChevronDown size={15} />
          </label>
        </section>

        <section className="stats-summary-grid">
          <article className="stats-overview-card">
            <div className="stats-card-title"><span>DESEMPENHO GERAL</span><b>+12% no período</b></div>
            <div className="stats-overview-body">
              <Ring />
              <div className="stats-overview-copy">
                <strong>Você está evoluindo.</strong>
                <p>Seu aproveitamento médio subiu <b>12 pontos</b> desde o início do período selecionado.</p>
                <div className="stats-mini-legend">
                  <span><i className="green" />267 certas</span>
                  <span><i className="red" />75 erradas</span>
                  <span><i className="gold" />342 questões</span>
                </div>
              </div>
            </div>
          </article>

          <div className="stats-kpi-grid">
            <article><span className="blue"><FileQuestion size={22} /></span><div><small>QUESTÕES</small><strong>342</strong><em>+86 esta semana</em></div></article>
            <article><span className="green"><CheckCircle2 size={22} /></span><div><small>ACERTOS</small><strong>267</strong><em>78% de aproveitamento</em></div></article>
            <article><span className="gold"><Clock3 size={22} /></span><div><small>TEMPO ESTUDADO</small><strong>32h 48min</strong><em>+4h 12min no período</em></div></article>
            <article><span className="purple"><RotateCcw size={22} /></span><div><small>REVISÕES</small><strong>24</strong><em>18 concluídas</em></div></article>
          </div>
        </section>

        <section className="stats-main-grid">
          <article className="stats-panel stats-evolution-card">
            <div className="stats-panel-head">
              <div><span className="stats-eyebrow">EVOLUÇÃO</span><h2>Aproveitamento ao longo do tempo</h2></div>
              <span className="stats-positive"><TrendingUp size={15} /> +20 pts</span>
            </div>
            <TrendChart />
          </article>

          <article className="stats-panel stats-activity-card">
            <div className="stats-panel-head"><div><span className="stats-eyebrow">CONSISTÊNCIA</span><h2>Atividade de estudos</h2></div><CalendarDays size={20} /></div>
            <div className="stats-heatmap">
              {atividade.map((nivel, index) => <i key={index} className={`level-${nivel}`} title={`Dia ${index + 1}`} />)}
            </div>
            <div className="stats-activity-footer"><span>28 dias analisados</span><strong>21 dias ativos</strong></div>
          </article>
        </section>

        <section className="stats-subjects-layout">
          <article className="stats-panel stats-subjects-card">
            <div className="stats-panel-head"><div><span className="stats-eyebrow">POR DISCIPLINA</span><h2>Seu desempenho por matéria</h2></div><BarChart3 size={21} /></div>
            <div className="stats-subject-list">
              {desempenhoMaterias.map((item) => (
                <div className="stats-subject-row" key={item.nome}>
                  <div className="stats-subject-name"><strong>{item.nome}</strong><small>{item.questoes} questões</small></div>
                  <div className="stats-progress"><i><em style={{ width: `${item.percentual}%` }} /></i></div>
                  <strong className={`stats-score ${item.status}`}>{item.percentual}%</strong>
                </div>
              ))}
            </div>
          </article>

          <aside className="stats-insights">
            <article className="stats-insight strong">
              <span className="stats-insight-icon"><Trophy size={24} /></span>
              <small>SEU PONTO FORTE</small>
              <h3>{melhorMateria.nome}</h3>
              <strong>{melhorMateria.percentual}%</strong>
              <p>Você está acima da meta nessa disciplina. Mantenha revisões curtas para não perder rendimento.</p>
            </article>
            <article className="stats-insight focus">
              <span className="stats-insight-icon"><Target size={24} /></span>
              <small>FOCO RECOMENDADO</small>
              <h3>{focoMateria.nome}</h3>
              <strong>{focoMateria.percentual}%</strong>
              <p>É a matéria com maior margem de evolução. O Studio Pro priorizaria questões e revisões dela no seu próximo ciclo.</p>
            </article>
          </aside>
        </section>

        <section className="stats-bottom-banner">
          <div className="stats-bottom-icon"><Sparkles size={22} /></div>
          <div><span>INSIGHT DO STUDIO PRO</span><strong>Seu ritmo atual pode levar seu aproveitamento geral para 82% nas próximas semanas.</strong></div>
          <button type="button">Ver plano recomendado</button>
        </section>
      </section>
    </main>
  );
}
