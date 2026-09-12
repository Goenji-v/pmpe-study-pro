import { useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Flame,
  GraduationCap,
  Home,
  Menu,
  MoreHorizontal,
  Play,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import "./Demo.css";

type NavItem = {
  label: string;
  icon: (props: { size?: number; strokeWidth?: number }) => ReactNode;
};

type Task = {
  id: number;
  text: string;
  done: boolean;
};

const navItems: NavItem[] = [
  { label: "Início", icon: Home },
  { label: "Meu Plano", icon: Trophy },
  { label: "Estudos", icon: BookOpen },
  { label: "Questões", icon: ClipboardCheck },
  { label: "Revisões", icon: RotateCcw },
  { label: "Simulados", icon: FileText },
  { label: "Desempenho", icon: BarChart3 },
  { label: "Materiais", icon: GraduationCap },
  { label: "Cronograma", icon: CalendarDays },
  { label: "Mentoria", icon: UsersRound },
];

const subjects = [
  ["Direito Constitucional", 78, "blue"],
  ["Português", 85, "green"],
  ["Raciocínio Lógico", 72, "gold"],
  ["Direitos Humanos", 69, "orange"],
  ["História de PE", 83, "cyan"],
  ["Legislação PMPE", 76, "purple"],
] as const;

const week = [
  { day: "Seg", study: 44, questions: 62 },
  { day: "Ter", study: 51, questions: 70 },
  { day: "Qua", study: 58, questions: 76 },
  { day: "Qui", study: 70, questions: 92 },
  { day: "Sex", study: 61, questions: 80 },
  { day: "Sáb", study: 56, questions: 73 },
  { day: "Dom", study: 32, questions: 45 },
];

const initialTasks: Task[] = [
  { id: 1, text: "Assistir à aula de Direito Constitucional", done: true },
  { id: 2, text: "Resolver 30 questões de Português", done: true },
  { id: 3, text: "Revisar erros do simulado", done: false },
  { id: 4, text: "Ler resumo de Direitos Humanos", done: false },
  { id: 5, text: "Fazer anotação de Legislação PMPE", done: false },
  { id: 6, text: "Planejar estudos de amanhã", done: false },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`premium-brand ${compact ? "compact" : ""}`}>
      <div className="premium-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 72 82" role="img" aria-label="Escudo Studio Pro">
          <defs>
            <linearGradient id="shieldGold" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#fff0a7" />
              <stop offset="0.28" stopColor="#f8c54d" />
              <stop offset="0.62" stopColor="#a96808" />
              <stop offset="1" stopColor="#f8d77b" />
            </linearGradient>
          </defs>
          <path d="M36 3 66 14v23c0 20-12 33-30 42C18 70 6 57 6 37V14L36 3Z" fill="#07172b" stroke="url(#shieldGold)" strokeWidth="3" />
          <path d="M36 10 59 18v18c0 15-8 26-23 34-15-8-23-19-23-34V18l23-8Z" fill="none" stroke="url(#shieldGold)" strokeWidth="1.6" opacity=".9" />
          <text x="36" y="50" textAnchor="middle" fontSize="34" fontWeight="800" fill="url(#shieldGold)" fontFamily="Georgia, serif">S</text>
        </svg>
      </div>
      {!compact && (
        <div className="premium-brand-copy">
          <strong>STUDIO <span>PRO</span></strong>
          <small>ESTUDO HOJE. CONQUISTA SEMPRE.</small>
        </div>
      )}
    </div>
  );
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(date)
    .replace(/^./, (char) => char.toUpperCase());
}

