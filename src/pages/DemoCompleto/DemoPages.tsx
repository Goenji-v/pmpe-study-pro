import { useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, CheckCheck, Clock3, Download, FileQuestion, FileText, Flag, Layers, MessageSquare, Play, Plus, RotateCcw, Search, Star, Target, TrendingUp, Trophy } from 'lucide-react';
import { Calendar, Card, Donut, EvolutionChart, Metric, Modal, PageTitle, Progress, Select, Tabs, Tasks } from './DemoUI';
import { materials, normalize, questions, reviewItems, subjects } from './demoData';
import { useLab } from './demoState';

export function PlanPage() {
  const lab = useLab();
  return <><PageTitle title="Meu Plano" subtitle="Uma direção clara. Pequenos passos. Grandes conquistas." action={<button className="sp-primary" onClick={() => lab.open({ kind: 'plan' })}><Target size={17}/>Ajustar meta</button>}/><div className="sp-metrics four"><Metric icon={<Target/>} value={`${lab.goal}h`} label="Meta semanal" tone="gold"/><Metric icon={<Clock3/>} value="18h 10min" label="Horas realizadas" hint="Você está avançando"/><Metric icon={<BookOpen/>} value="6" label="Disciplinas no plano"/><Metric icon={<CheckCheck/>} value={`${lab.tasks.filter(t => t.done).length}/${lab.tasks.length}`} label="Atividades concluídas"/></div><div className="sp-grid two"><Card title="Seu plano, seu ritmo" subtitle="Ciclo de preparação · PMPE" className="sp-plan-feature"><span className="sp-pill">META DA SEMANA</span><strong className="sp-huge">{Math.min(100, Math.round(18.17 / lab.goal * 100))}<small>%</small></strong><Progress value={Math.min(100, Math.round(18.17 / lab.goal * 100))}/><p>Faltam {Math.max(0, lab.goal - 18.17).toFixed(1).replace('.', ',')} horas para alcançar sua meta.</p><button className="sp-secondary" onClick={() => lab.go('estudos')}>Continuar minha preparação<ArrowRight size={16}/></button></Card><Card title="Prioridades da semana" subtitle="Dedique atenção ao que mais precisa evoluir."><div className="sp-priorities">{[subjects[4], subjects[3], subjects[1]].map((s, i) => <button key={s.id} onClick={() => lab.open({ kind: 'subject', subject: s })}><span className="sp-number">0{i + 1}</span><span><b>{s.name}</b><small>{i === 0 ? 'Prioridade alta · 4h planejadas' : 'Consolidar conteúdo · 3h planejadas'}</small></span><span className="sp-pill">{s.score}%</span></button>)}</div></Card></div><Card title="Planejamento da semana" subtitle="07 — 13 de setembro · ciclos de estudo" action={<button className="sp-text-button" onClick={() => lab.go('cronograma')}>Calendário completo<ArrowUpRight size={15}/></button>}><div className="sp-plan-week">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, i) => <button key={day} className={i === 4 ? 'current' : ''} onClick={() => { lab.selectDate(`2026-09-${String(7 + i).padStart(2, '0')}`); lab.go('cronograma'); }}><small>{day}</small><b>{7 + i}</b><span>{i === 6 ? 'Simulado' : subjects[i % 6].name}</span><em>{i < 4 ? 'Ciclo realizado' : 'Próximo ciclo'}</em></button>)}</div></Card><Card title="Próximos estudos"><div className="sp-list">{subjects.slice(0, 3).map(s => <button className="sp-list-row" key={s.id} onClick={() => lab.open({ kind: 'lesson', subject: s })}><span className={`sp-subject-symbol ${s.color}`}>{s.short}</span><span><b>{s.topic}</b><small>{s.name} · 30 min</small></span><Play size={18}/></button>)}</div></Card></>;
}

export function StudiesPage() {
  const lab = useLab();
  const [query, setQuery] = useState('');
  const shown = subjects.filter(s => normalize(s.name).includes(normalize(query)));
  return <><PageTitle title="Estudos" subtitle="Sua biblioteca de conhecimento. Sua próxima conquista."/><div className="sp-feature-row"><div><span className="sp-eyebrow">CONTINUE DE ONDE PAROU</span><h2>Princípios Fundamentais</h2><p>Direito Constitucional · Aula 9 de 12</p></div><button className="sp-primary" onClick={() => lab.open({ kind: 'lesson', subject: subjects[0] })}><Play size={16}/>Retomar aula</button></div><label className="sp-search-field"><Search size={18}/><input aria-label="Buscar disciplina" placeholder="Qual disciplina vamos estudar hoje?" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="sp-grid three">{shown.map(subject => <Card className="sp-course" key={subject.id}><div className="sp-section-line"><span className={`sp-subject-symbol ${subject.color}`}>{subject.short}</span><span className="sp-pill">{subject.review} revisões</span></div><h2>{subject.name}</h2><p>{subject.completed + Number(lab.completedLessons.includes(subject.id))} de {subject.lessons} aulas concluídas</p><Progress value={Math.round((subject.completed + Number(lab.completedLessons.includes(subject.id))) / subject.lessons * 100)}/><dl><dt>Última aula</dt><dd>{subject.last}</dd><dt>Próxima aula</dt><dd>{subject.topic}</dd></dl><div className="sp-button-row"><button className="sp-secondary" onClick={() => lab.open({ kind: 'subject', subject })}>Detalhes</button><button className="sp-primary" onClick={() => lab.open({ kind: 'lesson', subject })}>Continuar<ArrowRight size={15}/></button></div></Card>)}</div>{shown.length === 0 && <div className="sp-empty">Nenhuma disciplina encontrada. Experimente outro termo.</div>}</>;
}

