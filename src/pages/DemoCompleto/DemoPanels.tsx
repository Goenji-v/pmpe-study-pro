import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Check, Clock3, Download, ExternalLink, FileQuestion, Pause, Play, Search, Star, Target, Trophy } from 'lucide-react';
import { Card, Donut, Modal, Progress } from './DemoUI';
import { materials, normalize, questions, reviewItems, subjects, type DemoQuestion, type Subject } from './demoData';
import { useLab, type Panel } from './demoState';

function plannedMinutes(subject: Subject) {
  return subject.id === 'logica' ? 40 : subject.id === 'constitucional' ? 28 : 30;
}
function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
function Lesson({ subject }: { subject: Subject }) {
  const lab = useLab();
  const [showFinish, setShowFinish] = useState(false);
  const done = lab.completedLessons.includes(subject.id);
  const active = lab.activeStudy === subject.id;
  const paused = active && lab.studyPaused;
  const totalParts = subject.parts.length;
  const completedParts = done ? totalParts : Math.min(totalParts, lab.studyParts[subject.id] ?? 0);
  const baseElapsed = lab.studyElapsed[subject.id] ?? 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active || !lab.studyStartedAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, lab.studyStartedAt]);
  const liveElapsed = active && lab.studyStartedAt ? Math.max(0, Math.floor((now - lab.studyStartedAt) / 1000)) : 0;
  const elapsed = baseElapsed + liveElapsed;
  const progress = done ? 100 : Math.round((completedParts / totalParts) * 100);
  const nextPart = Math.min(completedParts + 1, totalParts);
  return <>
    <div className="sp-section-line"><span className="sp-pill">ESTUDO DE HOJE</span><span className="sp-pill">{plannedMinutes(subject)} MIN PLANEJADOS</span></div>
    <Card title="Sua próxima missão" subtitle={subject.name} action={<div className={`sp-mission-clock ${active ? paused ? 'paused' : 'running' : ''}`}><Clock3 size={17}/><span><strong>{formatElapsed(elapsed)}</strong><small>{done ? 'finalizado' : active ? paused ? 'pausado' : 'em andamento' : elapsed > 0 ? 'tempo acumulado' : 'cronômetro'}</small></span></div>}>
      <div className="sp-subject-detail"><span className={`sp-subject-symbol ${subject.color}`}>{subject.short}</span><h3>{subject.topic}</h3><p>O Studio Pro organiza a rota e acompanha o tempo. A aula e as questões abrem nos links que o professor cadastrou.</p></div>
      <div className="sp-study-progress-line"><span>{done ? 'Assunto concluído' : completedParts > 0 ? `${completedParts} de ${totalParts} partes concluídas` : `Comece pela parte 1 de ${totalParts}`}</span><strong>{progress}%</strong></div>
      <Progress value={progress}/>
    </Card>

    <Card title="Links cadastrados pelo professor" subtitle="Simulação de como ficará quando o professor salvar os acessos.">
      <div className="sp-external-links">
        <a className="sp-external-link" href={subject.lessonUrl} target="_blank" rel="noreferrer"><span className="sp-external-link-icon"><Play size={18}/></span><span><b>Abrir aula no YouTube</b><small>Link do curso / videoaula</small></span><ExternalLink size={16}/></a>
        <a className="sp-external-link" href={subject.questionsUrl} target="_blank" rel="noreferrer"><span className="sp-external-link-icon"><FileQuestion size={18}/></span><span><b>Abrir questões</b><small>Link do banco de questões</small></span><ExternalLink size={16}/></a>
      </div>
    </Card>

    <Card title="Progresso deste assunto" subtitle={done ? 'Todas as partes concluídas.' : completedParts > 0 ? `Você vai retomar na parte ${nextPart}.` : 'Marque as partes conforme avançar nas aulas.'}>
      <div className="sp-study-parts">
        {subject.parts.map((part, index) => {
          const partDone = index < completedParts;
          const current = !done && index === completedParts;
          return <div className={`sp-study-part ${partDone ? 'done' : current ? 'current' : ''}`} key={part}><span>{partDone ? <Check size={14}/> : index + 1}</span><div><b>{part}</b><small>{partDone ? 'Concluída' : current ? 'Próxima para estudar' : 'Aguardando'}</small></div></div>;
        })}
      </div>
      {!done && completedParts < totalParts && <button className="sp-secondary full" onClick={() => lab.advanceStudyPart(subject.id, totalParts)}><Check size={16}/>Marcar parte {completedParts + 1} como concluída</button>}
    </Card>

    {!done && <div className="sp-study-controls">
      <button className="sp-primary" disabled={active && !paused} onClick={() => lab.startStudy(subject.id)}><Play size={16}/>{active ? paused ? 'Retomar cronômetro' : 'Estudo em andamento' : completedParts > 0 || elapsed > 0 ? 'Retomar estudo' : 'Iniciar estudo'}</button>
      {active && !paused && <button className="sp-secondary" onClick={() => lab.pauseStudy(subject.id)}><Pause size={16}/>Pausar</button>}
      <button className="sp-secondary" onClick={() => lab.skipStudy(subject.id)}>Pular e reorganizar</button>
    </div>}

    {!done && <button className="sp-primary full sp-finish-study" onClick={() => setShowFinish(value => !value)}><Check size={17}/>Finalizar estudo</button>}
    {showFinish && !done && <div className="sp-finish-choice">
      <div><strong>Você terminou todo o assunto?</strong><p>{completedParts < totalParts ? `Você marcou ${completedParts} de ${totalParts} partes. Se parar por hoje, o Studio Pro mantém este assunto em aberto e depois mostra “Retomar na parte ${nextPart}”.` : 'Todas as partes foram marcadas. Você pode concluir o assunto agora.'}</p></div>
      <div className="sp-finish-choice-actions">
        <button className="sp-secondary" onClick={() => lab.finishStudy(subject.id, false)}>Encerrar por hoje · falta terminar</button>
        <button className="sp-primary" onClick={() => lab.finishStudy(subject.id, true)}>Concluir assunto</button>
      </div>
    </div>}
    {done && <div className="sp-insight"><Check size={20}/><p><strong>Assunto concluído.</strong><br/>O tempo estudado e as partes finalizadas ficaram registrados nesta demonstração.</p></div>}
  </>;
}