function buildMonth(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array.from({ length: first }, () => null);

  for (let day = 1; day <= days; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function Demo() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState("Início");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [monthOffset, setMonthOffset] = useState(0);
  const [notice, setNotice] = useState("Prévia premium ativa — nenhuma alteração foi feita no site oficial.");

  const monthDate = useMemo(() => new Date(2026, 8 + monthOffset, 1), [monthOffset]);
  const calendarCells = useMemo(() => buildMonth(monthDate), [monthDate]);
  const completedTasks = tasks.filter((task) => task.done).length;

  function chooseNav(label: string) {
    setActive(label);
    setDrawerOpen(false);
    setNotice(`Prévia: área “${label}” selecionada. Na versão final, abrirá o módulo real do Studio Pro.`);
  }

  function toggleTask(id: number) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  function addTask() {
    const id = Date.now();
    setTasks((current) => [...current, { id, text: "Nova tarefa de estudo", done: false }]);
    setNotice("Tarefa adicionada somente nesta prévia.");
  }

  function action(message: string) {
    setNotice(message);
  }

  return (
    <div className="premium-preview-shell">
      <div className="premium-noise" />

      <aside className="premium-sidebar">
        <Brand />
        <nav className="premium-nav" aria-label="Navegação principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={active === item.label ? "active" : ""}
                onClick={() => chooseNav(item.label)}
              >
                <span className="premium-nav-icon"><Icon size={19} strokeWidth={1.9} /></span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="premium-sidebar-quote">
          <div className="premium-mountain-mark" />
          <span>“DISCIPLINA<br />TRANSFORMA<br />PLANOS EM<br />REALIDADE.”</span>
          <i />
        </div>
      </aside>

      <div className="premium-app">
        <header className="premium-topbar">
          <button className="premium-mobile-menu" type="button" onClick={() => setDrawerOpen(true)} aria-label="Abrir menu">
            <Menu size={21} />
          </button>
          <div className="premium-mobile-brand"><Brand compact /><b>STUDIO <span>PRO</span></b></div>

          <button type="button" className="premium-search" onClick={() => action("Busca rápida aberta na prévia.")}>
            <Search size={18} />
            <span>Buscar conteúdos, aulas, questões...</span>
            <kbd>Ctrl + K</kbd>
          </button>

          <div className="premium-top-actions">
            <button type="button" className="premium-icon-button" aria-label="Notificações" onClick={() => action("Você tem 3 notificações na prévia.")}>
              <Bell size={19} />
              <i />
            </button>
            <button type="button" className="premium-profile" onClick={() => action("Perfil do aluno selecionado.")}>
              <span className="premium-avatar">L</span>
              <span><b>Olá, Leandro!</b><small>Foco • Evolução • Aprovação</small></span>
              <ChevronRight size={16} />
            </button>
          </div>
        </header>

        <div className="premium-workspace">
          <main className="premium-main">
            <section className="premium-hero">
              <div className="premium-hero-copy">
                <span className="premium-kicker">STUDIO PRO</span>
                <h1>DISCIPLINA HOJE,<br /><em>APROVAÇÃO AMANHÃ!</em></h1>
                <p>Estudo inteligente, método e constância para conquistar sua vaga na PMPE.</p>
                <button type="button" onClick={() => action("Próxima aula aberta: Direito Constitucional.")}>
                  <Play size={17} fill="currentColor" />
                  Continuar estudando
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="premium-hero-art" aria-hidden="true">
                <div className="premium-sun" />
                <div className="premium-cityline city-one" />
                <div className="premium-cityline city-two" />
                <div className="premium-officer">
                  <div className="premium-head" />
                  <div className="premium-shoulder" />
                  <div className="premium-vest"><span>PMPE</span></div>
                </div>
                <div className="premium-hero-motto">SONHE.<br />PLANEJE.<br />ESTUDE.<br />CONQUISTE.<i /></div>
              </div>
            </section>

            <section className="premium-stats">
              <button type="button" className="premium-stat gold" onClick={() => action("Sequência: 12 dias de estudos.")}>
                <span className="premium-stat-icon"><Flame size={25} /></span>
                <span><strong>12 dias</strong><small>Sequência de estudos</small><em>↑ +3 dias que a semana passada</em></span>
                <ChevronRight size={16} />
              </button>
              <button type="button" className="premium-stat blue" onClick={() => action("Tempo estudado hoje: 3h 28min.")}>
                <span className="premium-stat-icon"><Clock3 size={25} /></span>
                <span><strong>3h 28min</strong><small>Tempo estudado hoje</small><em>↑ +44% que ontem</em></span>
                <ChevronRight size={16} />
              </button>
              <button type="button" className="premium-stat green" onClick={() => action("Desempenho médio: 78%.")}>
                <span className="premium-stat-icon"><Target size={25} /></span>
                <span><strong>78%</strong><small>Desempenho médio</small><em>↑ +12% que a semana passada</em></span>
                <ChevronRight size={16} />
              </button>
              <button type="button" className="premium-stat blue" onClick={() => action("342 questões resolvidas.")}>
                <span className="premium-stat-icon"><FileText size={25} /></span>
                <span><strong>342</strong><small>Questões resolvidas</small><em>↑ +86 esta semana</em></span>
                <ChevronRight size={16} />
              </button>
            </section>

            <section className="premium-analysis-grid">
              <article className="premium-card premium-week-card">
                <div className="premium-card-header">
                  <div><span className="premium-kicker">MEU PROGRESSO SEMANAL</span></div>
                  <button type="button" onClick={() => action("Filtro semanal selecionado.")}>Esta semana <ChevronRight size={14} /></button>
                </div>
                <div className="premium-legend"><span><i className="dot blue" />Tempo estudado</span><span><i className="dot gold" />Questões resolvidas</span></div>
                <div className="premium-bars">
                  {week.map((item) => (
                    <div className="premium-bar-column" key={item.day}>
                      <div className="premium-bar-pair">
                        <i className="study" style={{ height: `${item.study}%` }} />
                        <i className="questions" style={{ height: `${item.questions}%` }} />
                      </div>
                      <span>{item.day}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="premium-card premium-performance-card">
                <span className="premium-kicker">DESEMPENHO GERAL</span>
                <div className="premium-performance-body">
                  <div className="premium-donut"><div><strong>78%</strong><small>de acertos</small></div></div>
                  <div className="premium-performance-legend">
                    <span><i className="green" /> <b>78%</b> Acertos</span>
                    <span><i className="gold" /> <b>18%</b> Em revisão</span>
                    <span><i className="red" /> <b>4%</b> Erros</span>
                  </div>
                </div>
                <p>Você está 12% acima da sua média do último mês. Continue assim!</p>
              </article>
            </section>

            <section className="premium-study-grid">
              <article className="premium-card premium-next-lesson">
                <span className="premium-kicker">PRÓXIMA AULA</span>
                <div className="premium-lesson-body">
                  <button type="button" className="premium-lesson-cover" onClick={() => action("Player da aula aberto na prévia.")}>
                    <span><Play size={22} fill="currentColor" /></span>
                  </button>
                  <div>
                    <strong>Direito Constitucional</strong>
                    <p>Princípios Fundamentais da CF/88</p>
                    <small>▣ Aula 4 de 12 &nbsp;&nbsp; ◷ 28 min</small>
                  </div>
                  <ChevronRight size={18} />
                </div>
              </article>

              <article className="premium-card premium-subjects">
                <div className="premium-card-header">
                  <span className="premium-kicker">MINHAS DISCIPLINAS</span>
                  <button type="button" onClick={() => chooseNav("Estudos")}>Ver todas <ChevronRight size={14} /></button>
                </div>
                <div className="premium-subject-grid">
                  {subjects.map(([name, value, tone]) => (
                    <button type="button" key={name} className={`premium-subject ${tone}`} onClick={() => action(`${name}: ${value}% concluído.`)}>
                      <span className="premium-subject-icon"><BookOpen size={18} /></span>
                      <span><b>{name}</b><i><em style={{ width: `${value}%` }} /></i></span>
                      <small>{value}%</small>
                    </button>
                  ))}
                </div>
              </article>
            </section>

            <section className="premium-card premium-shortcuts">
              <span className="premium-kicker">ATALHOS DO SEU ESTUDO</span>
              <div className="premium-shortcut-grid">
                <button type="button" className="blue" onClick={() => chooseNav("Simulados")}><span><FileText size={22} /></span><div><b>Simulado Personalizado</b><small>Crie um simulado com os temas da sua escolha.</small></div><ChevronRight size={16} /></button>
                <button type="button" className="gold" onClick={() => chooseNav("Questões")}><span><ClipboardCheck size={22} /></span><div><b>Banco de Questões</b><small>Mais de 10 mil questões comentadas.</small></div><ChevronRight size={16} /></button>
                <button type="button" className="purple" onClick={() => action("Resumo Estratégico selecionado.")}><span><BookOpen size={22} /></span><div><b>Resumo Estratégico</b><small>Acesse resumos e mapas mentais.</small></div><ChevronRight size={16} /></button>
                <button type="button" className="green" onClick={() => chooseNav("Mentoria")}><span><UsersRound size={22} /></span><div><b>Mentoria</b><small>Tire suas dúvidas com acompanhamento.</small></div><ChevronRight size={16} /></button>
              </div>
            </section>
          </main>

          <aside className="premium-right-rail">
            <article className="premium-card premium-calendar">
              <div className="premium-calendar-head">
                <button type="button" onClick={() => setMonthOffset((value) => value - 1)}><ChevronLeft size={17} /></button>
                <strong>{formatMonth(monthDate)}</strong>
                <button type="button" onClick={() => setMonthOffset((value) => value + 1)}><ChevronRight size={17} /></button>
              </div>
              <div className="premium-weekdays">{["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((day) => <span key={day}>{day}</span>)}</div>
              <div className="premium-calendar-grid">
                {calendarCells.map((day, index) => {
                  const activeDay = monthOffset === 0 && day === 11;
                  const marked = day !== null && [5, 6, 9, 13, 17, 23].includes(day);
                  return (
                    <button type="button" disabled={day === null} key={`${day ?? "blank"}-${index}`} className={activeDay ? "today" : ""} onClick={() => day && action(`Dia ${day} selecionado no calendário.`)}>
                      {day ?? ""}
                      {marked && <i />}
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="premium-card premium-tasks">
              <div className="premium-task-head"><strong>TAREFAS DE HOJE</strong><span>{completedTasks}/{tasks.length}</span></div>
              <div className="premium-task-list">
                {tasks.map((task) => (
                  <label key={task.id} className={task.done ? "done" : ""}>
                    <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                    <span className="premium-check">{task.done && <Check size={13} strokeWidth={3} />}</span>
                    <em>{task.text}</em>
                  </label>
                ))}
              </div>
              <button type="button" className="premium-add-task" onClick={addTask}>+ Adicionar tarefa</button>
            </article>

            <article className="premium-quote-card">
              <div className="premium-quote-flag" />
              <blockquote>“A APROVAÇÃO<br />É UMA QUESTÃO<br />DE MÉTODO.”</blockquote>
              <i />
            </article>
          </aside>
        </div>
      </div>

      <nav className="premium-mobile-bottom" aria-label="Navegação mobile">
        <button type="button" className={active === "Início" ? "active" : ""} onClick={() => chooseNav("Início")}><Home size={19} /><span>Início</span></button>
        <button type="button" className={active === "Estudos" ? "active" : ""} onClick={() => chooseNav("Estudos")}><BookOpen size={19} /><span>Estudos</span></button>
        <button type="button" className={active === "Questões" ? "active" : ""} onClick={() => chooseNav("Questões")}><ClipboardCheck size={19} /><span>Questões</span></button>
        <button type="button" className={active === "Revisões" ? "active" : ""} onClick={() => chooseNav("Revisões")}><RotateCcw size={19} /><span>Revisões</span></button>
        <button type="button" onClick={() => setDrawerOpen(true)}><MoreHorizontal size={19} /><span>Mais</span></button>
      </nav>

      {drawerOpen && (
        <div className="premium-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}>
          <aside className="premium-mobile-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <div className="premium-drawer-head"><Brand /><button type="button" onClick={() => setDrawerOpen(false)}><X size={22} /></button></div>
            <nav>
              {navItems.map((item) => {
                const Icon = item.icon;
                return <button key={item.label} type="button" className={active === item.label ? "active" : ""} onClick={() => chooseNav(item.label)}><Icon size={20} /><span>{item.label}</span><ChevronRight size={16} /></button>;
              })}
            </nav>
            <div className="premium-drawer-profile"><span className="premium-avatar">L</span><div><b>Leandro</b><small>Nível 6 • Aluno</small></div><UserRound size={18} /></div>
          </aside>
        </div>
      )}

      <div className="premium-preview-notice"><Sparkles size={15} /><span>{notice}</span><Shield size={15} /></div>
    </div>
  );
}