export function QuestionsPage() {
  const lab = useLab();
  const [tab, setTab] = useState('Banco de questões');
  const [subject, setSubject] = useState('Todas');
  const [topic, setTopic] = useState('Todos');
  const [board, setBoard] = useState('Todas');
  const [difficulty, setDifficulty] = useState('Todas');
  const correct = Object.values(lab.answers).filter(Boolean).length;
  const answered = Object.keys(lab.answers).length;
  const shown = questions.filter(q => (subject === 'Todas' || q.subject === subject) && (topic === 'Todos' || q.topic === topic) && (board === 'Todas' || q.board === board) && (difficulty === 'Todas' || q.difficulty === difficulty) && (tab !== 'Favoritas' || lab.favorites.includes(q.id)) && (tab !== 'Questões erradas' || lab.answers[q.id] === false));
  return <><PageTitle title="Questões" subtitle="Pratique com intenção. Aprenda com cada resposta." action={<button className="sp-primary" disabled={!shown.length} onClick={() => lab.open({ kind: 'quiz', items: shown })}><Plus size={17}/>Criar sessão</button>}/><div className="sp-metrics five"><Metric icon={<FileQuestion/>} label="Respondidas" value={String(342 + answered)}/><Metric icon={<Check/>} label="Acertos" value={String(267 + correct)} tone="green"/><Metric icon={<RotateCcw/>} label="Erros" value={String(75 + answered - correct)} tone="red"/><Metric icon={<Target/>} label="Aproveitamento" value={`${Math.round((267 + correct) / (342 + answered) * 100)}%`} tone="gold"/><Metric icon={<Clock3/>} label="Questões hoje" value={String(32 + answered)}/></div><Card title="Seu treino começa aqui" subtitle="4 questões autorais para experimentar a jornada completa."><Tabs options={['Banco de questões', 'Questões erradas', 'Favoritas']} value={tab} onChange={setTab}/><div className="sp-filters"><Select label="Matéria" value={subject} options={['Todas', 'Português', 'Raciocínio Lógico']} onChange={setSubject}/><Select label="Assunto" value={topic} options={['Todos', 'Conectivos', 'Sequências']} onChange={setTopic}/><Select label="Banca" value={board} options={['Todas', 'Autoral', 'Laboratório']} onChange={setBoard}/><Select label="Dificuldade" value={difficulty} options={['Todas', 'Fácil', 'Média']} onChange={setDifficulty}/></div><div className="sp-section-line"><p>{shown.length} questões encontradas</p><button className="sp-text-button" onClick={() => { setSubject('Todas'); setTopic('Todos'); setBoard('Todas'); setDifficulty('Todas'); setTab('Banco de questões'); }}>Limpar filtros</button></div><div className="sp-list">{shown.map(q => <div className="sp-question-row" key={q.id}><span className="sp-icon blue"><FileQuestion size={20}/></span><div><span className="sp-eyebrow">{q.subject} · {q.difficulty}</span><h3>{q.text}</h3><small>{q.board} · {q.topic}</small><button className="sp-text-button" onClick={() => lab.open({ kind: 'quiz', items: [q] })}>Resolver questão<ArrowRight size={14}/></button></div><button className={`sp-icon-button ${lab.favorites.includes(q.id) ? 'favorited' : ''}`} aria-label={`${lab.favorites.includes(q.id) ? 'Remover dos favoritos' : 'Favoritar'} ${q.id}`} aria-pressed={lab.favorites.includes(q.id)} onClick={() => lab.toggleFavorite(q.id)}><Star size={18} fill={lab.favorites.includes(q.id) ? 'currentColor' : 'none'}/></button></div>)}</div>{shown.length === 0 && <div className="sp-empty">Nenhuma questão nesta seleção.<br/>{tab === 'Questões erradas' ? 'As respostas incorretas das suas sessões aparecerão aqui.' : 'Altere os filtros ou favorite uma questão no banco.'}</div>}{shown.length > 0 && <button className="sp-primary" onClick={() => lab.open({ kind: 'quiz', items: shown })}><Play size={16}/>Resolver {shown.length} questões</button>}</Card></>;
}

