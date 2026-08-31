import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  ListTodo,
  Menu,
  RotateCcw,
  ShieldCheck,
  Target,
  TrendingUp,
  X,
} from "lucide-react";

import "./Demo.css";

type SecaoDemo =
  | "dashboard"
  | "plano"
  | "questoes"
  | "revisoes"
  | "simulados";

const secoes = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "plano" as const, label: "Plano Tático", icon: ListTodo },
  { id: "questoes" as const, label: "Questões", icon: BookOpenCheck },
  { id: "revisoes" as const, label: "Revisões", icon: RotateCcw },
  { id: "simulados" as const, label: "Simulados", icon: ClipboardCheck },
];

const desempenho = [
  { materia: "Informática", valor: 82 },
  { materia: "Português", valor: 74 },
  { materia: "Constitucional", valor: 61 },
  { materia: "Direitos Humanos", valor: 48 },
];

function DashboardDemo() {
  return (
    <>
      <div className="demo-cabecalho-pagina">
        <div>
          <span>VISÃO GERAL</span>
          <h1>Como estou indo?</h1>
          <p>Um retrato rápido do desempenho e do que merece atenção agora.</p>
        </div>
        <div className="demo-badge-meta">Meta diária: 60 questões</div>
      </div>

      <div className="demo-metricas">
        <article>
          <Target size={18} />
          <span>Questões hoje</span>
          <strong>42</strong>
          <small>70% da meta</small>
        </article>
        <article>
          <TrendingUp size={18} />
          <span>Taxa de acerto</span>
          <strong>71%</strong>
          <small>+6 p.p. nos últimos 7 dias</small>
        </article>
        <article>
          <Clock3 size={18} />
          <span>Tempo estudado</span>
          <strong>1h 38m</strong>
          <small>2 sessões concluídas</small>
        </article>
        <article>
          <RotateCcw size={18} />
          <span>Revisões</span>
          <strong>3/5</strong>
          <small>2 pendentes para hoje</small>
        </article>
      </div>

      <div className="demo-grid-principal">
        <section className="demo-card">
          <div className="demo-card-titulo">
            <div>
              <span>DESEMPENHO POR MATÉRIA</span>
              <h2>Onde você está mais forte</h2>
            </div>
            <BarChart3 size={20} />
          </div>

          <div className="demo-barras">
            {desempenho.map((item) => (
              <div key={item.materia}>
                <div className="demo-barra-topo">
                  <span>{item.materia}</span>
                  <strong>{item.valor}%</strong>
                </div>
                <div className="demo-barra-trilho">
                  <span style={{ width: `${item.valor}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="demo-card demo-card-destaque">
          <span className="demo-kicker">PRIORIDADE AGORA</span>
          <div className="demo-alerta-icone">!</div>
          <h2>Direitos Humanos</h2>
          <p>
            Seu rendimento recente ficou abaixo de 50%. O sistema colocaria esse conteúdo no topo da próxima revisão.
          </p>
          <div className="demo-chip">12 questões sugeridas</div>
        </section>
      </div>
    </>
  );
}

function PlanoDemo() {
  const missoes = [
    ["Revisão urgente", "Direitos Humanos", "20 min", true],
    ["Questões direcionadas", "Direito Constitucional", "25 questões", false],
    ["Teoria + fixação", "Português · Fonologia", "35 min", false],
  ] as const;

  return (
    <>
      <div className="demo-cabecalho-pagina">
        <div>
          <span>PLANO TÁTICO</span>
          <h1>O que preciso fazer?</h1>
          <p>As missões são montadas a partir do edital, erros e revisões pendentes.</p>
        </div>
        <div className="demo-badge-meta">3 missões de hoje</div>
      </div>

      <section className="demo-card">
        <div className="demo-card-titulo">
          <div>
            <span>SEGUNDA-FEIRA</span>
            <h2>Missões recomendadas</h2>
          </div>
          <ListTodo size={20} />
        </div>

        <div className="demo-missoes">
          {missoes.map(([tipo, materia, carga, concluida], indice) => (
            <article key={tipo} className={concluida ? "concluida" : ""}>
              <div className="demo-missao-numero">
                {concluida ? <CheckCircle2 size={19} /> : indice + 1}
              </div>
              <div>
                <span>{tipo}</span>
                <strong>{materia}</strong>
                <small>{carga}</small>
              </div>
              <ChevronRight size={18} />
            </article>
          ))}
        </div>
      </section>

      <div className="demo-nota">
        <ShieldCheck size={18} />
        <span>Na conta real, concluir uma missão atualiza automaticamente o progresso e as próximas recomendações.</span>
      </div>
    </>
  );
}

function QuestoesDemo() {
  return (
    <>
      <div className="demo-cabecalho-pagina">
        <div>
          <span>CENTRAL DE QUESTÕES</span>
          <h1>Transforme erro em revisão</h1>
          <p>Registre um bloco de questões e deixe o sistema mostrar onde os pontos estão sendo perdidos.</p>
        </div>
        <div className="demo-badge-meta">Últimos 30 dias</div>
      </div>

      <div className="demo-grid-principal">
        <section className="demo-card">
          <div className="demo-card-titulo">
            <div>
              <span>ÚLTIMO REGISTRO</span>
              <h2>Direito Constitucional</h2>
            </div>
            <BookOpenCheck size={20} />
          </div>

          <div className="demo-registro-questoes">
            <div><span>Questões</span><strong>20</strong></div>
            <div><span>Acertos</span><strong>12</strong></div>
            <div><span>Erros</span><strong>8</strong></div>
            <div><span>Aproveitamento</span><strong>60%</strong></div>
          </div>

          <div className="demo-form-falso" aria-label="Exemplo de registro de questões">
            <label>Assunto <span>Direitos e garantias fundamentais</span></label>
            <label>Banca <span>AOCP</span></label>
            <button type="button">Registrar resultado</button>
          </div>
        </section>

        <section className="demo-card">
          <div className="demo-card-titulo">
            <div>
              <span>DIAGNÓSTICO</span>
              <h2>Leitura automática</h2>
            </div>
            <Target size={20} />
          </div>

          <div className="demo-diagnosticos">
            <div className="forte"><strong>Informática</strong><span>82% · forte</span></div>
            <div className="medio"><strong>Constitucional</strong><span>61% · atenção</span></div>
            <div className="fraco"><strong>Direitos Humanos</strong><span>48% · revisão urgente</span></div>
          </div>
        </section>
      </div>
    </>
  );
}

function RevisoesDemo() {
  const revisoes = [
    ["Direitos Humanos", "Declaração Universal", "Hoje", "urgente"],
    ["Português", "Encontros vocálicos", "Hoje", "normal"],
    ["Informática", "Internet, intranet e extranet", "Amanhã", "normal"],
    ["História de PE", "Governo de Nassau", "Em 3 dias", "normal"],
  ] as const;

  return (
    <>
      <div className="demo-cabecalho-pagina">
        <div>
          <span>REVISÕES</span>
          <h1>Revisar no momento certo</h1>
          <p>O Study Pro organiza o retorno ao conteúdo sem depender de planilha manual.</p>
        </div>
        <div className="demo-badge-meta">2 para hoje</div>
      </div>

      <section className="demo-card">
        <div className="demo-lista-revisoes">
          {revisoes.map(([materia, assunto, quando, prioridade]) => (
            <article key={assunto}>
              <div className={`demo-revisao-status ${prioridade}`} />
              <div>
                <span>{materia}</span>
                <strong>{assunto}</strong>
              </div>
              <time>{quando}</time>
              <button type="button">Revisar</button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SimuladosDemo() {
  return (
    <>
      <div className="demo-cabecalho-pagina">
        <div>
          <span>SIMULADOS</span>
          <h1>Prova, diagnóstico e próxima ação</h1>
          <p>O resultado deixa de ser apenas uma nota e vira informação para o plano de estudo.</p>
        </div>
        <div className="demo-badge-meta">Último: 38/60</div>
      </div>

      <div className="demo-grid-principal">
        <section className="demo-card demo-simulado-resumo">
          <span>SIMULADO PMPE · 60 QUESTÕES</span>
          <strong>63%</strong>
          <p>38 acertos · 22 erros</p>
          <div className="demo-progresso-circular" aria-label="63 por cento de acertos">63</div>
        </section>

        <section className="demo-card">
          <div className="demo-card-titulo">
            <div>
              <span>DIAGNÓSTICO DO SIMULADO</span>
              <h2>Próxima prioridade</h2>
            </div>
            <ClipboardCheck size={20} />
          </div>

          <div className="demo-diagnosticos">
            <div className="forte"><strong>Informática</strong><span>9/10</span></div>
            <div className="medio"><strong>Constitucional</strong><span>5/10</span></div>
            <div className="fraco"><strong>Direitos Humanos</strong><span>4/10</span></div>
          </div>
        </section>
      </div>
    </>
  );
}

export default function Demo() {
  const [secao, setSecao] = useState<SecaoDemo>("dashboard");
  const [menuAberto, setMenuAberto] = useState(false);

  const conteudo = useMemo(() => {
    if (secao === "plano") return <PlanoDemo />;
    if (secao === "questoes") return <QuestoesDemo />;
    if (secao === "revisoes") return <RevisoesDemo />;
    if (secao === "simulados") return <SimuladosDemo />;
    return <DashboardDemo />;
  }, [secao]);

  function escolherSecao(novaSecao: SecaoDemo) {
    setSecao(novaSecao);
    setMenuAberto(false);
  }

  return (
    <main className="demo-pagina">
      <div className="demo-topbar">
        <div>
          <span className="demo-topbar-pulso" />
          MODO DEMONSTRAÇÃO
          <small>Dados fictícios · nenhuma informação é salva na sua conta</small>
        </div>
        <Link to="/login">Criar minha conta <ChevronRight size={15} /></Link>
      </div>

      <div className="demo-shell">
        <aside className={menuAberto ? "demo-sidebar aberto" : "demo-sidebar"}>
          <div className="demo-marca">
            <div>PM</div>
            <span><strong>Study Pro</strong><small>Demonstração</small></span>
          </div>

          <nav aria-label="Navegação da demonstração">
            {secoes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={secao === id ? "ativo" : ""}
                onClick={() => escolherSecao(id)}
                aria-pressed={secao === id}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="demo-sidebar-cta">
            <span>Gostou do fluxo?</span>
            <strong>Crie sua conta e use com seus próprios dados.</strong>
            <Link to="/login">Começar agora</Link>
          </div>
        </aside>

        {menuAberto && (
          <button
            type="button"
            className="demo-overlay"
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu da demonstração"
          />
        )}

        <section className="demo-conteudo">
          <header className="demo-header">
            <button
              type="button"
              className="demo-menu"
              onClick={() => setMenuAberto((aberto) => !aberto)}
              aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            >
              {menuAberto ? <X size={21} /> : <Menu size={21} />}
            </button>
            <div>
              <span>Conta demonstrativa</span>
              <strong>Candidato PMPE</strong>
            </div>
          </header>

          <div className="demo-area">{conteudo}</div>
        </section>
      </div>
    </main>
  );
}
