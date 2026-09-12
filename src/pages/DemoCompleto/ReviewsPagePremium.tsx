import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, CheckCheck, Clock3, ExternalLink, FileQuestion, FileText, Pause, Play, RotateCcw } from 'lucide-react';
import { Card, Metric, Modal, PageTitle, Tabs } from './DemoUI';
import { materials, questions, reviewItems, subjects } from './demoData';
import { useLab } from './demoState';

type ReviewMode = 'study' | 'questions';
type ReviewEvaluation = 'facil' | 'media' | 'dificil';

const moduleBySubject: Record<string, string> = {
  'Português': 'Módulo 2 · Classes de Palavras',
  'Raciocínio Lógico': 'Geral',
  'Direito Constitucional': 'Módulo 1 · Fundamentos',
  'Direitos Humanos': 'Módulo 1 · Fundamentos',
  'Legislação PMPE': 'Módulo 1 · Legislação',
  'História de Pernambuco': 'Módulo 1 · Formação histórica',
};

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function evaluateQuestionReview(total: number, correct: number): ReviewEvaluation | null {
  if (!Number.isInteger(total) || !Number.isInteger(correct) || total <= 0 || correct < 0 || correct > total) return null;
  const ratio = correct / total;
  return ratio >= 0.8 ? 'facil' : ratio >= 0.5 ? 'media' : 'dificil';
}

function ReviewFinalizationModal({ id, initialSeconds, onClose, onSaved }: { id: string; initialSeconds: number; onClose: () => void; onSaved: () => void }) {
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
      mode: 'questions', minutes: Math.round(realMinutes), questions: total, correct, errors,
      board: board.trim(), evaluation, percentage, stage: currentStage,
      nextStage: schedule.nextStage, nextDays: schedule.days, observation: observation.trim(), savedAt: new Date().toISOString(),
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
    onSaved();
  };

  return <Modal title="Finalizar sessão" close={onClose} wide>
    <div className="sp-section-line"><span className="sp-pill">REVISÃO POR QUESTÕES</span><span className="sp-pill">ETAPA {currentStage}</span></div>
    <p className="sp-muted" style={{ marginBottom: 18 }}>{item.subject} — {item.title}</p>
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
        <p style={{ marginTop: 10 }}>{evaluation && schedule ? `Ao salvar, esta revisão será concluída e a próxima ${schedule.text}.` : 'O agendamento aparece automaticamente assim que o resultado for válido.'}</p>
      </Card>
      <label className="sp-field"><span>Observações</span><textarea rows={4} value={observation} onChange={event => setObservation(event.target.value)} placeholder="Anote dúvidas, pontos de atenção ou o que precisa reforçar."/></label>
      <Card title="Materiais da sessão" subtitle="PDF, imagem, documento ou texto vinculado a este assunto.">
        <div className="sp-section-line"><span className="sp-muted">Guarde o que você produziu durante a revisão.</span><button type="button" className="sp-secondary" onClick={() => lab.go('materiais')}>Centro de Materiais</button></div>
        <label className="sp-field"><span>Selecionar arquivos</span><input type="file" multiple accept=".pdf,.doc,.docx,.txt,image/*" onChange={event => setFiles(Array.from(event.target.files ?? []))}/><small>{files.length ? `${files.length} arquivo${files.length === 1 ? '' : 's'} selecionado${files.length === 1 ? '' : 's'}` : 'Nenhum arquivo selecionado.'}</small></label>
        <label className="sp-field"><span>Texto para guardar como material</span><textarea rows={4} value={materialText} onChange={event => setMaterialText(event.target.value)} placeholder="Cole aqui um resumo, anotação, bizu ou texto para guardar junto deste assunto."/></label>
      </Card>
      <div className="sp-study-controls"><button type="button" className="sp-secondary" onClick={onClose}>Voltar</button><button type="submit" className="sp-primary"><Check size={17}/>Salvar e concluir revisão</button></div>
    </form>
  </Modal>;
}

