import { useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Flame,
  FolderOpen,
  GraduationCap,
  Home,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import "./DemoCompleto.css";

type SectionId =
  | "inicio"
  | "plano"
  | "estudos"
  | "questoes"
  | "revisoes"
  | "simulados"
  | "desempenho"
  | "materiais"
  | "cronograma"
  | "mentoria";

type NavItem = {
  id: SectionId;
  label: string;
  icon: (props: { size?: number; strokeWidth?: number }) => ReactNode;
};

const navItems: NavItem[] = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "plano", label: "Meu Plano", icon: Trophy },
  { id: "estudos", label: "Estudos", icon: BookOpen },
  { id: "questoes", label: "Questões", icon: ClipboardCheck },
  { id: "revisoes", label: "Revisões", icon: RotateCcw },
  { id: "simulados", label: "Simulados", icon: FileText },
  { id: "desempenho", label: "Desempenho", icon: BarChart3 },
  { id: "materiais", label: "Materiais", icon: FolderOpen },
  { id: "cronograma", label: "Cronograma", icon: CalendarDays },
  { id: "mentoria", label: "Mentoria", icon: UsersRound },
];

const week = [42, 55, 63, 88, 72, 67, 38];
const weekQuestions = [54, 61, 70, 95, 82, 76, 47];
const subjects = [
  ["Direito Constitucional", 88],
  ["Português", 79],
  ["Legislação PMPE", 76],
  ["História de PE", 72],
  ["Direitos Humanos", 69],
  ["Raciocínio Lógico", 62],
] as const;

function Logo() {
  return (
    <div className="dc-brand">
      <div className="dc-logo" aria-hidden="true"><span>S</span></div>
      <div><strong>STUDIO <em>PRO</em></strong><small>ESTUDO HOJE. CONQUISTA SEMPRE.</small></div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return <span className="dc-progress"><i style={{ width: `${value}%` }} /></span>;
}

function Donut({ value = 78 }: { value?: number }) {
  return (
    <div className="dc-donut" style={{ background: `conic-gradient(#1d8cff 0 ${value}%, #ffc348 ${value}% 96%, #ff665f 96% 100%)` }}>
      <div><b>{value}%</b><span>de acertos</span></div>
    </div>
  );
}

function HomeSection({ action }: { action: (text: string) => void }) {
  return (
    <>
      <section className="dc-hero">
        <div className="dc-hero-copy">
          <span className="dc-kicker">STUDIO PRO</span>
          <h1>DISCIPLINA HOJE,<br /><em>APROVAÇÃO AMANHÃ!</em></h1>
          <p>Estudo inteligente, método comprovado e um painel construído para manter você no caminho da aprovação.</p>
          <button onClick={() => action("Próxima aula aberta na prévia.")}><Play size={17} fill="currentColor" /> Continuar estudando <ChevronRight size={18} /></button>
        </div>
        <div className="dc-hero-art"><div className="dc-city" /><div className="dc-officer">PMPE</div><div className="dc-motto">SONHE.<br/>PLANEJE.<br/>ESTUDE.<br/>CONQUISTE.</div></div>
      </section>

      <div className="dc-metrics">
        <button onClick={() => action("Sequência detalhada: 12 dias.")}><span className="gold"><Flame size={23}/></span><div><b>12 dias</b><small>Sequência de estudos</small><em>↑ +3 dias</em></div></button>
        <button onClick={() => action("Tempo estudado detalhado.")}><span className="blue"><Clock3 size={23}/></span><div><b>3h 28min</b><small>Tempo estudado hoje</small><em>↑ +42% que ontem</em></div></button>
        <button onClick={() => action("Desempenho geral aberto.")}><span className="green"><Target size={23}/></span><div><b>78%</b><small>Desempenho médio</small><em>↑ +12% no período</em></div></button>
        <button onClick={() => action("Resumo de questões aberto.")}><span className="blue"><FileText size={23}/></span><div><b>342</b><small>Questões resolvidas</small><em>↑ +86 esta semana</em></div></button>
      </div>

      <div className="dc-two-col">
        <article className="dc-card dc-chart-card">
          <header><div><span className="dc-kicker">MEU PROGRESSO SEMANAL</span><p>Tempo estudado e questões resolvidas</p></div><button onClick={() => action("Filtro semanal aberto.")}>Esta semana ▾</button></header>
          <div className="dc-bar-chart">
            {week.map((value, index) => <div key={index}><span><i className="study" style={{height:`${value}%`}}/><i className="questions" style={{height:`${weekQuestions[index]}%`}}/></span><small>{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][index]}</small></div>)}
          </div>
        </article>
        <article className="dc-card dc-performance">
          <span className="dc-kicker">DESEMPENHO GERAL</span>
          <div className="dc-performance-body"><Donut/><div className="dc-legend"><span><i className="green"/> <b>78%</b> Acertos</span><span><i className="gold"/> <b>18%</b> Em revisão</span><span><i className="red"/> <b>4%</b> Erros</span></div></div>
          <div className="dc-insight">◎ <span>Você está 12% acima da sua média do último mês.</span></div>
        </article>
      </div>

      <div className="dc-two-col lesson-grid">
        <article className="dc-card dc-next"><span className="dc-kicker">PRÓXIMA AULA</span><button onClick={() => action("Aula de Direito Constitucional iniciada.")}><div className="dc-cover"><Play size={24}/></div><div><b>Direito Constitucional</b><p>Princípios Fundamentais da CF/88</p><small>Aula 4 de 12 • 28 min</small></div><ChevronRight/></button></article>
        <article className="dc-card"><header><span className="dc-kicker">MINHAS DISCIPLINAS</span><button onClick={() => action("Lista completa de disciplinas aberta.")}>Ver todas</button></header><div className="dc-subject-mini">{subjects.slice(0,6).map(([name,value])=><button key={name} onClick={()=>action(`${name}: ${value}% concluído.`)}><b>{name}</b><Progress value={value}/><small>{value}%</small></button>)}</div></article>
      </div>
    </>
  );
}