type ReviewEvaluation = 'facil' | 'media' | 'dificil';

function evaluateQuestionReview(total: number, correct: number): ReviewEvaluation | null {
  if (!Number.isInteger(total) || !Number.isInteger(correct) || total <= 0 || correct < 0 || correct > total) return null;
  const ratio = correct / total;
  return ratio >= 0.8 ? 'facil' : ratio >= 0.5 ? 'media' : 'dificil';
}

function ReviewFinalizationModal({ id, initialSeconds, onClose }: { id: string; initialSeconds: number; onClose: () => void }) {
  const lab = useLab();
  const item = reviewItems.find(review => review.id === id)!;
  const initialMinutes = Math.max(1, Math.ceil(initialSeconds / 60));
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [questionCount, setQuestionCount] = useState('');
  const [correctCount, setCorrectCount] = useState('');
  const [board, setBoard] = useState('');
  const [observation, setObservation] = useState(`Revisão · ${item.title}`);
  const [materialText, setMaterialText] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const total = Number(questionCount);
  const correct = Number(correctCount);
  const validCounts = Number.isInteger(total) && Number.isInteger(correct) && total > 0 && correct >= 0 && correct <= total;
  const errors = validCounts ? total - correct : 0;
  const evaluation = validCounts ? evaluateQuestionReview(total, correct) : null;
  const percentage = validCounts ? Math.round((correct / total) * 100) : 0;
  const labels: Record<ReviewEvaluation, string> = { facil: 'Fácil', media: 'Média', dificil: 'Difícil' };
  const currentStage = Math.min(4, Math.max(1, Number(lab.notes[`review-stage:${id}`] ?? 1) || 1));

  const schedule = (() => {
    if (!evaluation) return null;
    if (evaluation === 'dificil') return { nextStage: currentStage, days: 1, text: `repete a etapa ${currentStage} em 1 dia` };
    if (evaluation === 'media') return { nextStage: currentStage, days: 3, text: `repete a etapa ${currentStage} em 3 dias` };
    if (currentStage >= 4) return { nextStage: 4, days: 0, text: 'finaliza o ciclo de revisões' };
    const nextStage = currentStage + 1;
    const days = nextStage === 2 ? 1 : nextStage === 3 ? 7 : 15;
    return { nextStage, days, text: `avança para a etapa ${nextStage}, prevista em ${days} dia${days === 1 ? '' : 's'}` };
  })();

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const realMinutes = Number(minutes);
    if (!Number.isFinite(realMinutes) || realMinutes <= 0) {
      lab.notify('Informe um tempo real válido para concluir a revisão.');
      return;
    }
    if (!validCounts || !evaluation || !schedule) {
      lab.notify('Confira a quantidade de questões e acertos antes de salvar.');
      return;
    }

    const result = {
      mode: 'questions',
      minutes: Math.round(realMinutes),
      questions: total,
      correct,
      errors,
      board: board.trim(),
      evaluation,
      percentage,
      stage: currentStage,
      nextStage: schedule.nextStage,
      nextDays: schedule.days,
      observation: observation.trim(),
      savedAt: new Date().toISOString(),
    };

    lab.setNote(`review-time:${id}`, String(Math.round(realMinutes * 60)));
    lab.setNote(`review-result:${id}`, JSON.stringify(result));
    lab.setNote(`review-stage:${id}`, String(schedule.nextStage));
    lab.setNote(`review-next:${id}`, schedule.text);
    lab.setNote(`review-material:${id}`, JSON.stringify({ files: files.map(file => file.name), text: materialText.trim() }));
    lab.setNote(`review-active:${id}`, '');
    lab.setNote(`review-finalizing:${id}`, '');
    lab.completeReview(id);
    lab.notify(`Revisão concluída como ${labels[evaluation]}. A próxima revisão ${schedule.text}.`);
    onClose();
  };

  return <Modal title="Finalizar sessão" close={onClose} wide>
    <div className="sp-section-line"><span className="sp-pill">REVISÃO POR QUESTÕES</span><span className="sp-pill">ETAPA {currentStage}</span></div>
    <p className="sp-muted" style={{marginBottom:18}}>{item.subject} — {item.title}</p>
    <form className="sp-form" onSubmit={save}>
      <div className="sp-grid two">
        <label className="sp-field"><span>Tempo real em minutos</span><input type="number" min={1} max={1440} value={minutes} onChange={event => setMinutes(event.target.value)}/><small>Preenchido pelo cronômetro; você pode ajustar antes de salvar.</small></label>
        <label className="sp-field"><span>Questões realizadas</span><input type="number" min={1} value={questionCount} onChange={event => setQuestionCount(event.target.value)}/></label>
        <label className="sp-field"><span>Acertos</span><input type="number" min={0} max={questionCount || undefined} value={correctCount} onChange={event => setCorrectCount(event.target.value)}/></label>
        <label className="sp-field"><span>Erros calculados</span><input type="number" readOnly value={validCounts ? errors : ''}/></label>
      </div>

      <label className="sp-field"><span>Banca</span><input value={board} onChange={event => setBoard(event.target.value)} placeholder="Ex.: IBFC"/></label>

      <Card title="Avaliação automática da revisão" subtitle={evaluation ? `${labels[evaluation]} · ${correct} de ${total} acertos (${percentage}%)` : 'Preencha questões e acertos para calcular.'}>
        <p><strong>Fácil:</strong> 80% ou mais · <strong>Média:</strong> 50% a menos de 80% · <strong>Difícil:</strong> abaixo de 50%.</p>
        <p style={{marginTop:10}}>{evaluation && schedule ? `Ao salvar, esta revisão será concluída e a próxima ${schedule.text}.` : 'O agendamento aparece automaticamente assim que o resultado for válido.'}</p>
      </Card>

      <label className="sp-field"><span>Observações</span><textarea rows={4} value={observation} onChange={event => setObservation(event.target.value)} placeholder="Anote dúvidas, pontos de atenção ou o que precisa reforçar."/></label>

      <Card title="Materiais da sessão" subtitle="PDF, imagem, documento ou texto vinculado a este assunto.">
        <div className="sp-section-line"><span className="sp-muted">Guarde o que você produziu durante a revisão.</span><button type="button" className="sp-secondary" onClick={() => { onClose(); lab.go('materiais'); }}>Centro de Materiais</button></div>
        <label className="sp-field"><span>Selecionar arquivos</span><input type="file" multiple accept=".pdf,.doc,.docx,.txt,image/*" onChange={event => setFiles(Array.from(event.target.files ?? []))}/><small>{files.length ? `${files.length} arquivo${files.length === 1 ? '' : 's'} selecionado${files.length === 1 ? '' : 's'}: ${files.map(file => file.name).join(', ')}` : 'Nenhum arquivo selecionado.'}</small></label>
        <label className="sp-field"><span>Texto para guardar como material</span><textarea rows={4} value={materialText} onChange={event => setMaterialText(event.target.value)} placeholder="Cole aqui um resumo, anotação, bizu ou texto para guardar junto deste assunto."/></label>
      </Card>

      <div className="sp-study-controls">
        <button type="button" className="sp-secondary" onClick={onClose}>Voltar</button>
        <button type="submit" className="sp-primary"><Check size={17}/>Salvar e concluir revisão</button>
      </div>
    </form>
  </Modal>;
}

