import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Clock3, FileQuestion, Flame, Pause, Play, RotateCcw, Sparkles, Target, Trophy } from 'lucide-react';
import { Calendar, Card, Donut, Logo, Metric, Progress, Tasks, WeeklyChart } from './DemoUI';
import { subjects } from './demoData';
import { useLab } from './demoState';

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function DemoDashboard() {
  const lab = useLab();
  const partialStudy = subjects.find(subject => (lab.studyParts[subject.id] ?? 0) > 0 && !lab.completedLessons.includes(subject.id));
  const activeSubject = subjects.find(subject => subject.id === lab.activeStudy);
  const nextStudy = activeSubject ?? partialStudy ?? subjects[4];
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!lab.activeStudy || !lab.studyStartedAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lab.activeStudy, lab.studyStartedAt]);
  const runningSeconds = lab.activeStudy && lab.studyStartedAt ? Math.max(0, Math.floor((now - lab.studyStartedAt) / 1000)) : 0;
  const activeElapsed = activeSubject ? (lab.studyElapsed[activeSubject.id] ?? 0) + runningSeconds : 0;
  const nextParts = lab.studyParts[nextStudy.id] ?? 0;
  const nextProgress = lab.completedLessons.includes(nextStudy.id) ? 100 : Math.round((nextParts / nextStudy.parts.length) * 100);

  return <div className="sp-dashboard"><div className="sp-dashboard-main">
    <div className="sp-greeting"><div><p>SEXTA-FEIRA, 11 DE SETEMBRO</p><h2>Bom te ver por aqui, Leandro <span>✦</span></h2></div><span className="sp-level"><Trophy size={14}/> Nível 12 <i/> 2.480 XP</span></div>
    {activeSubject && <section className={`sp-live-study ${lab.studyPaused ? 'paused' : 'running'}`}>
      <div className="sp-live-study-icon"><Clock3 size={20}/></div>
      <div className="sp-live-study-copy"><span>{lab.studyPaused ? 'ESTUDO PAUSADO' : 'ESTUDO EM ANDAMENTO'}</span><strong>{activeSubject.name} · {activeSubject.topic}</strong><small>{Math.min((lab.studyParts[activeSubject.id] ?? 0) + 1, activeSubject.parts.length)}ª parte de {activeSubject.parts.length}</small></div>
      <div className="sp-live-study-time"><strong>{formatElapsed(activeElapsed)}</strong><small>{lab.studyPaused ? 'tempo salvo' : 'cronômetro rodando'}</small></div>
      <div className="sp-live-study-actions">
        {lab.studyPaused ? <button className="sp-secondary" onClick={() => lab.startStudy(activeSubject.id)}><Play size={14}/>Retomar</button> : <button className="sp-secondary" onClick={() => lab.pauseStudy(activeSubject.id)}><Pause size={14}/>Pausar</button>}
        <button className="sp-primary" onClick={() => lab.open({ kind: 'lesson', subject: activeSubject })}>Abrir estudo<ArrowRight size={14}/></button>
      </div>
    </section>}
    <section className="sp-hero"><div className="sp-hero-copy"><span className="sp-eyebrow"><span className="sp-tiny-line"/> SUA APROVAÇÃO COMEÇA AQUI</span><h1>DISCIPLINA HOJE,<br/><em>APROVAÇÃO<br className="sp-desktop-break"/> AMANHÃ!</em></h1><p>Um passo de cada vez.<br/>Você está construindo a sua conquista.</p><button className="sp-primary" onClick={() => lab.open({ kind: 'lesson', subject: nextStudy })}><Play size={15} fill="currentColor"/>{nextParts > 0 ? 'Retomar estudo' : 'Continuar estudando'}<ArrowRight size={17}/></button></div><div className="sp-hero-art" aria-hidden="true"><div className="sp-orbit one"/><div className="sp-orbit two"/><span className="sp-art-label">FOCO · CONSTÂNCIA · EVOLUÇÃO</span><Logo large/><span className="sp-art-foot">PREPARAÇÃO DE ELITE <i/> PMPE</span><div className="sp-art-grid"/></div></section>
    <div className="sp-mobile-mission"><Target size={21}/><div><span>MISSÃO DO DIA</span><b>20 questões. Um passo mais perto.</b></div><button className="sp-icon-button" aria-label="Abrir missão do dia" onClick={() => lab.go('questoes')}><ArrowRight size={18}/></button></div>
    <div className="sp-metrics four"><Metric icon={<Flame/>} label="Sequência" value="12 dias" hint="Sua melhor sequência!" tone="gold" onClick={() => lab.go('cronograma')}/><Metric icon={<Clock3/>} label="Tempo estudado" value="3h 28min" hint="+42 min em relação a ontem" onClick={() => lab.go('estatisticas')}/><Metric icon={<Target/>} label="Desempenho" value="78%" hint="↑ 12 p.p. de evolução" tone="steel" onClick={() => lab.go('desempenho')}/><Metric icon={<FileQuestion/>} label="Questões resolvidas" value={String(342 + Object.keys(lab.answers).length)} hint="Sua prática vira resultado" onClick={() => lab.go('questoes')}/></div>
    <div className="sp-home-chart"><WeeklyChart/></div>
    <Card title="Desempenho geral" subtitle="Seu esforço, traduzido em evolução." className="sp-home-performance" action={<button className="sp-text-button" onClick={() => lab.go('desempenho')}>Ver detalhes <ArrowUpRight size={15}/></button>}><div className="sp-performance-wide"><Donut/><div className="sp-performance-message"><span className="sp-icon gold"><Sparkles size={20}/></span><h3>Você está no caminho certo.</h3><p>Seu aproveitamento cresceu <strong>12 pontos percentuais</strong> em relação ao último mês.</p><span className="sp-success"><ArrowUpRight size={14}/> Continue com essa constância</span></div></div></Card>
    <Card title={lab.completedLessons.includes(nextStudy.id) ? "Seu último estudo" : nextParts > 0 ? "Estudo para retomar" : "Próximo estudo"} action={<span className="sp-pill">{lab.completedLessons.includes(nextStudy.id) ? "CONCLUÍDO" : lab.activeStudy === nextStudy.id ? (lab.studyPaused ? "PAUSADO" : "EM ANDAMENTO") : nextParts > 0 ? "EM ABERTO" : "RETOMAR"}</span>} className="sp-home-lesson"><button className="sp-lesson-card" onClick={() => lab.open({ kind: 'lesson', subject: nextStudy })}><span className="sp-lesson-cover"><BookOpen size={34}/><i><Play size={12} fill="currentColor"/></i></span><span className="sp-lesson-description"><small>{nextStudy.name.toUpperCase()}</small><strong>{nextStudy.topic}</strong><span>{nextParts > 0 && nextParts < nextStudy.parts.length ? `Retomar na parte ${nextParts + 1} de ${nextStudy.parts.length}` : `Conteúdo ${nextStudy.completed + 1} de ${nextStudy.lessons}`}</span><Progress value={nextProgress || nextStudy.progress}/></span><ArrowRight size={20}/></button></Card>
    <Card title="Minhas disciplinas" subtitle="Conhecimento que se transforma em resultado." action={<button className="sp-text-button" onClick={() => lab.go('estudos')}>Ver todas <ArrowRight size={14}/></button>} className="sp-home-subjects"><div className="sp-subject-grid">{subjects.slice(0, 4).map(subject => <button className="sp-subject-mini" key={subject.id} onClick={() => lab.open({ kind: 'subject', subject })}><span className={`sp-subject-symbol ${subject.color}`}>{subject.short}</span><span><b>{subject.name}</b><small>{subject.completed + Number(lab.completedLessons.includes(subject.id))}/{subject.lessons} conteúdos concluídos</small><Progress value={Math.round((subject.completed + Number(lab.completedLessons.includes(subject.id))) / subject.lessons * 100)}/></span><strong>{Math.round((subject.completed + Number(lab.completedLessons.includes(subject.id))) / subject.lessons * 100)}%</strong></button>)}</div></Card>
    <div className="sp-shortcuts">{[{ title: 'Resolver questões', text: 'Pratique o que aprendeu', icon: FileQuestion, route: 'questoes' }, { title: 'Revisar conteúdos', text: 'Fortaleça sua memória', icon: RotateCcw, route: 'revisoes' }, { title: 'Meu planejamento', text: 'Seu próximo passo', icon: CalendarDays, route: 'plano' }].map(item => <button key={item.route} onClick={() => lab.go(item.route)}><item.icon size={19}/><span><b>{item.title}</b><small>{item.text}</small></span><ArrowUpRight size={16}/></button>)}</div>
  </div><aside className="sp-right-rail"><Card title="Seu calendário" action={<CalendarDays size={17}/>}><Calendar selected={lab.selectedDate} onSelect={lab.selectDate} tasks={lab.tasks}/><Tasks tasks={lab.tasks} date={lab.selectedDate} toggle={lab.toggleTask} add={() => lab.open({ kind: 'task' })}/><button className="sp-secondary full" onClick={() => lab.go('cronograma')}>Ver meu cronograma<ArrowRight size={15}/></button></Card><Card className="sp-week-goal"><span className="sp-eyebrow"><Target size={15}/> META DA SEMANA</span><h3>Consistência é poder.</h3><p><strong>18h 10min</strong> de {lab.goal}h planejadas</p><Progress value={Math.min(100, Math.round(18.17 / lab.goal * 100))}/><div><span>{Math.min(100, Math.round(18.17 / lab.goal * 100))}% concluído</span><button className="sp-text-button" onClick={() => lab.go('plano')}>Ver plano<ArrowUpRight size={14}/></button></div></Card><section className="sp-quote"><BookOpen size={22}/><p>“A conquista de amanhã<br/>é a soma dos seus<br/><em>esforços de hoje.</em>”</p><span>CONTINUE. VOCÊ É CAPAZ.</span></section></aside></div>;
}