function PlanSection({ action }: { action: (text: string) => void }) {
  const days = [
    ["Hoje", "Direito Constitucional", "60 min", "20 questões"],
    ["Amanhã", "Português", "60 min", "20 questões"],
    ["Sábado", "Legislação PMPE", "90 min", "30 questões"],
    ["Domingo", "Simulado PMPE", "120 min", "50 questões"],
  ];
  return <Page title="Meu Plano" subtitle="Sua rota de estudos organizada em metas, ciclos e entregas.">
    <div className="dc-metrics compact"><button><span className="gold"><Trophy/></span><div><b>74%</b><small>Plano concluído</small><em>↑ dentro da meta</em></div></button><button><span className="blue"><Clock3/></span><div><b>2h/dia</b><small>Carga planejada</small><em>manhã + noite</em></div></button><button><span className="green"><CheckCircle2/></span><div><b>18/24</b><small>Metas da semana</small><em>6 restantes</em></div></button></div>
    <div className="dc-two-col"><article className="dc-card"><header><div><span className="dc-kicker">ROTA DA SEMANA</span><p>Plano adaptativo da mentoria</p></div><button onClick={()=>action("Editor do plano aberto.")}>Editar plano</button></header><div className="dc-timeline">{days.map(([day,subject,time,q],i)=><button key={day} onClick={()=>action(`${subject} selecionado.`)}><span>{i+1}</span><div><b>{day} • {subject}</b><small>{time} • {q}</small></div><ChevronRight size={17}/></button>)}</div></article><article className="dc-card dc-goal"><span className="dc-kicker">META DO CICLO</span><div className="dc-big-number">24h</div><p>18h 10min concluídas</p><Progress value={76}/><div className="dc-goal-row"><span><b>342</b><small>questões</small></span><span><b>8</b><small>revisões</small></span><span><b>2</b><small>simulados</small></span></div></article></div>
  </Page>;
}

function StudiesSection({ action }: { action: (text: string) => void }) {
  return <Page title="Estudos" subtitle="Aulas, disciplinas e progresso em um único lugar.">
    <article className="dc-card dc-feature"><div><span className="dc-kicker">CONTINUAR DE ONDE PAROU</span><h2>Direito Constitucional</h2><p>Princípios Fundamentais da CF/88 • Aula 4 de 12</p><Progress value={58}/><small>18:42 de 28:00</small></div><button onClick={()=>action("Player da aula aberto.")}><Play size={18} fill="currentColor"/> Retomar aula</button></article>
    <div className="dc-grid3">{subjects.map(([name,value],index)=><article className="dc-card dc-course" key={name}><span className={`dc-course-icon tone-${index%4}`}><BookOpen size={21}/></span><h3>{name}</h3><p>{8+index} aulas • {index+2} materiais</p><Progress value={value}/><footer><small>{value}% concluído</small><button onClick={()=>action(`${name} aberto.`)}>Abrir <ChevronRight size={15}/></button></footer></article>)}</div>
  </Page>;
}