function Quiz({ items, simulation }: { items: DemoQuestion[]; simulation?: boolean }) {
  const lab = useLab();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const q = items[index];
  if (finished) {
    const correct = results.filter(Boolean).length;
    return <div className="sp-quiz-result"><span className="sp-icon gold"><Trophy size={28}/></span><h3>{simulation ? 'Simulado concluído!' : 'Sessão concluída!'}</h3><Donut value={Math.round(correct / items.length * 100)} review={0}/><p>Você acertou <strong>{correct} de {items.length}</strong> questões.</p><div className="sp-result-answers">{items.map((item, i) => <div key={item.id}><b>{results[i] ? '✓' : '↻'} Questão {i + 1} · {item.subject}</b><p>{item.explanation}</p></div>)}</div><button className="sp-primary" onClick={() => { lab.close(); lab.go('questoes'); }}>Voltar à central de questões<ArrowRight size={16}/></button></div>;
  }
  return <><div className="sp-section-line"><span className="sp-pill">QUESTÃO {index + 1} DE {items.length}</span><button className={`sp-icon-button ${lab.favorites.includes(q.id) ? 'favorited' : ''}`} aria-label="Favoritar questão atual" aria-pressed={lab.favorites.includes(q.id)} onClick={() => lab.toggleFavorite(q.id)}><Star size={19} fill={lab.favorites.includes(q.id) ? 'currentColor' : 'none'}/></button></div><Progress value={(index / items.length) * 100}/><p className="sp-muted">{q.subject} · {q.topic} · {q.board}</p><h3 className="sp-question-title">{q.text}</h3><div className="sp-options" role="radiogroup" aria-label="Alternativas">{q.options.map((option, i) => <button role="radio" aria-checked={selected === i} key={option} disabled={confirmed} className={`${selected === i ? 'selected' : ''} ${confirmed && i === q.answer ? 'correct' : ''} ${confirmed && selected === i && i !== q.answer ? 'incorrect' : ''}`} onClick={() => setSelected(i)}><span>{'ABCD'[i]}</span>{option}</button>)}</div>{confirmed && <div className={`sp-answer-feedback ${selected === q.answer ? 'correct' : 'incorrect'}`}><b>{selected === q.answer ? 'Resposta correta!' : `Vamos revisar. A resposta é ${'ABCD'[q.answer]}.`}</b><p>{q.explanation}</p></div>}<button className="sp-primary full" disabled={selected === null} onClick={() => { if (!confirmed) { const correct = selected === q.answer; setConfirmed(true); setResults(old => [...old, correct]); lab.answer(q.id, correct); } else if (index === items.length - 1) { setFinished(true); } else { setIndex(index + 1); setSelected(null); setConfirmed(false); } }}>{!confirmed ? 'Confirmar resposta' : index === items.length - 1 ? 'Ver resultado' : 'Próxima questão'}<ArrowRight size={16}/></button></>;
}

