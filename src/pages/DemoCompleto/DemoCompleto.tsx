import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Bell, BookOpen, CalendarDays, Check, ChevronRight, ClipboardCheck, FileText, FolderOpen, Home, Menu, MoreHorizontal, RotateCcw, Search, Target, TrendingUp, UsersRound } from 'lucide-react';
import DemoDashboard from './DemoDashboard';
import { MaterialsPage, MentorshipPage, PerformancePage, PlanPage, QuestionsPage, ReviewsPage, SchedulePage, SimulationsPage, StudiesPage } from './DemoPages';
import DemoPanels from './DemoPanels';
import { Logo, Modal } from './DemoUI';
import { initialTasks, type DemoMaterial } from './demoData';
import { LabContext, type LabState, type Panel } from './demoState';
import './DemoCompleto.css';

const navigation = [
  { id: 'inicio', title: 'Início', icon: Home }, { id: 'plano', title: 'Meu Plano', icon: Target },
  { id: 'estudos', title: 'Estudos', icon: BookOpen }, { id: 'questoes', title: 'Questões', icon: ClipboardCheck },
  { id: 'revisoes', title: 'Revisões', icon: RotateCcw }, { id: 'simulados', title: 'Simulados', icon: FileText },
  { id: 'desempenho', title: 'Desempenho', icon: TrendingUp }, { id: 'estatisticas', title: 'Estatísticas', icon: BarChart3 },
  { id: 'materiais', title: 'Materiais', icon: FolderOpen }, { id: 'cronograma', title: 'Cronograma', icon: CalendarDays },
  { id: 'mentoria', title: 'Mentoria', icon: UsersRound },
];
const url = (page: string) => page === 'inicio' ? '/demo' : `/demo/${page}`;