function QuestionsSection({ action }: { action: (text: string) => void }) {
  return <Page title="Questões" subtitle="Treino dirigido, banco de questões e análise dos seus erros.">
    <div className="dc-metrics compact"><button><span className="blue"><ClipboardCheck/></span><div><b>342</b><small>Respondidas</small><em>esta semana</em></div></button><button><span className="green"><Target/></span><div><b>78%</b><small>Taxa de acertos</small><em>+6 p.p.</em></div></button><button><span className="gold"><Flame/></span><div><b>67</b><small>Questões hoje</small><em>meta: 80</em></div></button></div>
    <div className="dc-grid3"><ActionCard title="Banco de Questões" text="Filtre por matéria, assunto, banca e dificuldade." icon={<Search/>} onClick={()=>action("Banco de questões aberto.")}/><ActionCard title="Caderno de Erros" text="Revise exatamente o que você mais erra." icon={<RotateCcw/>} onClick={()=>action("Caderno de erros aberto.")}/><ActionCard title="Treino Inteligente" text="Lista automática focada nas suas fraquezas." icon={<Sparkles/>} onClick={()=>action("Treino inteligente gerado.")}/></div>
    <article className="dc-card"><header><div><span className="dc-kicker">DESEMPENHO POR MATÉRIA</span><p>Últimas 342 questões</p></div><button onClick={()=>action("Filtros de questões abertos.")}>Filtrar</button></header><div className="dc-ranking">{subjects.map(([name,value],index)=><button key={name} onClick={()=>action(`${name}: ${value}% de acertos.`)}><span>{String(index+1).padStart(2,"0")}</span><b>{name}</b><Progress value={value}/><strong>{value}%</strong></button>)}</div></article>
  </Page>;
}

function ReviewsSection({ action }: { action: (text: string) => void }) {
  const reviewRows = [["Segurança da Informação", "Atrasada", "5 dias"],["Lei Maria da Penha", "Hoje", "agora"],["Conectivos e tabelas-verdade", "Hoje", "18:00"],["Direitos Humanos", "Amanhã", "09:00"],["Legislação PMPE", "Amanhã", "20:00"]];
  return <Page title="Revisões" subtitle="Fila inteligente para você revisar no momento certo.">
    <div className="dc-metrics compact"><button><span className="redish"><RotateCcw/></span><div><b>5</b><small>Atrasadas</small><em>prioridade alta</em></div></button><button><span className="gold"><Clock3/></span><div><b>2</b><small>Para hoje</small><em>próximas 8h</em></div></button><button><span className="blue"><CalendarDays/></span><div><b>4</b><small>Amanhã</small><em>já programadas</em></div></button></div>
    <article className="dc-card"><header><div><span className="dc-kicker">FILA DE REVISÃO</span><p>Ordenada por urgência e impacto</p></div><button onClick={()=>action("Todas as revisões abertas.")}>Ver todas</button></header><div className="dc-list">{reviewRows.map(([name,status,time])=><button key={name} onClick={()=>action(`Revisão aberta: ${name}.`)}><span className={status==="Atrasada"?"status danger":"status"}>{status}</span><div><b>{name}</b><small>{time}</small></div><ChevronRight/></button>)}</div></article>
  </Page>;
}