function TaskForm() {
  const lab = useLab();
  return <form className="sp-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); lab.addTask({ id: crypto.randomUUID(), title: String(data.get('title')).trim(), subject: String(data.get('subject')), date: String(data.get('date')), time: String(data.get('time')), done: false }); lab.close(); lab.notify('Tarefa adicionada ao seu cronograma de demonstração.'); }}><label className="sp-field"><span>O que você vai estudar?</span><input name="title" placeholder="Ex.: revisar minhas anotações" required maxLength={100} pattern=".*\S.*"/></label><label className="sp-field"><span>Disciplina</span><select name="subject">{subjects.map(s => <option key={s.id}>{s.name}</option>)}</select></label><div className="sp-grid two"><label className="sp-field"><span>Data</span><input type="date" name="date" defaultValue={lab.selectedDate} required/></label><label className="sp-field"><span>Horário</span><input type="time" name="time" defaultValue="19:00" required/></label></div><button type="submit" className="sp-primary">Adicionar ao cronograma<Check size={16}/></button></form>;
}
function PlanForm() {
  const lab = useLab();
  const [goal, setGoal] = useState(lab.goal);
  return <form className="sp-form" onSubmit={event => { event.preventDefault(); lab.setGoal(goal); lab.close(); lab.notify(`Meta atualizada para ${goal} horas semanais.`); }}><p>Escolha uma carga possível para sua rotina. A meta será refletida no plano e no início.</p><label className="sp-field"><span>Horas por semana</span><input type="number" min={1} max={80} required value={goal} onChange={event => setGoal(Number(event.target.value))}/></label><div className="sp-insight"><Target size={20}/><p>Distribuindo em 6 dias: aproximadamente {Math.round(goal / 6 * 60)} minutos por dia.</p></div><button className="sp-primary" type="submit">Salvar meta<Check size={16}/></button></form>;
}
function SearchPanel() {
  const lab = useLab();
  const [query, setQuery] = useState('');
  const resultSubjects = subjects.filter(s => normalize(`${s.name} ${s.topic}`).includes(normalize(query)));
  const resultMaterials = materials.filter(m => normalize(`${m.title} ${m.subject}`).includes(normalize(query)));
  return <><label className="sp-search-field"><Search size={18}/><input autoFocus aria-label="Pesquisar na demonstração" placeholder="Disciplina, conteúdo ou material…" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="sp-search-results"><span className="sp-eyebrow">DISCIPLINAS E CONTEÚDOS</span>{resultSubjects.map(s => <button className="sp-list-row" key={s.id} onClick={() => lab.open({ kind: 'subject', subject: s })}><BookOpen size={18}/><span><b>{s.name}</b><small>{s.topic}</small></span><ArrowRight size={16}/></button>)}<span className="sp-eyebrow">MATERIAIS</span>{resultMaterials.map(m => <button className="sp-list-row" key={m.id} onClick={() => lab.open({ kind: 'material', material: m })}><FileQuestion size={18}/><span><b>{m.title}</b><small>{m.type}</small></span><ArrowRight size={16}/></button>)}{!resultSubjects.length && !resultMaterials.length && <div className="sp-empty">Nenhum resultado para “{query}”. Tente Português ou revisão.</div>}</div></>;
}
export default function DemoPanels({ panel }: { panel: Panel }) {
  const lab = useLab();
  if (panel.kind === 'lesson') return <Modal title={panel.subject.name} close={lab.close} wide><Lesson subject={panel.subject}/></Modal>;
  if (panel.kind === 'quiz') return <Modal title={panel.simulation ? 'Simulado de demonstração' : 'Sessão de questões'} close={lab.close} wide><Quiz items={panel.items} simulation={panel.simulation}/></Modal>;
  if (panel.kind === 'task') return <Modal title="Nova tarefa" close={lab.close}><TaskForm/></Modal>;
  if (panel.kind === 'plan') return <Modal title="Sua meta de estudo" close={lab.close}><PlanForm/></Modal>;
  if (panel.kind === 'search') return <Modal title="O que vamos encontrar hoje?" close={lab.close} wide><SearchPanel/></Modal>;
  if (panel.kind === 'subject') return <Modal title={panel.subject.name} close={lab.close}><div className="sp-subject-detail"><span className={`sp-subject-symbol ${panel.subject.color}`}>{panel.subject.short}</span><p>{panel.subject.completed + Number(lab.completedLessons.includes(panel.subject.id))} de {panel.subject.lessons} conteúdos concluídos · {panel.subject.review} revisões pendentes</p><Progress value={Math.round((panel.subject.completed + Number(lab.completedLessons.includes(panel.subject.id))) / panel.subject.lessons * 100)}/><Card title="Seu próximo passo"><h3>{panel.subject.topic}</h3><p>{(lab.studyParts[panel.subject.id] ?? 0) > 0 ? `Retome na parte ${Math.min((lab.studyParts[panel.subject.id] ?? 0) + 1, panel.subject.parts.length)} de ${panel.subject.parts.length}.` : 'Retome sua preparação de onde parou.'}</p><button className="sp-primary" onClick={() => lab.open({ kind: 'lesson', subject: panel.subject })}><Play size={16}/>Continuar estudo</button></Card><button className="sp-secondary full" onClick={() => { lab.close(); lab.go('revisoes'); }}>Ver minhas revisões<ArrowRight size={16}/></button></div></Modal>;
  if (panel.kind === 'material') return <Modal title={panel.material.title} close={lab.close} wide><span className="sp-pill">{panel.material.type} · AMOSTRA</span>{panel.material.type === 'Mapas mentais' && <div className="sp-map">{['Planejar', 'Estudar', 'Praticar', 'Revisar'].map((name, i) => <span key={name}><b>0{i + 1}</b>{name}</span>)}</div>}<div className="sp-reader sp-material-reader">{panel.material.body.split('\n\n').map((p, i) => i === 0 ? <h3 key={i}>{p}</h3> : <p key={i}>{p}</p>)}</div><button className="sp-primary" onClick={() => lab.download(panel.material)}><Download size={16}/>Baixar {panel.material.type === 'PDFs' ? 'amostra PDF' : 'roteiro em texto'}</button></Modal>;
  if (panel.kind === 'review') {
    const item = reviewItems.find(r => r.id === panel.id)!;
    const done = lab.completedReviews.includes(item.id);
    return <Modal title={item.title} close={lab.close}><span className="sp-pill">{item.subject} · {item.minutes} min</span><div className="sp-reader"><h3>Revisão ativa em três passos</h3><ol><li>Sem consultar, escreva o que você lembra sobre {item.title.toLowerCase()}.</li><li>Compare suas anotações com seu material de estudo.</li><li>Registre uma dúvida e uma ideia que você já domina.</li></ol><label className="sp-field"><span>O que preciso reforçar?</span><textarea rows={4} placeholder="Anote os pontos para a próxima revisão…" value={lab.notes["review:" + item.id] ?? ""} onChange={e => lab.setNote("review:" + item.id, e.target.value)}/></label></div><button className="sp-primary full" disabled={done} onClick={() => lab.completeReview(item.id)}><Check size={17}/>{done ? 'Revisão concluída' : 'Concluir revisão'}</button></Modal>;
  }
  if (panel.kind === 'profile') return <Modal title="Seu perfil" close={lab.close}><div className="sp-profile-detail"><span className="sp-avatar">L</span><h3>Leandro</h3><p>Concurseiro PMPE · Nível 12</p><span className="sp-pill">PERFIL DEMONSTRATIVO</span></div><div className="sp-profile-stats"><span><b>12</b>dias de constância</span><span><b>2.480</b>XP conquistados</span></div><button className="sp-secondary full" onClick={() => { lab.close(); lab.go('plano'); }}>Ver meu plano<ArrowRight size={16}/></button></Modal>;
  if (panel.kind === 'notifications') return <Modal title="Notificações" close={lab.close}><div className="sp-list">{[{ title: 'É hora de consolidar seu conhecimento', sub: `${reviewItems.length - lab.completedReviews.length} revisões aguardam você.`, page: 'revisoes' }, { title: 'Seu próximo desafio está pronto', sub: 'Experimente o simulado de demonstração.', page: 'simulados' }, { title: 'Uma orientação para a sua semana', sub: 'Veja o recado do professor Renato.', page: 'mentoria' }].map(n => <button className="sp-list-row" key={n.title} onClick={() => { lab.close(); lab.go(n.page); }}><span className="sp-notification-dot"/><span><b>{n.title}</b><small>{n.sub}</small></span><ArrowRight size={16}/></button>)}</div></Modal>;
  if (panel.kind === 'result') return <Modal title={panel.title} close={lab.close}><Donut value={panel.score} review={0}/><p>Resultado histórico demonstrativo. Aproveitamento de {panel.score}%.</p><Card title="Seu próximo foco"><p>Reforce sequências numéricas e conectivos. Revise cada erro antes de começar um novo simulado.</p></Card><button className="sp-primary full" onClick={() => lab.open({ kind: 'quiz', items: questions.slice(0, 2) })}>Revisar erros · amostra<ArrowRight size={16}/></button></Modal>;
  return <Modal title="Acompanhamento com Renato" close={lab.close}><div className="sp-mentor-note"><span className="sp-pill">ORIENTAÇÃO DA SEMANA</span><h3>Vamos fortalecer sua base.</h3><p>Seu avanço está consistente. Priorize Raciocínio Lógico, mantenha as revisões e reserve o domingo para um simulado.</p><ul><li>Praticar sequências numéricas por 20 minutos.</li><li>Revisar as respostas incorretas.</li><li>Fazer um check-in ao final da semana.</li></ul></div><Card title="Próximo encontro"><p>14 de setembro · 19h · encontro demonstrativo</p></Card><button className="sp-primary" onClick={() => { lab.close(); lab.go('plano'); }}>Ver minha rota de estudo<ArrowRight size={16}/></button></Modal>;
}