// Printable ASCII keeps PDF object offsets equal to the encoded byte lengths.
function samplePdf(material: DemoMaterial) {
  const lines = material.body.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e\n]/g, '').split('\n').flatMap(line => line.match(/.{1,78}(?:\s|$)|.{1,78}/g) || ['']);
  const stream = `BT /F1 12 Tf 50 785 Td 17 TL ${lines.map((line, i) => `${i ? 'T* ' : ''}(${line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj`).join('\n')} ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export default function DemoCompleto() {
  const location = useLocation();
  const navigate = useNavigate();
  const raw = location.pathname.replace(/^\/demo(?:-completo)?\/?/, '').replace(/^-/, '').replace(/\/$/, '');
  const page = raw || 'inicio';
  const current = navigation.find(item => item.id === page);
  const [drawer, setDrawer] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedDate, selectDate] = useState('2026-09-11');
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [completedReviews, setCompletedReviews] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [goal, setGoal] = useState(24);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = useCallback(() => setPanel(null), []);
  const notify = (text: string) => { setNotice(text); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 4200); };
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  useEffect(() => { document.title = `Studio Pro Beta · ${current?.title ?? 'Demonstração'} · Preview`; window.scrollTo(0, 0); }, [location.pathname, current?.title]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPanel({ kind: 'search' }); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  function go(id: string) { setDrawer(false); setPanel(null); navigate(url(id)); }
  function download(material: DemoMaterial) {
    const blob = material.type === 'PDFs' ? samplePdf(material) : new Blob([material.body], { type: 'text/plain;charset=utf-8' });
    const address = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = address; anchor.download = `studio-pro-${material.id}.${material.type === 'PDFs' ? 'pdf' : 'txt'}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(address), 1000);
    setDownloads(old => old.includes(material.id) ? old : [...old, material.id]); notify('Amostra baixada. Ela também está na aba Downloads.');
  }
  const lab: LabState = { tasks, selectedDate, selectDate, completedLessons, completedReviews, favorites, downloads, answers, goal, setGoal, open: setPanel, close, go, notify, download,
    notes, setNote: (id, text) => setNotes(old => ({ ...old, [id]: text })),
    toggleTask: id => setTasks(old => old.map(task => task.id === id ? { ...task, done: !task.done } : task)),
    addTask: task => { setTasks(old => [...old, task]); selectDate(task.date); },
    completeLesson: id => { setCompletedLessons(old => old.includes(id) ? old : [...old, id]); notify('Aula concluída! Seu progresso foi atualizado na demonstração.'); },
    completeReview: id => { setCompletedReviews(old => old.includes(id) ? old : [...old, id]); notify('Revisão concluída. Mais um passo na sua preparação.'); },
    toggleFavorite: id => setFavorites(old => old.includes(id) ? old.filter(item => item !== id) : [...old, id]),
    answer: (id, correct) => setAnswers(old => ({ ...old, [id]: correct })),
  };
  const content = page === 'inicio' ? <DemoDashboard/> : page === 'plano' ? <PlanPage/> : page === 'estudos' ? <StudiesPage/> : page === 'questoes' ? <QuestionsPage/> : page === 'revisoes' ? <ReviewsPage/> : page === 'simulados' ? <SimulationsPage/> : page === 'desempenho' ? <PerformancePage/> : page === 'estatisticas' ? <PerformancePage statistics/> : page === 'materiais' ? <MaterialsPage/> : page === 'cronograma' ? <SchedulePage/> : page === 'mentoria' ? <MentorshipPage/> : <div className="sp-empty"><h1>Página não encontrada</h1><p>Continue explorando o laboratório Studio Pro.</p><button className="sp-primary" onClick={() => go('inicio')}>Voltar ao início</button></div>;
  const nav = <nav aria-label="Navegação principal">{navigation.map((item, index) => <div key={item.id}>{index === 2 && <span className="sp-nav-group">SUA PREPARAÇÃO</span>}{index === 6 && <span className="sp-nav-group">SUA EVOLUÇÃO</span>}<NavLink to={url(item.id)} end className={() => page === item.id ? 'active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => setDrawer(false)}><item.icon size={18}/><span>{item.title}</span>{item.id === 'revisoes' && <small>{5 - completedReviews.length}</small>}{page === item.id && <i/>}</NavLink></div>)}</nav>;
  return <LabContext.Provider value={lab}><div className="sp-shell"><a className="sp-skip" href="#demo-content">Pular para o conteúdo</a><aside className="sp-sidebar"><Logo/><div className="sp-workspace"><span>PREPARAÇÃO PMPE</span><small>Soldado · Polícia Militar</small></div>{nav}<div className="sp-sidebar-bottom"><span className="sp-pill">LABORATÓRIO VISUAL</span><p>Estudo hoje.<br/><strong>Conquista sempre.</strong></p><div className="sp-side-account"><span className="sp-avatar">L</span><div><b>Leandro</b><small>Plano de demonstração</small></div><button className="sp-icon-button" aria-label="Abrir perfil" onClick={() => setPanel({ kind: 'profile' })}><ChevronRight size={17}/></button></div></div></aside><div className="sp-app"><header className="sp-topbar"><div className="sp-breadcrumb">Minha preparação<ChevronRight size={14}/><strong>{current?.title ?? 'Preview'}</strong></div><div className="sp-mobile-brand"><Logo/></div><button className="sp-top-search" aria-label="Buscar no Studio Pro" onClick={() => setPanel({ kind: 'search' })}><Search size={17}/><span>Buscar no Studio Pro</span><kbd>Ctrl K</kbd></button><div className="sp-top-actions"><span className="sp-preview-label">PREVIEW</span><button className="sp-icon-button sp-bell" aria-label="Abrir notificações" onClick={() => setPanel({ kind: 'notifications' })}><Bell size={19}/><i/></button><button className="sp-avatar" aria-label="Abrir perfil do aluno" onClick={() => setPanel({ kind: 'profile' })}>L</button><button className="sp-icon-button sp-menu-button" aria-label="Abrir menu" onClick={() => setDrawer(true)}><Menu size={20}/></button></div></header><main id="demo-content" tabIndex={-1} className={`sp-content ${page === 'inicio' ? 'home' : ''}`} key={page}>{content}<footer className="sp-page-footer"><span>STUDIO PRO <i/> ESTUDO HOJE. CONQUISTA SEMPRE.</span><small>Ambiente demonstrativo · dados fictícios</small></footer></main></div><nav className="sp-bottom-nav" aria-label="Navegação mobile">{navigation.filter(item => ['inicio', 'estudos', 'questoes', 'revisoes'].includes(item.id)).map(item => <NavLink key={item.id} end to={url(item.id)} className={() => page === item.id ? 'active' : ''}><item.icon size={20}/><span>{item.title}</span></NavLink>)}<button className={['inicio', 'estudos', 'questoes', 'revisoes'].includes(page) ? '' : 'active'} onClick={() => setDrawer(true)}><MoreHorizontal size={20}/><span>Mais</span></button></nav>{drawer && <Modal title="Explore o Studio Pro" close={() => setDrawer(false)}><div className="sp-drawer-nav">{nav}</div></Modal>}{panel && <DemoPanels key={panel.kind + ('subject' in panel ? panel.subject.id : '') + ('id' in panel ? panel.id : '')} panel={panel}/>}<div className={`sp-toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice && <><Check size={17}/><span>{notice}</span></>}</div></div></LabContext.Provider>;
}