function SimulationsSection({ action }: { action: (text: string) => void }) {
  return <Page title="Simulados" subtitle="Provas completas, simulados personalizados e relatório pós-prova.">
    <div className="dc-grid3"><ActionCard title="Simulado Personalizado" text="Escolha matérias, quantidade e dificuldade." icon={<Sparkles/>} onClick={()=>action("Gerador de simulado aberto.")}/><ActionCard title="Simulados Oficiais" text="Provas no estilo PMPE para treinar pressão e tempo." icon={<FileText/>} onClick={()=>action("Simulados oficiais abertos.")}/><ActionCard title="Revisar Último Simulado" text="Volte aos seus erros e transforme falhas em revisão." icon={<RotateCcw/>} onClick={()=>action("Revisão do último simulado aberta.")}/></div>
    <div className="dc-two-col"><article className="dc-card dc-sim"><span className="dc-kicker">ÚLTIMO RESULTADO</span><div className="dc-score"><b>82%</b><span>41/50</span></div><Progress value={82}/><p>Você subiu 7 pontos percentuais em relação ao simulado anterior.</p><button onClick={()=>action("Relatório detalhado do simulado aberto.")}>Ver relatório completo</button></article><article className="dc-card"><span className="dc-kicker">PRÓXIMO DESAFIO</span><h2>Simulado PMPE • Domingo</h2><p>50 questões • 2h • todas as disciplinas</p><div className="dc-countdown"><span><b>02</b><small>dias</small></span><span><b>14</b><small>horas</small></span><span><b>36</b><small>min</small></span></div><button className="dc-gold-button" onClick={()=>action("Simulado agendado.")}>Preparar simulado</button></article></div>
  </Page>;
}

function PerformanceSection({ action }: { action: (text: string) => void }) {
  return <Page title="Desempenho" subtitle="Entenda sua evolução e descubra exatamente onde agir.">
    <div className="dc-two-col"><article className="dc-card dc-performance big"><span className="dc-kicker">APROVEITAMENTO GERAL</span><div className="dc-performance-body"><Donut value={78}/><div className="dc-legend"><span><i className="green"/> <b>78%</b> Acertos</span><span><i className="gold"/> <b>18%</b> Em revisão</span><span><i className="red"/> <b>4%</b> Erros</span></div></div><button className="dc-link-button" onClick={()=>action("Prévia detalhada de estatísticas disponível em /demo-estatisticas.")}>Abrir estatísticas detalhadas</button></article><article className="dc-card"><span className="dc-kicker">RESUMO DO PERÍODO</span><div className="dc-kpi-list"><span><b>32h 48min</b><small>tempo estudado</small></span><span><b>342</b><small>questões resolvidas</small></span><span><b>24</b><small>revisões concluídas</small></span><span><b>3</b><small>simulados realizados</small></span></div></article></div>
    <article className="dc-card"><header><div><span className="dc-kicker">MAPA DE DESEMPENHO</span><p>Forças e pontos de atenção</p></div><button onClick={()=>action("Filtros de desempenho abertos.")}>30 dias ▾</button></header><div className="dc-performance-subjects">{subjects.map(([name,value])=><button key={name} onClick={()=>action(`${name}: análise detalhada aberta.`)}><b>{name}</b><Progress value={value}/><span className={value>=80?"great":value<70?"warn":""}>{value}%</span></button>)}</div></article>
  </Page>;
}

function MaterialsSection({ action }: { action: (text: string) => void }) {
  const cards=[["PDFs e apostilas","48 materiais","📄"],["Resumos estratégicos","26 materiais","🧠"],["Mapas mentais","17 materiais","🗺️"],["Videoaulas","64 aulas","▶"],["Favoritos","12 itens","★"],["Downloads","8 recentes","⇩"]];
  return <Page title="Materiais" subtitle="Sua biblioteca organizada por tipo, disciplina e prioridade."><div className="dc-search-row"><Search size={18}/><input placeholder="Buscar material, assunto ou disciplina..."/><button onClick={()=>action("Filtro de materiais aberto.")}>Filtros</button></div><div className="dc-grid3">{cards.map(([title,count,icon])=><button className="dc-material-card" key={title} onClick={()=>action(`${title} aberto.`)}><span>{icon}</span><div><b>{title}</b><small>{count}</small></div><ChevronRight/></button>)}</div><article className="dc-card"><header><div><span className="dc-kicker">CONTINUE DE ONDE PAROU</span><p>Materiais recentes</p></div><button onClick={()=>action("Histórico de materiais aberto.")}>Ver histórico</button></header><div className="dc-list"><button><span className="doc">PDF</span><div><b>Direito Constitucional — Aula 04</b><small>62% lido • 18 páginas</small></div><ChevronRight/></button><button><span className="doc">MAPA</span><div><b>Princípios Fundamentais</b><small>Favoritado ontem</small></div><ChevronRight/></button><button><span className="doc">VÍDEO</span><div><b>Português — Conectivos</b><small>18:42 de 32:00</small></div><ChevronRight/></button></div></article></Page>;
}