function ReviewWorkspace({ id, initialMode, onBack, onFinalize }: { id: string; initialMode: ReviewMode; onBack: () => void; onFinalize: (seconds: number) => void }) {
  const lab = useLab();
  const item = reviewItems.find(review => review.id === id)!;
  const subject = subjects.find(entry => entry.name === item.subject);
  const linkedMaterials = materials.filter(material => material.subject === item.subject);
  const [mode, setMode] = useState<ReviewMode>(initialMode);
  const [objective, setObjective] = useState(`Revisar ${item.title}`);
  const [observation, setObservation] = useState(`Revisão etapa ${lab.notes[`review-stage:${id}`] ?? '1'}`);
  const [now, setNow] = useState(Date.now());

  useEffect(() => setMode(initialMode), [id, initialMode]);
  useEffect(() => {
    const active = lab.notes[`review-active:${id}`];
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [id, lab.notes]);

  const active = lab.notes[`review-active:${id}`];
  const [activeMode, activeStartedText] = active ? active.split('|') : ['', ''];
  const activeStarted = Number(activeStartedText);
  const savedSeconds = Number(lab.notes[`review-time:${id}`] ?? 0) || 0;
  const liveSeconds = active && Number.isFinite(activeStarted) ? Math.max(0, Math.floor((now - activeStarted) / 1000)) : 0;
  const elapsed = savedSeconds + liveSeconds;
  const done = lab.completedReviews.includes(id);
  const finalizationPending = lab.notes[`review-finalizing:${id}`] === 'questions';
  const internalQuestions = questions.filter(question => question.subject === item.subject);
  const hasExternalQuestionLink = Boolean(subject?.questionsUrl?.trim());
  const currentStage = Math.min(4, Math.max(1, Number(lab.notes[`review-stage:${id}`] ?? 1) || 1));

  const bank = () => {
    if (!active || !Number.isFinite(activeStarted)) return savedSeconds;
    const total = savedSeconds + Math.max(0, Math.floor((Date.now() - activeStarted) / 1000));
    lab.setNote(`review-time:${id}`, String(total));
    return total;
  };

  const startSession = () => {
    if (done) return;
    if (active) bank();
    lab.setNote(`review-finalizing:${id}`, '');
    lab.setNote(`review-last-mode:${id}`, mode);
    lab.setNote(`review-objective:${id}`, objective.trim());
    lab.setNote(`review-observation:${id}`, observation.trim());
    lab.setNote(`review-active:${id}`, `${mode}|${Date.now()}`);
    setNow(Date.now());

    if (mode === 'questions') {
      if (hasExternalQuestionLink && subject?.questionsUrl) {
        window.open(subject.questionsUrl, '_blank', 'noopener,noreferrer');
        lab.notify('Revisão por questões iniciada. O link cadastrado foi aberto e o cronômetro está contando.');
        return;
      }
      if (internalQuestions.length > 0) {
        lab.notify('Sem link externo. Abrindo o banco de questões do próprio Studio Pro.');
        lab.open({ kind: 'quiz', items: internalQuestions });
        return;
      }
      lab.setNote(`review-active:${id}`, '');
      lab.notify('Não há link externo nem questões internas cadastradas para este assunto.');
      return;
    }

    if (subject?.lessonUrl) {
      window.open(subject.lessonUrl, '_blank', 'noopener,noreferrer');
      lab.notify('Revisão por teoria iniciada. A aula cadastrada foi aberta e o cronômetro está contando.');
      return;
    }
    if (linkedMaterials[0]) {
      lab.notify('Sem link de aula. Abrindo o material interno vinculado ao assunto.');
      lab.open({ kind: 'material', material: linkedMaterials[0] });
      return;
    }
    lab.setNote(`review-active:${id}`, '');
    lab.notify('Não há aula nem material interno cadastrado para este assunto.');
  };

  const pauseSession = () => {
    if (!active) return;
    bank();
    lab.setNote(`review-active:${id}`, '');
    lab.notify('Revisão pausada. O tempo acumulado foi salvo.');
  };

  const finishSession = () => {
    const runningMode = activeMode || lab.notes[`review-last-mode:${id}`] || mode;
    const total = active ? bank() : savedSeconds;
    lab.setNote(`review-active:${id}`, '');
    if (runningMode === 'questions') {
      lab.setNote(`review-finalizing:${id}`, 'questions');
      onFinalize(total);
      return;
    }
    lab.completeReview(id);
    lab.notify('Revisão por teoria concluída.');
    onBack();
  };

  const destinationLabel = mode === 'questions'
    ? hasExternalQuestionLink ? 'Link externo cadastrado (QConcursos ou outro banco)' : 'Banco de questões interno do Studio Pro'
    : subject?.lessonUrl ? 'Link da aula cadastrado pelo professor' : linkedMaterials.length ? 'Material interno vinculado ao assunto' : 'Nenhum recurso cadastrado ainda';

  return <>
    <PageTitle title="Central da revisão" subtitle="Escolha o formato, confira o conteúdo e só então inicie a sessão." action={<button className="sp-secondary" onClick={onBack}><ArrowLeft size={16}/>Voltar para revisões</button>}/>
    <div className="sp-grid two" style={{ alignItems: 'start' }}>
      <Card title="Tipo de atividade" subtitle="A revisão já vem preenchida com a matéria e o assunto da sua fila.">
        <div className="sp-button-row" style={{ marginBottom: 18 }}>
          <button className="sp-secondary" disabled><BookOpen size={16}/>Aula</button>
          <button className="sp-primary"><RotateCcw size={16}/>Revisão</button>
          <button className="sp-secondary" disabled><FileQuestion size={16}/>Questões</button>
          <button className="sp-secondary" disabled><FileText size={16}/>Simulado</button>
        </div>
        <div className="sp-form">
          <label className="sp-field"><span>Matéria</span><input value={item.subject} readOnly/></label>
          <label className="sp-field"><span>Módulo</span><input value={moduleBySubject[item.subject] ?? 'Geral'} readOnly/></label>
          <label className="sp-field"><span>Assunto</span><input value={item.title} readOnly/></label>
          <div className="sp-field"><span>Formato da revisão</span><div className="sp-study-controls"><button type="button" className={mode === 'study' ? 'sp-primary' : 'sp-secondary'} disabled={Boolean(active)} onClick={() => setMode('study')}><BookOpen size={16}/>Teoria</button><button type="button" className={mode === 'questions' ? 'sp-primary' : 'sp-secondary'} disabled={Boolean(active)} onClick={() => setMode('questions')}><FileQuestion size={16}/>Questões</button></div><small>{mode === 'study' ? 'Releitura, aula, resumo ou material vinculado.' : 'Questões externas quando houver link; caso contrário, banco interno do Studio Pro.'}</small></div>
          <label className="sp-field"><span>Objetivo <small>(opcional)</small></span><input value={objective} onChange={event => setObjective(event.target.value)} disabled={Boolean(active)}/></label>
          <label className="sp-field"><span>Observações <small>(opcional)</small></span><textarea rows={4} value={observation} onChange={event => setObservation(event.target.value)} disabled={Boolean(active)}/></label>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: 18 }}>
        <Card title={done ? 'Revisão concluída' : finalizationPending ? 'Finalização pendente' : active ? 'Revisão em andamento' : 'Pronto para iniciar'} subtitle={`Etapa ${currentStage} · ${mode === 'study' ? 'Teoria' : 'Questões'}`}>
          <div style={{ textAlign: 'center', padding: '14px 0 20px' }}><div style={{ fontSize: 'clamp(40px,6vw,68px)', fontWeight: 800, letterSpacing: 2 }}>{formatElapsed(elapsed)}</div><small className="sp-muted">{active ? 'cronômetro em andamento' : elapsed > 0 ? 'tempo acumulado' : 'o tempo só começa ao iniciar a sessão'}</small></div>
          <div className="sp-subject-detail" style={{ textAlign: 'center' }}><span className="sp-pill">REVISÃO</span><h3 style={{ marginTop: 10 }}>{item.subject}</h3><p>{moduleBySubject[item.subject] ?? 'Geral'}</p><p>{item.title}</p><p><strong>Objetivo:</strong> {objective || `Revisar ${item.title}`}</p></div>
        </Card>

        <Card title="Materiais vinculados" subtitle={`${item.subject} → ${moduleBySubject[item.subject] ?? 'Geral'} → ${item.title}`} action={<button className="sp-secondary" onClick={() => lab.go('materiais')}>Centro de Materiais</button>}>
          {linkedMaterials.length ? <div className="sp-list">{linkedMaterials.map(material => <button className="sp-list-row" key={material.id} onClick={() => lab.open({ kind: 'material', material })}><FileText size={18}/><span><b>{material.title}</b><small>{material.type}</small></span><ArrowRight size={15}/></button>)}</div> : <div className="sp-empty">Nenhum material foi cadastrado para este assunto.</div>}
        </Card>

        <Card title="Destino da atividade" subtitle={destinationLabel}>
          <div className="sp-insight"><ExternalLink size={18}/><p>{mode === 'questions' ? hasExternalQuestionLink ? 'Ao iniciar, o Studio abre o link de questões cadastrado pelo professor.' : 'Não há link externo. O Studio usa automaticamente as questões internas deste assunto.' : subject?.lessonUrl ? 'Ao iniciar, a aula cadastrada pelo professor abre em uma nova aba.' : 'Sem aula externa, o Studio tenta usar o material interno do assunto.'}</p></div>
        </Card>

        <div className="sp-study-controls">
          {!active && !done && !finalizationPending && <button className="sp-primary" onClick={startSession}><Play size={16}/>Iniciar sessão</button>}
          {active && <button className="sp-secondary" onClick={pauseSession}><Pause size={16}/>Pausar</button>}
          {!done && elapsed > 0 && <button className="sp-primary" onClick={finishSession}><Check size={16}/>{mode === 'questions' || activeMode === 'questions' ? 'Finalizar sessão' : 'Concluir revisão'}</button>}
          {finalizationPending && <button className="sp-primary" onClick={() => onFinalize(savedSeconds)}><Check size={16}/>Continuar finalização</button>}
        </div>
      </div>
    </div>
  </>;
}