export function ReviewsPage() {
  const lab = useLab();
  const [filter, setFilter] = useState('Todas');
  const [finalizing, setFinalizing] = useState<{ id: string; seconds: number } | null>(null);
  const shown = reviewItems.filter(r => filter === 'Todas' || (filter === 'Concluídas' ? lab.completedReviews.includes(r.id) : r.status === filter && !lab.completedReviews.includes(r.id)));

  const bankRunningReview = (id: string) => {
    const timeKey = `review-time:${id}`;
    const baseSeconds = Number(lab.notes[timeKey] ?? 0) || 0;
    const activeKey = `review-active:${id}`;
    const running = lab.notes[activeKey];
    if (!running) return baseSeconds;
    const [, startedText] = running.split('|');
    const started = Number(startedText);
    if (!Number.isFinite(started)) return baseSeconds;
    const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
    const totalSeconds = baseSeconds + seconds;
    lab.setNote(timeKey, String(totalSeconds));
    return totalSeconds;
  };

  const startReview = (id: string, subjectName: string, mode: 'study' | 'questions') => {
    const subject = subjects.find(item => item.name === subjectName);
    const target = mode === 'study' ? subject?.lessonUrl : subject?.questionsUrl;
    if (!target) {
      lab.notify('Ainda não há link cadastrado para esta opção de revisão.');
      return;
    }
    bankRunningReview(id);
    lab.setNote(`review-finalizing:${id}`, '');
    lab.setNote(`review-active:${id}`, `${mode}|${Date.now()}`);
    lab.notify(mode === 'study' ? 'Revisão por aula iniciada. O tempo está contando.' : 'Revisão por questões iniciada. O tempo está contando.');
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const finishReview = (id: string) => {
    const pendingFinalization = lab.notes[`review-finalizing:${id}`] === 'questions';
    if (pendingFinalization) {
      setFinalizing({ id, seconds: Number(lab.notes[`review-time:${id}`] ?? 0) || 0 });
      return;
    }

    const running = lab.notes[`review-active:${id}`];
    if (!running) {
      lab.notify('Primeiro escolha Estudar ou Questões para iniciar esta revisão.');
      return;
    }

    const [mode] = running.split('|');
    const totalSeconds = bankRunningReview(id);
    lab.setNote(`review-active:${id}`, '');

    if (mode === 'questions') {
      lab.setNote(`review-finalizing:${id}`, 'questions');
      setFinalizing({ id, seconds: totalSeconds });
      return;
    }

    lab.completeReview(id);
  };

  return <><PageTitle title="Revisões" subtitle="Relembrar no momento certo faz o conhecimento ficar."/><div className="sp-metrics four">{[{ title: 'Para hoje', filter: 'Hoje', icon: Clock3, tone: 'gold' }, { title: 'Atrasadas', filter: 'Atrasadas', icon: RotateCcw, tone: 'red' }, { title: 'Concluídas', filter: 'Concluídas', icon: CheckCheck, tone: 'green' }, { title: 'Próximas', filter: 'Próximas', icon: CalendarDays, tone: 'blue' }].map(item => <Metric key={item.filter} icon={<item.icon/>} label={item.title} tone={item.tone} value={String(item.filter === 'Concluídas' ? lab.completedReviews.length : reviewItems.filter(r => r.status === item.filter && !lab.completedReviews.includes(r.id)).length)} onClick={() => setFilter(item.filter)}/>)}</div><Card title="Sua fila de revisão" subtitle="Aula, questões ou conclusão: escolha direto no card."><Tabs options={['Todas', 'Hoje', 'Atrasadas', 'Próximas', 'Concluídas']} value={filter} onChange={setFilter}/><div className="sp-review-list">{shown.map(r => {
    const completed = lab.completedReviews.includes(r.id);
    const running = lab.notes[`review-active:${r.id}`];
    const runningMode = running?.split('|')[0];
    const finalizationPending = lab.notes[`review-finalizing:${r.id}`] === 'questions';
    return <div key={r.id} className="sp-review-row" style={{display:'grid', gridTemplateColumns:'minmax(0,1fr)', gap:14, alignItems:'stretch'}}><div style={{display:'flex', gap:14, alignItems:'flex-start'}}><div className="sp-review-date"><b>{r.date.split(' ')[0]}</b><small>SET</small></div><div style={{minWidth:0}}><span className={`sp-pill ${completed ? 'green' : r.status === 'Atrasadas' ? 'red' : ''}`}>{completed ? 'Concluída' : finalizationPending ? 'Finalização pendente' : runningMode === 'study' ? 'Aula em andamento' : runningMode === 'questions' ? 'Questões em andamento' : r.status}</span><h3 style={{marginTop:8}}>{r.title}</h3><p>{r.subject}</p>{runningMode && !completed && <small style={{display:'block', marginTop:5, color:'#90a8c0'}}>Cronômetro iniciado ao escolher {runningMode === 'study' ? 'Estudar' : 'Questões'}.</small>}{finalizationPending && !completed && <small style={{display:'block', marginTop:5, color:'#d7bc83'}}>Tempo pausado. Preencha os dados da sessão para concluir.</small>}</div></div>{completed ? <button className="sp-secondary" onClick={() => lab.open({ kind: 'review', id: r.id })}>Ver revisão<ArrowRight size={15}/></button> : <div style={{display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:10}}><button className="sp-secondary" style={{background:'#1769e8', borderColor:'#4385f0'}} onClick={() => startReview(r.id, r.subject, 'study')}><Play size={16}/>Estudar</button><button className="sp-secondary" style={{background:'#7134df', borderColor:'#8d5cf0'}} onClick={() => startReview(r.id, r.subject, 'questions')}><FileQuestion size={16}/>Questões</button><button className="sp-secondary" style={{background:'#138a49', borderColor:'#32a765'}} onClick={() => finishReview(r.id)}><Check size={16}/>{finalizationPending ? 'Finalizar' : 'Concluir'}</button><button className="sp-secondary" aria-label={`Mais opções para ${r.title}`} onClick={() => lab.open({ kind: 'review', id: r.id })}>•••</button></div>}</div>;
  })}</div>{!shown.length && <div className="sp-empty">Tudo em dia por aqui. Suas próximas revisões aparecerão nesta lista.</div>}</Card>{finalizing && <ReviewFinalizationModal id={finalizing.id} initialSeconds={finalizing.seconds} onClose={() => setFinalizing(null)}/>}</>;
}

export function SimulationsPage() {
  const lab = useLab();
  return <><PageTitle title="Simulados" subtitle="Treine sua estratégia. Ganhe confiança para o grande dia." action={<button className="sp-primary" onClick={() => lab.open({ kind: 'quiz', items: questions, simulation: true })}><Plus size={17}/>Criar simulado</button>}/><div className="sp-metrics four"><Metric icon={<Trophy/>} value="82%" label="Melhor resultado" tone="gold"/><Metric icon={<Target/>} value="75%" label="Média de acertos"/><Metric icon={<TrendingUp/>} value="82%" label="Último resultado" hint="↑ 7 pontos percentuais"/><Metric icon={<FileText/>} value="3" label="Simulados realizados"/></div><div className="sp-grid two"><Card className="sp-simulation-feature"><span className="sp-pill">SEU PRÓXIMO DESAFIO</span><span className="sp-icon gold"><Flag size={26}/></span><h2>Missão: aprovação.</h2><p>Experimente um simulado com 4 questões, correção comentada e resultado ao final.</p><div className="sp-tag-row"><span><FileQuestion size={14}/>4 questões</span><span><Clock3 size={14}/>Sem limite de tempo</span></div><button className="sp-primary" onClick={() => lab.open({ kind: 'quiz', items: questions, simulation: true })}><Play size={16}/>Continuar</button></Card><Card title="Sua evolução em provas" subtitle="Aproveitamento nos últimos simulados"><EvolutionChart values={[68, 75, 82]}/></Card></div><Card title="Simulados anteriores" subtitle="Revisitar seus erros é parte da estratégia."><div className="sp-list">{[82, 75, 68].map((score, index) => <div className="sp-history-row" key={score}><span className="sp-icon blue"><FileText size={22}/></span><div><h3>Simulado PMPE #{3 - index}</h3><p>{String(6 - index * 2).padStart(2, '0')} set 2026 · 50 questões</p></div><strong>{score}%</strong><button className="sp-secondary" onClick={() => lab.open({ kind: 'result', score, title: `Simulado PMPE #${3 - index}` })}>Ver resultado</button></div>)}</div><button className="sp-text-button" onClick={() => lab.open({ kind: 'quiz', items: questions.filter((_, i) => i % 2 === 0) })}>Revisar erros · amostra demonstrativa<ArrowRight size={16}/></button></Card></>;
}

export function PerformancePage({ statistics = false }: { statistics?: boolean }) {
  const lab = useLab();
  const [period, setPeriod] = useState('30 dias');
  const [subject, setSubject] = useState('Todas');
  const [topic, setTopic] = useState('Todos');
  const selected = subjects.find(s => s.name === subject);
  const factors: Record<string, number> = { Tudo: 1.8, Hoje: .09, '7 dias': .42, '30 dias': 1, 'Este mês': .6 };
  const base = selected ? selected.score : 78;
  const score = Math.min(98, base + (period === 'Hoje' ? 3 : period === '7 dias' ? 2 : 0) + (topic === 'Revisão' ? -2 : 0));
  const count = Math.round((selected ? 74 : 342) * factors[period] * (topic === 'Todos' ? 1 : .55));
  const correct = Math.round(count * score / 100);
  return <><PageTitle title={statistics ? 'Estatísticas' : 'Desempenho'} subtitle={statistics ? 'Os números contam sua história. Use-os para ir além.' : 'Reconheça seus avanços. Descubra seu próximo foco.'} action={!statistics && <button className="sp-secondary" onClick={() => lab.go('estatisticas')}>Estatísticas completas<ArrowUpRight size={16}/></button>}/><div className="sp-analytics-filters"><Tabs options={['Tudo', 'Hoje', '7 dias', '30 dias', 'Este mês']} value={period} onChange={setPeriod}/><div className="sp-filters"><Select label="Matéria" value={subject} options={['Todas', ...subjects.map(s => s.name)]} onChange={setSubject}/><Select label="Assunto" value={topic} options={['Todos', 'Fundamentos', 'Revisão']} onChange={setTopic}/></div></div><div className="sp-metrics six"><Metric icon={<Target/>} label="Aproveitamento" value={`${score}%`} tone="gold"/><Metric icon={<FileQuestion/>} label="Questões" value={String(count)}/><Metric icon={<Check/>} label="Acertos" value={String(correct)} tone="green"/><Metric icon={<RotateCcw/>} label="Erros" value={String(count - correct)} tone="red"/><Metric icon={<Clock3/>} label="Tempo estudado" value={`${(32.8 * factors[period] * (selected ? .2 : 1)).toFixed(1).replace('.', ',')}h`}/><Metric icon={<CheckCheck/>} label="Revisões" value={String(Math.max(1, Math.round(24 * factors[period] * (selected ? .2 : 1))))}/></div><div className="sp-grid two"><Card title="Seu aproveitamento" subtitle={`${subject} · ${period} · ${topic}`}><Donut value={score} review={0}/><div className="sp-insight"><TrendingUp size={18}/><span>Constância hoje. Mais confiança amanhã.</span></div></Card><Card title="Evolução do desempenho" subtitle="Aproveitamento (%) por período"><EvolutionChart values={[score - 18, score - 15, score - 16, score - 10, score - 7, score - 9, score - 4, score]}/></Card></div><Card title="Desempenho por matéria" subtitle="Identifique onde você está forte e onde pode avançar."><div className="sp-subject-performance">{subjects.filter(s => subject === 'Todas' || s.name === subject).map(s => <button key={s.id} onClick={() => lab.open({ kind: 'subject', subject: s })}><span className={`sp-subject-symbol ${s.color}`}>{s.short}</span><b>{s.name}</b><Progress value={s.score}/><strong>{s.score}%</strong><ArrowUpRight size={16}/></button>)}</div></Card><div className="sp-grid two"><Card className="sp-smart-card"><span className="sp-eyebrow"><Trophy size={16}/>SEU PONTO FORTE</span><h2>Direito Constitucional</h2><p>88% de aproveitamento. Sua dedicação está construindo uma base sólida.</p><button className="sp-text-button" onClick={() => lab.open({ kind: 'subject', subject: subjects[0] })}>Continuar evoluindo<ArrowRight size={15}/></button></Card><Card className="sp-smart-card"><span className="sp-eyebrow"><Target size={16}/>FOCO RECOMENDADO</span><h2>Raciocínio Lógico</h2><p>Reserve 20 minutos para sequências e revise os erros das últimas sessões.</p><button className="sp-text-button" onClick={() => lab.open({ kind: 'quiz', items: questions.filter(q => q.subject === 'Raciocínio Lógico') })}>Praticar agora<ArrowRight size={15}/></button></Card></div></>;
}

export function MaterialsPage() {
  const lab = useLab();
  const [tab, setTab] = useState('Todos');
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('Todas');
  const shown = materials.filter(m => (tab === 'Todos' || tab === m.type || (tab === 'Favoritos' && lab.favorites.includes(m.id)) || (tab === 'Downloads' && lab.downloads.includes(m.id))) && normalize(`${m.title} ${m.subject}`).includes(normalize(query)) && (subject === 'Todas' || subject === m.subject));
  return <><PageTitle title="Materiais" subtitle="Tudo o que você precisa, organizado para o seu próximo passo."/><div className="sp-material-search"><label className="sp-search-field"><Search size={18}/><input aria-label="Buscar material" placeholder="Buscar material, assunto ou disciplina…" value={query} onChange={e => setQuery(e.target.value)}/></label><Select label="Disciplina" value={subject} options={['Todas', 'Método de estudo', 'Português', 'Raciocínio Lógico']} onChange={setSubject}/></div><Tabs options={['Todos', 'PDFs', 'Resumos', 'Mapas mentais', 'Favoritos', 'Downloads']} value={tab} onChange={setTab}/><div className="sp-grid three">{shown.map(m => <Card className="sp-material" key={m.id}><div className={`sp-material-cover ${m.type === 'Mapas mentais' ? 'gold' : ''}`}>{m.type === 'Mapas mentais' ? <Layers size={44}/> : <FileText size={44}/>}<span>{m.type}</span></div><span className="sp-eyebrow">{m.subject}</span><h2>{m.title}</h2><p>{m.pages} · Conteúdo demonstrativo</p><div className="sp-button-row"><button className="sp-secondary" onClick={() => lab.open({ kind: 'material', material: m })}>Abrir material<ArrowUpRight size={15}/></button><button className={`sp-icon-button ${lab.favorites.includes(m.id) ? 'favorited' : ''}`} aria-label={`Favoritar ${m.title}`} aria-pressed={lab.favorites.includes(m.id)} onClick={() => lab.toggleFavorite(m.id)}><Star size={18} fill={lab.favorites.includes(m.id) ? 'currentColor' : 'none'}/></button><button className="sp-icon-button" aria-label={`Baixar ${m.title}`} onClick={() => lab.download(m)}><Download size={18}/></button></div></Card>)}</div>{!shown.length && <div className="sp-empty">Nenhum material encontrado.<br/>{tab === 'Favoritos' ? 'Toque na estrela de um material para guardá-lo aqui.' : tab === 'Downloads' ? 'Os materiais baixados aparecerão aqui.' : 'Experimente outro termo ou categoria.'}</div>}</>;
}

export function SchedulePage() {
  const lab = useLab();
  const [view, setView] = useState('Semana');
  const selected = new Date(`${lab.selectedDate}T12:00:00`);
  const monday = new Date(selected); monday.setDate(selected.getDate() - (selected.getDay() + 6) % 7);
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return <><PageTitle title="Cronograma" subtitle="Organize seu tempo. Abra espaço para a sua conquista." action={<button className="sp-primary" onClick={() => lab.open({ kind: 'task' })}><Plus size={17}/>Nova tarefa</button>}/><div className="sp-section-line"><Tabs options={['Hoje', 'Semana', 'Mês']} value={view} onChange={v => { setView(v); if (v === 'Hoje') lab.selectDate('2026-09-11'); }}/><span className="sp-pill">{lab.tasks.filter(t => t.done).length} atividades concluídas</span></div><div className="sp-grid schedule"><Card title="Escolha seu dia"><Calendar selected={lab.selectedDate} onSelect={lab.selectDate} tasks={lab.tasks}/></Card><Card title={view === 'Hoje' ? 'Seu dia de estudo' : view === 'Mês' ? 'Atividades do mês' : 'Sua semana de estudo'} subtitle={selected.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}>{view === 'Semana' && <div className="sp-week-picker"><button className="sp-icon-button" aria-label="Semana anterior" onClick={() => { const d = new Date(selected); d.setDate(d.getDate() - 7); lab.selectDate(key(d)); }}>‹</button>{week.map(d => <button key={key(d)} className={lab.selectedDate === key(d) ? 'active' : ''} onClick={() => lab.selectDate(key(d))}><small>{d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}</small><b>{d.getDate()}</b></button>)}<button className="sp-icon-button" aria-label="Próxima semana" onClick={() => { const d = new Date(selected); d.setDate(d.getDate() + 7); lab.selectDate(key(d)); }}>›</button></div>}{view === 'Mês' ? <div className="sp-month-list">{lab.tasks.filter(t => t.date.startsWith(lab.selectedDate.slice(0, 7))).map(task => <label className={`sp-task ${task.done ? 'done' : ''}`} key={task.id}><input type="checkbox" checked={task.done} onChange={() => lab.toggleTask(task.id)}/><span><b>{task.title}</b><small>{task.date.slice(8)}/{task.date.slice(5, 7)} · {task.time}</small></span></label>)}{!lab.tasks.some(t => t.date.startsWith(lab.selectedDate.slice(0, 7))) && <div className="sp-empty">Nenhuma atividade neste mês.</div>}</div> : <Tasks tasks={lab.tasks} date={lab.selectedDate} toggle={lab.toggleTask} add={() => lab.open({ kind: 'task' })}/>}</Card></div><div className="sp-insight"><Target size={20}/><p>Um planejamento possível vale mais do que uma rotina perfeita. Ajuste suas metas ao seu ritmo.</p></div></>;
}

export function MentorshipPage() {
  const lab = useLab();
  const [checks, setChecks] = useState([true, true, false, false]);
  const [sent, setSent] = useState(false);
  return <><PageTitle title="Mentoria" subtitle="Orientação para cada etapa. Companhia para toda a jornada."/><div className="sp-grid two"><Card className="sp-mentor-card"><span className="sp-eyebrow">AO SEU LADO NA PREPARAÇÃO</span><div className="sp-mentor-profile"><span>PR</span><div><h2>Professor Renato</h2><p>Mentor · Preparação PMPE</p><span className="sp-pill">ACOMPANHAMENTO SEMANAL</span></div></div><blockquote>“Sua constância está fazendo a diferença. Nesta semana, vamos concentrar nossa energia em Raciocínio Lógico e na revisão dos erros.”</blockquote><button className="sp-primary" onClick={() => lab.open({ kind: 'mentor' })}><MessageSquare size={17}/>Abrir acompanhamento</button></Card><Card title="Check-in da semana" subtitle="Reconheça suas conquistas e organize os próximos passos."><div className="sp-check-in">{['Estudei em pelo menos 5 dias', 'Realizei o simulado semanal', 'Concluí as revisões pendentes', 'Alcancei a meta de questões'].map((text, index) => <label className="sp-task" key={text}><input type="checkbox" checked={checks[index]} onChange={() => { setChecks(old => old.map((v, i) => i === index ? !v : v)); setSent(false); }}/><span><b>{text}</b></span></label>)}</div><button className="sp-secondary full" onClick={() => { setSent(true); lab.notify('Check-in salvo nesta demonstração.'); }}>{sent ? <><Check size={16}/>Check-in registrado na prévia</> : 'Registrar check-in'}</button></Card></div><Card title="Rota do concurseiro" subtitle="Você está construindo uma preparação completa."><div className="sp-journey">{['Construir a base', 'Consolidar conteúdo', 'Treinar para a prova', 'Reta final'].map((name, i) => <button key={name} className={i === 1 ? 'current' : ''} onClick={() => lab.open({ kind: 'mentor' })}><span>{i === 0 ? <Check size={20}/> : `0${i + 1}`}</span><b>{name}</b><small>{i === 0 ? 'Etapa concluída' : i === 1 ? 'Você está aqui' : 'Próxima etapa'}</small></button>)}</div></Card><div className="sp-grid two"><Card title="Metas acompanhadas"><div className="sp-mentor-goals">{[['Questões na semana', '342 / 400', 86], ['Aproveitamento', '78% / 80%', 97], ['Horas de estudo', `18h / ${lab.goal}h`, Math.min(100, Math.round(18 / lab.goal * 100))]].map(([label, count, value]) => <div key={label}><div className="sp-section-line"><b>{label}</b><span>{count}</span></div><Progress value={Number(value)}/></div>)}</div></Card><Card title="Próximas atividades"><button className="sp-list-row" onClick={() => lab.open({ kind: 'lesson', subject: subjects[4] })}><span className="sp-icon gold"><Play size={20}/></span><span><b>Raciocínio Lógico na prática</b><small>Aula demonstrativa · Sequências numéricas</small></span><ArrowRight size={17}/></button><button className="sp-list-row" onClick={() => lab.open({ kind: 'mentor' })}><span className="sp-icon blue"><CalendarDays size={20}/></span><span><b>Encontro de acompanhamento</b><small>Segunda, 14 set · 19h</small></span><ArrowRight size={17}/></button></Card></div></>;
}