function ScheduleSection({ action }: { action: (text: string) => void }) {
  const columns=[["SEG","Constitucional","60min"],["TER","Português","60min"],["QUA","Raciocínio Lógico","60min"],["QUI","Direitos Humanos","60min"],["SEX","Legislação PMPE","90min"],["SÁB","Revisões","90min"],["DOM","Simulado","120min"]];
  return <Page title="Cronograma" subtitle="Veja a semana, mova atividades e mantenha o plano vivo."><div className="dc-calendar-toolbar"><button onClick={()=>action("Semana anterior.")}>‹</button><div><b>07 — 13 de setembro</b><small>18h planejadas • 76% concluído</small></div><button onClick={()=>action("Próxima semana.")}>›</button></div><div className="dc-week-board">{columns.map(([day,subject,time],i)=><button key={day} className={i===4?"today":""} onClick={()=>action(`${day}: ${subject} aberto.`)}><span>{day}</span><b>{subject}</b><small>{time}</small><i>{i<4?"Concluído":i===4?"Hoje":"Planejado"}</i></button>)}</div><div className="dc-two-col"><article className="dc-card"><span className="dc-kicker">HOJE</span><h2>Legislação PMPE</h2><p>90 min • 30 questões • revisão curta no final</p><button className="dc-gold-button" onClick={()=>action("Sessão de hoje iniciada.")}>Começar sessão</button></article><article className="dc-card"><span className="dc-kicker">AJUSTE AUTOMÁTICO</span><h2>Você está 22 min adiantado</h2><p>O Studio Pro pode redistribuir esse tempo nas matérias com menor desempenho.</p><button onClick={()=>action("Sugestão automática aplicada na prévia.")}>Aplicar sugestão</button></article></div></Page>;
}

function MentorshipSection({ action }: { action: (text: string) => void }) {
  return <Page title="Mentoria" subtitle="Acompanhamento, orientações e visão do seu progresso."><div className="dc-two-col"><article className="dc-card dc-mentor"><span className="dc-kicker">SEU MENTOR</span><div className="dc-mentor-head"><span>PR</span><div><h2>Professor Renato</h2><p>Mentoria PMPE • acompanhamento ativo</p></div></div><div className="dc-message"><MessageSquareText size={20}/><p>“Seu avanço em Constitucional está excelente. Nesta semana quero foco em Raciocínio Lógico e na revisão dos erros do simulado.”</p></div><button className="dc-gold-button" onClick={()=>action("Canal da mentoria aberto.")}>Abrir acompanhamento</button></article><article className="dc-card"><span className="dc-kicker">CHECK-IN DA SEMANA</span><div className="dc-checklist"><label><input type="checkbox" defaultChecked/> Cumpriu 5 dias de estudo</label><label><input type="checkbox" defaultChecked/> Fez o simulado semanal</label><label><input type="checkbox"/> Zerou revisões atrasadas</label><label><input type="checkbox"/> Bateu 400 questões</label></div><button onClick={()=>action("Check-in enviado na prévia.")}>Enviar check-in</button></article></div><article className="dc-card"><header><div><span className="dc-kicker">PRÓXIMOS MARCOS</span><p>Metas definidas pela mentoria</p></div><button onClick={()=>action("Plano da mentoria aberto.")}>Ver plano</button></header><div className="dc-goal-cards"><div><b>400 questões</b><small>342 concluídas</small><Progress value={86}/></div><div><b>80% de acertos</b><small>78% atual</small><Progress value={97}/></div><div><b>20h semanais</b><small>18h10 realizadas</small><Progress value={91}/></div></div></article></Page>;
}

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <div className="dc-page"><div className="dc-page-title"><span className="dc-kicker">STUDIO PRO</span><h1>{title}</h1><p>{subtitle}</p></div>{children}</div>;
}

function ActionCard({ title, text, icon, onClick }: { title: string; text: string; icon: ReactNode; onClick: () => void }) {
  return <button className="dc-action-card" onClick={onClick}><span>{icon}</span><div><b>{title}</b><p>{text}</p></div><ChevronRight/></button>;
}