export default function ReviewsPagePremium() {
  const lab = useLab();
  const [filter, setFilter] = useState('Todas');
  const [workspace, setWorkspace] = useState<{ id: string; mode: ReviewMode } | null>(null);
  const [finalizing, setFinalizing] = useState<{ id: string; seconds: number } | null>(null);
  const shown = useMemo(() => reviewItems.filter(r => filter === 'Todas' || (filter === 'Concluídas' ? lab.completedReviews.includes(r.id) : r.status === filter && !lab.completedReviews.includes(r.id))), [filter, lab.completedReviews]);

  const bankRunningReview = (id: string) => {
    const saved = Number(lab.notes[`review-time:${id}`] ?? 0) || 0;
    const active = lab.notes[`review-active:${id}`];
    if (!active) return saved;
    const [, startedText] = active.split('|');
    const started = Number(startedText);
    if (!Number.isFinite(started)) return saved;
    const total = saved + Math.max(0, Math.floor((Date.now() - started) / 1000));
    lab.setNote(`review-time:${id}`, String(total));
    return total;
  };

  const concludeFromCard = (id: string) => {
    const pending = lab.notes[`review-finalizing:${id}`] === 'questions';
    if (pending) {
      setFinalizing({ id, seconds: Number(lab.notes[`review-time:${id}`] ?? 0) || 0 });
      return;
    }
    const active = lab.notes[`review-active:${id}`];
    if (!active) {
      const lastMode = lab.notes[`review-last-mode:${id}`] === 'questions' ? 'questions' : 'study';
      setWorkspace({ id, mode: lastMode });
      lab.notify('Abra a revisão e inicie uma sessão antes de concluir.');
      return;
    }
    const [mode] = active.split('|');
    const total = bankRunningReview(id);
    lab.setNote(`review-active:${id}`, '');
    if (mode === 'questions') {
      lab.setNote(`review-finalizing:${id}`, 'questions');
      setFinalizing({ id, seconds: total });
      return;
    }
    lab.completeReview(id);
  };

  if (workspace) {
    return <><ReviewWorkspace id={workspace.id} initialMode={workspace.mode} onBack={() => setWorkspace(null)} onFinalize={seconds => setFinalizing({ id: workspace.id, seconds })}/>{finalizing && <ReviewFinalizationModal id={finalizing.id} initialSeconds={finalizing.seconds} onClose={() => setFinalizing(null)} onSaved={() => { setFinalizing(null); setWorkspace(null); }}/>}</>;
  }

  return <>
    <PageTitle title="Revisões" subtitle="Relembrar no momento certo faz o conhecimento ficar."/>
    <div className="sp-metrics four">{[
      { title: 'Para hoje', filter: 'Hoje', icon: Clock3, tone: 'gold' },
      { title: 'Atrasadas', filter: 'Atrasadas', icon: RotateCcw, tone: 'red' },
      { title: 'Concluídas', filter: 'Concluídas', icon: CheckCheck, tone: 'green' },
      { title: 'Próximas', filter: 'Próximas', icon: CalendarDays, tone: 'blue' },
    ].map(item => <Metric key={item.filter} icon={<item.icon/>} label={item.title} tone={item.tone} value={String(item.filter === 'Concluídas' ? lab.completedReviews.length : reviewItems.filter(r => r.status === item.filter && !lab.completedReviews.includes(r.id)).length)} onClick={() => setFilter(item.filter)}/>)}</div>
    <Card title="Sua fila de revisão" subtitle="Entre na central para revisar por teoria ou questões.">
      <Tabs options={['Todas', 'Hoje', 'Atrasadas', 'Próximas', 'Concluídas']} value={filter} onChange={setFilter}/>
      <div className="sp-review-list">{shown.map(r => {
        const completed = lab.completedReviews.includes(r.id);
        const running = lab.notes[`review-active:${r.id}`];
        const runningMode = running?.split('|')[0];
        const finalizationPending = lab.notes[`review-finalizing:${r.id}`] === 'questions';
        return <div key={r.id} className="sp-review-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}><div className="sp-review-date"><b>{r.date.split(' ')[0]}</b><small>SET</small></div><div style={{ minWidth: 0 }}><span className={`sp-pill ${completed ? 'green' : r.status === 'Atrasadas' ? 'red' : ''}`}>{completed ? 'Concluída' : finalizationPending ? 'Finalização pendente' : runningMode === 'study' ? 'Teoria em andamento' : runningMode === 'questions' ? 'Questões em andamento' : r.status}</span><h3 style={{ marginTop: 8 }}>{r.title}</h3><p>{r.subject}</p></div></div>
          {completed ? <button className="sp-secondary" onClick={() => setWorkspace({ id: r.id, mode: 'study' })}>Ver revisão<ArrowRight size={15}/></button> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            <button className="sp-secondary" style={{ background: '#1769e8', borderColor: '#4385f0' }} onClick={() => setWorkspace({ id: r.id, mode: 'study' })}><Play size={16}/>Estudar</button>
            <button className="sp-secondary" style={{ background: '#7134df', borderColor: '#8d5cf0' }} onClick={() => setWorkspace({ id: r.id, mode: 'questions' })}><FileQuestion size={16}/>Questões</button>
            <button className="sp-secondary" style={{ background: '#138a49', borderColor: '#32a765' }} onClick={() => concludeFromCard(r.id)}><Check size={16}/>{finalizationPending ? 'Finalizar' : 'Concluir'}</button>
            <button className="sp-secondary" aria-label={`Mais opções para ${r.title}`} onClick={() => setWorkspace({ id: r.id, mode: runningMode === 'questions' ? 'questions' : 'study' })}>•••</button>
          </div>}
        </div>;
      })}</div>
      {!shown.length && <div className="sp-empty">Tudo em dia por aqui. Suas próximas revisões aparecerão nesta lista.</div>}
    </Card>
    {finalizing && <ReviewFinalizationModal id={finalizing.id} initialSeconds={finalizing.seconds} onClose={() => setFinalizing(null)} onSaved={() => setFinalizing(null)}/>} 
  </>;
}