export default function DemoCompleto() {
  const [section, setSection] = useState<SectionId>("inicio");
  const [drawer, setDrawer] = useState(false);
  const [notice, setNotice] = useState("Laboratório premium completo — nenhuma alteração no site oficial.");
  const [notifications, setNotifications] = useState(false);

  const current = useMemo(() => navItems.find((item) => item.id === section) ?? navItems[0], [section]);

  function go(id: SectionId) {
    setSection(id);
    setDrawer(false);
    const item = navItems.find((entry) => entry.id === id);
    setNotice(`Prévia: ${item?.label ?? id} aberta.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function action(text: string) { setNotice(text); }

  const content = section === "inicio" ? <HomeSection action={action}/> :
    section === "plano" ? <PlanSection action={action}/> :
    section === "estudos" ? <StudiesSection action={action}/> :
    section === "questoes" ? <QuestionsSection action={action}/> :
    section === "revisoes" ? <ReviewsSection action={action}/> :
    section === "simulados" ? <SimulationsSection action={action}/> :
    section === "desempenho" ? <PerformanceSection action={action}/> :
    section === "materiais" ? <MaterialsSection action={action}/> :
    section === "cronograma" ? <ScheduleSection action={action}/> :
    <MentorshipSection action={action}/>;

  return (
    <div className="dc-shell">
      <aside className="dc-sidebar">
        <Logo/>
        <nav>{navItems.map((item)=>{const Icon=item.icon;return <button key={item.id} className={section===item.id?"active":""} onClick={()=>go(item.id)}><Icon size={19}/><span>{item.label}</span></button>})}</nav>
        <div className="dc-side-quote">“DISCIPLINA<br/>TRANSFORMA<br/>PLANOS EM<br/>REALIDADE.”<i/></div>
      </aside>

      <div className="dc-app">
        <header className="dc-topbar">
          <button className="dc-menu" onClick={()=>setDrawer(true)}><Menu size={21}/></button>
          <div className="dc-mobile-logo"><Logo/></div>
          <div className="dc-search"><Search size={18}/><input placeholder="Buscar conteúdos, aulas, questões..." onKeyDown={(e)=>e.key==="Enter"&&action(`Busca simulada: ${e.currentTarget.value}`)}/><kbd>Ctrl K</kbd></div>
          <div className="dc-top-actions"><button className="dc-bell" onClick={()=>setNotifications(!notifications)}><Bell size={19}/><i/></button><button className="dc-profile" onClick={()=>action("Perfil do aluno aberto na prévia.")}><span>L</span><div><b>Olá, Leandro!</b><small>Foco • Evolução • Aprovação</small></div><ChevronRight size={16}/></button></div>
          {notifications&&<div className="dc-notifications"><b>Notificações</b><p>5 revisões precisam da sua atenção.</p><p>Você ganhou +120 XP hoje.</p><p>Simulado PMPE disponível domingo.</p></div>}
        </header>
        <main className="dc-content">{content}</main>
      </div>

      <nav className="dc-bottom-nav"><button className={section==="inicio"?"active":""} onClick={()=>go("inicio")}><Home/><span>Início</span></button><button className={section==="estudos"?"active":""} onClick={()=>go("estudos")}><BookOpen/><span>Estudos</span></button><button className={section==="questoes"?"active":""} onClick={()=>go("questoes")}><ClipboardCheck/><span>Questões</span></button><button className={section==="revisoes"?"active":""} onClick={()=>go("revisoes")}><RotateCcw/><span>Revisões</span></button><button onClick={()=>setDrawer(true)}><MoreHorizontal/><span>Mais</span></button></nav>

      {drawer&&<div className="dc-drawer-backdrop" onClick={()=>setDrawer(false)}><aside className="dc-drawer" onClick={(e)=>e.stopPropagation()}><div className="dc-drawer-head"><Logo/><button onClick={()=>setDrawer(false)}><X/></button></div><nav>{navItems.map(item=>{const Icon=item.icon;return <button key={item.id} className={section===item.id?"active":""} onClick={()=>go(item.id)}><Icon/><span>{item.label}</span><ChevronRight/></button>})}</nav></aside></div>}

      <div className="dc-toast"><Sparkles size={14}/><span>{notice}</span><small>{current.label}</small></div>
    </div>
  );
}
