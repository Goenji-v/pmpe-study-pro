import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, CheckCheck, Clock3, ExternalLink, FileQuestion, FileText, Pause, Play, RotateCcw } from 'lucide-react';
import { Card, Metric, Modal, PageTitle, Tabs } from './DemoUI';
import { materials, questions, reviewItems, subjects } from './demoData';
import { useLab } from './demoState';

type ReviewMode = 'study' | 'questions';
type ReviewEvaluation = 'facil' | 'media' | 'dificil';
type ActivityType = 'lesson' | 'review';

const moduleBySubject: Record<string, string> = {
  'Português': 'Módulo 2 · Classes de Palavras',
  'Raciocínio Lógico': 'Geral',
  'Direito Constitucional': 'Módulo 1 · Fundamentos',
  'Direitos Humanos': 'Módulo 1 · Fundamentos',
  'Legislação PMPE': 'Módulo 1 · Legislação',
  'História de Pernambuco': 'Módulo 1 · Formação histórica',
};

const examBoards = ['IBFC', 'Vunesp', 'Cebraspe', 'FGV', 'FCC', 'Instituto AOCP', 'Idecan', 'IADES', 'Quadrix', 'Consulplan'];
const customBoardPrefix = 'Personalizada:';
const customTopicValue = '__custom__';

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
  const isCustomBoard = board.startsWith(customBoardPrefix);
  const customBoardName = isCustomBoard ? board.slice(customBoardPrefix.length) : '';
  const resolvedBoard = isCustomBoard ? customBoardName.trim() : board.trim();

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
    if (isCustomBoard && !resolvedBoard) {
      lab.notify('Digite o nome da banca personalizada antes de salvar.');
      return;
    }

    const result = {
      mode: 'questions', minutes: Math.round(realMinutes), questions: total, correct, errors,
      board: resolvedBoard, evaluation, percentage, stage: currentStage,
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
      <label className="sp-field"><span>Banca</span><select value={isCustomBoard ? 'Personalizada' : board} onChange={event => setBoard(event.target.value === 'Personalizada' ? customBoardPrefix : event.target.value)}><option value="">Selecione a banca</option>{examBoards.map(name => <option key={name} value={name}>{name}</option>)}<option value="Personalizada">Personalizada</option></select>{isCustomBoard && <input autoFocus value={customBoardName} onChange={event => setBoard(`${customBoardPrefix}${event.target.value}`)} placeholder="Digite o nome da banca"/>}<small>{isCustomBoard ? 'O nome digitado será salvo como a banca desta sessão.' : 'Seleção padronizada para evitar nomes duplicados.'}</small></label>
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
  const currentStage = Math.min(4, Math.max(1, Number(lab.notes[`review-stage:${id}`] ?? 1) || 1));

  const [activityType, setActivityType] = useState<ActivityType>('review');
  const [mode, setMode] = useState<ReviewMode>(initialMode);
  const [objective, setObjective] = useState(`Revisar ${item.title}`);
  const [observation, setObservation] = useState(`Revisão etapa ${currentStage}`);
  const [now, setNow] = useState(Date.now());

  const [lessonSubjectName, setLessonSubjectName] = useState(item.subject);
  const [lessonModule, setLessonModule] = useState(moduleBySubject[item.subject] ?? 'Geral');
  const [lessonTopicSelection, setLessonTopicSelection] = useState(item.title);
  const [lessonCustomTopic, setLessonCustomTopic] = useState('');
  const [lessonObjective, setLessonObjective] = useState(`Estudar ${item.title}`);
  const [lessonObservation, setLessonObservation] = useState(`Etapa ${currentStage} · conteúdo sugerido pelo cronograma.`);
  const [lessonSavedSeconds, setLessonSavedSeconds] = useState(Number(lab.notes[`lesson-time:${id}`] ?? 0) || 0);
  const [lessonStartedAt, setLessonStartedAt] = useState<number | null>(null);
  const [lessonFinished, setLessonFinished] = useState(Boolean(lab.notes[`lesson-session:${id}`]));

  useEffect(() => setMode(initialMode), [id, initialMode]);
  useEffect(() => {
    const reviewActive = lab.notes[`review-active:${id}`];
    if (!reviewActive && !lessonStartedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [id, lab.notes, lessonStartedAt]);

  const active = lab.notes[`review-active:${id}`];
  const [activeMode, activeStartedText] = active ? active.split('|') : ['', ''];
  const activeStarted = Number(activeStartedText);
  const savedSeconds = Number(lab.notes[`review-time:${id}`] ?? 0) || 0;
  const liveSeconds = active && Number.isFinite(activeStarted) ? Math.max(0, Math.floor((now - activeStarted) / 1000)) : 0;
  const elapsed = savedSeconds + liveSeconds;
  const done = lab.completedReviews.includes(id);
  const finalizationPending = lab.notes[`review-finalizing:${id}`] === 'questions';
  const internalQuestions = questions.filter(question => question.subject === item.subject);
  const linkedMaterials = materials.filter(material => material.subject === item.subject);

  const selectedLessonSubject = subjects.find(entry => entry.name === lessonSubjectName);
  const lessonModules = lessonSubjectName ? [moduleBySubject[lessonSubjectName] ?? 'Geral'] : [];
  const lessonTopics = Array.from(new Set([
    selectedLessonSubject?.topic,
    selectedLessonSubject?.last,
    ...reviewItems.filter(review => review.subject === lessonSubjectName).map(review => review.title),
  ].filter(Boolean) as string[]));
  const isCustomLessonTopic = lessonTopicSelection === customTopicValue;
  const resolvedLessonTopic = isCustomLessonTopic ? lessonCustomTopic.trim() : lessonTopicSelection;
  const lessonLinkedMaterials = materials.filter(material => material.subject === lessonSubjectName);
  const lessonInternalQuestions = questions.filter(question => question.subject === lessonSubjectName);
  const lessonLiveSeconds = lessonStartedAt ? Math.max(0, Math.floor((now - lessonStartedAt) / 1000)) : 0;
  const lessonElapsed = lessonSavedSeconds + lessonLiveSeconds;

  const bankReview = () => {
    if (!active || !Number.isFinite(activeStarted)) return savedSeconds;
    const total = savedSeconds + Math.max(0, Math.floor((Date.now() - activeStarted) / 1000));
    lab.setNote(`review-time:${id}`, String(total));
    return total;
  };

  const bankLesson = () => {
    if (!lessonStartedAt) return lessonSavedSeconds;
    const total = lessonSavedSeconds + Math.max(0, Math.floor((Date.now() - lessonStartedAt) / 1000));
    setLessonSavedSeconds(total);
    setLessonStartedAt(null);
    lab.setNote(`lesson-time:${id}`, String(total));
    return total;
  };

  const openLessonResource = (targetSubject = subject, targetMaterials = linkedMaterials) => {
    if (targetSubject?.lessonUrl) {
      window.open(targetSubject.lessonUrl, '_blank', 'noopener,noreferrer');
      lab.notify('Aula aberta em outra aba. O cronômetro desta sessão continua no Studio Pro.');
      return;
    }
    if (targetMaterials[0]) {
      lab.open({ kind: 'material', material: targetMaterials[0] });
      lab.notify('Sem link de videoaula. Abrindo o material interno vinculado.');
      return;
    }
    lab.notify('Ainda não há link de aula ou material vinculado a este conteúdo.');
  };

  const openQuestionResource = (targetSubject = subject, targetQuestions = internalQuestions) => {
    if (targetSubject?.questionsUrl?.trim()) {
      window.open(targetSubject.questionsUrl, '_blank', 'noopener,noreferrer');
      lab.notify('Link externo de questões aberto. O cronômetro continua no Studio Pro.');
      return;
    }
    if (targetQuestions.length > 0) {
      lab.open({ kind: 'quiz', items: targetQuestions });
      lab.notify('Sem link externo. Abrindo as questões deste conteúdo no banco do Studio Pro.');
      return;
    }
    lab.go('questoes');
    lab.notify('Sem link externo para este conteúdo. Abrindo o banco de questões do Studio Pro.');
  };

  const startReview = () => {
    if (done) return;
    lab.setNote(`review-finalizing:${id}`, '');
    lab.setNote(`review-last-mode:${id}`, mode);
    lab.setNote(`review-objective:${id}`, objective.trim());
    lab.setNote(`review-observation:${id}`, observation.trim());
    lab.setNote(`review-active:${id}`, `${mode}|${Date.now()}`);
    setNow(Date.now());
    lab.notify(`Revisão por ${mode === 'questions' ? 'questões' : 'teoria'} iniciada. Escolha abaixo o recurso que deseja abrir.`);
  };

  const pauseReview = () => {
    if (!active) return;
    bankReview();
    lab.setNote(`review-active:${id}`, '');
    lab.notify('Revisão pausada. O tempo acumulado foi salvo.');
  };

  const finishReview = () => {
    const runningMode = activeMode || lab.notes[`review-last-mode:${id}`] || mode;
    const total = active ? bankReview() : savedSeconds;
    lab.setNote(`review-active:${id}`, '');
    if (runningMode === 'questions') {
      lab.setNote(`review-finalizing:${id}`, 'questions');
      onFinalize(total);
      return;
    }
    lab.completeReview(id);
    lab.notify('Revisão por teoria concluída. O tempo foi registrado como revisão.');
    onBack();
  };

  const changeActivity = (next: ActivityType) => {
    if (next === activityType) return;
    if (active || lessonStartedAt) {
      lab.notify('Pause a sessão atual antes de trocar o tipo de atividade.');
      return;
    }
    setActivityType(next);
  };

  const changeLessonSubject = (name: string) => {
    setLessonSubjectName(name);
    const nextSubject = subjects.find(entry => entry.name === name);
    const nextModule = name ? moduleBySubject[name] ?? 'Geral' : '';
    const nextTopic = nextSubject?.topic ?? '';
    setLessonModule(nextModule);
    setLessonTopicSelection(nextTopic);
    setLessonCustomTopic('');
    setLessonObjective(nextTopic ? `Estudar ${nextTopic}` : '');
    setLessonObservation(name ? `Etapa ${currentStage} · conteúdo selecionado em ${name}.` : '');
    setLessonSavedSeconds(0);
    setLessonStartedAt(null);
    setLessonFinished(false);
    lab.setNote(`lesson-time:${id}`, '0');
    lab.setNote(`lesson-session:${id}`, '');
  };

  const changeLessonTopic = (value: string) => {
    setLessonTopicSelection(value);
    setLessonCustomTopic('');
    setLessonObjective(value === customTopicValue ? '' : value ? `Estudar ${value}` : '');
    setLessonFinished(false);
  };

  const startLesson = () => {
    if (!lessonSubjectName || !lessonModule || !resolvedLessonTopic) {
      lab.notify('Selecione matéria, módulo e assunto antes de iniciar a aula.');
      return;
    }
    setLessonStartedAt(Date.now());
    setLessonFinished(false);
    setNow(Date.now());
    lab.setNote(`lesson-draft:${id}`, JSON.stringify({ subject: lessonSubjectName, module: lessonModule, topic: resolvedLessonTopic, objective: lessonObjective.trim(), observation: lessonObservation.trim() }));
    lab.notify('Aula iniciada. O cronômetro está contando; abra a videoaula ou as questões pelos botões de atividades vinculadas.');
  };

  const pauseLesson = () => {
    if (!lessonStartedAt) return;
    bankLesson();
    lab.notify('Aula pausada. O tempo acumulado foi salvo como tempo de aula.');
  };

  const finishLesson = () => {
    const total = bankLesson();
    if (total <= 0) return;
    lab.setNote(`lesson-session:${id}`, JSON.stringify({ subject: lessonSubjectName, module: lessonModule, topic: resolvedLessonTopic, objective: lessonObjective.trim(), observation: lessonObservation.trim(), seconds: total, savedAt: new Date().toISOString() }));
    setLessonFinished(true);
    lab.notify('Aula finalizada. O tempo foi registrado separadamente como aula.');
  };

  const AccessButtons = ({ targetSubject, targetMaterials, targetQuestions }: { targetSubject?: typeof subjects[number]; targetMaterials: typeof materials[number][]; targetQuestions: typeof questions[number][] }) => <div className="sp-grid two" style={{ gap: 10, marginBottom: 16 }}>
    <button type="button" className="sp-secondary" onClick={() => openLessonResource(targetSubject, targetMaterials)}><BookOpen size={17}/><span style={{ textAlign: 'left' }}><b>Abrir aula</b><small style={{ display: 'block' }}>{targetSubject?.lessonUrl ? 'Videoaula vinculada ao curso' : targetMaterials.length ? 'Material interno vinculado' : 'Aguardando link da aula'}</small></span><ExternalLink size={14}/></button>
    <button type="button" className="sp-secondary" onClick={() => openQuestionResource(targetSubject, targetQuestions)}><FileQuestion size={17}/><span style={{ textAlign: 'left' }}><b>Resolver questões</b><small style={{ display: 'block' }}>{targetSubject?.questionsUrl?.trim() ? 'Link externo cadastrado' : 'Banco de questões do Studio Pro'}</small></span><ArrowRight size={14}/></button>
  </div>;

  return <>
    <PageTitle title="Central da revisão" subtitle="Inicie o cronômetro no Studio Pro e abra os recursos separadamente, sem sair do controle da sessão." action={<button className="sp-secondary" onClick={onBack}><ArrowLeft size={16}/>Voltar para revisões</button>}/>
    <div className="sp-grid two" style={{ alignItems: 'start' }}>
      <Card title="Tipo de atividade" subtitle="Aula registra tempo de aula; Revisão registra tempo e conclusão de revisão.">
        <div className="sp-button-row" style={{ marginBottom: 18 }}>
          <button type="button" className={activityType === 'lesson' ? 'sp-primary' : 'sp-secondary'} onClick={() => changeActivity('lesson')}><BookOpen size={16}/>Aula</button>
          <button type="button" className={activityType === 'review' ? 'sp-primary' : 'sp-secondary'} onClick={() => changeActivity('review')}><RotateCcw size={16}/>Revisão</button>
        </div>

        {activityType === 'lesson' ? <div className="sp-form">
          <label className="sp-field"><span>Matéria</span><select value={lessonSubjectName} onChange={event => changeLessonSubject(event.target.value)} disabled={Boolean(lessonStartedAt)}><option value="">Selecione a matéria</option>{subjects.map(entry => <option key={entry.id} value={entry.name}>{entry.name}</option>)}</select></label>
          <label className="sp-field"><span>Módulo</span><select value={lessonModule} onChange={event => setLessonModule(event.target.value)} disabled={!lessonSubjectName || Boolean(lessonStartedAt)}><option value="">{lessonSubjectName ? 'Selecione o módulo' : 'Selecione primeiro a matéria'}</option>{lessonModules.map(module => <option key={module} value={module}>{module}</option>)}</select></label>
          <label className="sp-field"><span>Assunto</span><select value={lessonTopicSelection} onChange={event => changeLessonTopic(event.target.value)} disabled={!lessonSubjectName || Boolean(lessonStartedAt)}><option value="">{lessonSubjectName ? 'Selecione o assunto' : 'Selecione primeiro a matéria'}</option>{lessonTopics.map(topic => <option key={topic} value={topic}>{topic}</option>)}<option value={customTopicValue}>Personalizar assunto</option></select>{isCustomLessonTopic && <input autoFocus value={lessonCustomTopic} onChange={event => setLessonCustomTopic(event.target.value)} disabled={Boolean(lessonStartedAt)} placeholder="Digite um assunto que não está no edital"/>}<small>{isCustomLessonTopic ? 'Esse nome será usado como assunto personalizado desta aula.' : 'Se o assunto não existir no edital, escolha “Personalizar assunto”.'}</small></label>
          <label className="sp-field"><span>Objetivo <small>(opcional)</small></span><input value={lessonObjective} onChange={event => setLessonObjective(event.target.value)} disabled={Boolean(lessonStartedAt)} placeholder="Objetivo da sessão"/></label>
          <label className="sp-field"><span>Observações <small>(opcional)</small></span><textarea rows={4} value={lessonObservation} onChange={event => setLessonObservation(event.target.value)} disabled={Boolean(lessonStartedAt)} placeholder="Anotações sobre a sessão..."/></label>
        </div> : <div className="sp-form">
          <label className="sp-field"><span>Matéria</span><input value={item.subject} readOnly/></label>
          <label className="sp-field"><span>Módulo</span><input value={moduleBySubject[item.subject] ?? 'Geral'} readOnly/></label>
          <label className="sp-field"><span>Assunto</span><input value={item.title} readOnly/></label>
          <div className="sp-field"><span>Formato da revisão</span><div className="sp-study-controls"><button type="button" className={mode === 'study' ? 'sp-primary' : 'sp-secondary'} disabled={Boolean(active)} onClick={() => setMode('study')}><BookOpen size={16}/>Teoria</button><button type="button" className={mode === 'questions' ? 'sp-primary' : 'sp-secondary'} disabled={Boolean(active)} onClick={() => setMode('questions')}><FileQuestion size={16}/>Questões</button></div><small>{mode === 'study' ? 'Releitura, aula, resumo ou material vinculado.' : 'Questões externas quando houver link; caso contrário, banco interno do Studio Pro.'}</small></div>
          <label className="sp-field"><span>Objetivo <small>(opcional)</small></span><input value={objective} onChange={event => setObjective(event.target.value)} disabled={Boolean(active)}/></label>
          <label className="sp-field"><span>Observações <small>(opcional)</small></span><textarea rows={4} value={observation} onChange={event => setObservation(event.target.value)} disabled={Boolean(active)}/></label>
        </div>}
      </Card>

      {activityType === 'lesson' ? <div style={{ display: 'grid', gap: 18 }}>
        <Card title={lessonFinished ? 'Aula finalizada' : lessonStartedAt ? 'Aula em andamento' : lessonElapsed > 0 ? 'Aula pausada' : 'Pronto para iniciar'} subtitle="Tempo registrado como aula">
          <div style={{ textAlign: 'center', padding: '14px 0 20px' }}><div style={{ fontSize: 'clamp(40px,6vw,68px)', fontWeight: 800, letterSpacing: 2 }}>{formatElapsed(lessonElapsed)}</div><small className="sp-muted">{lessonStartedAt ? 'cronômetro em andamento' : lessonElapsed > 0 ? 'tempo acumulado da aula' : 'o tempo só começa ao iniciar a sessão'}</small></div>
          <div className="sp-subject-detail" style={{ textAlign: 'center' }}><span className="sp-pill">AULA</span><h3 style={{ marginTop: 10 }}>{lessonSubjectName || 'Selecione uma matéria'}</h3><p>{lessonModule || 'Selecione o módulo'}</p><p>{resolvedLessonTopic || 'Selecione o assunto'}</p>{lessonObjective && <p><strong>Objetivo:</strong> {lessonObjective}</p>}</div>
        </Card>
        <Card title="Atividades e materiais vinculados" subtitle={lessonSubjectName ? `${lessonSubjectName} → ${lessonModule || 'Módulo'} → ${resolvedLessonTopic || 'Assunto'}` : 'Selecione a matéria para ver os recursos'} action={<button className="sp-secondary" onClick={() => lab.go('materiais')}>Centro de Materiais</button>}>
          <AccessButtons targetSubject={selectedLessonSubject} targetMaterials={lessonLinkedMaterials} targetQuestions={lessonInternalQuestions}/>
          {lessonLinkedMaterials.length ? <div className="sp-list">{lessonLinkedMaterials.map(material => <button className="sp-list-row" key={material.id} onClick={() => lab.open({ kind: 'material', material })}><FileText size={18}/><span><b>{material.title}</b><small>{material.type}</small></span><ArrowRight size={15}/></button>)}</div> : <div className="sp-empty">Nenhum material extra foi cadastrado para esta matéria.</div>}
        </Card>
        <div className="sp-study-controls">
          {!lessonStartedAt && !lessonFinished && <button className="sp-primary" onClick={startLesson}><Play size={16}/>{lessonElapsed > 0 ? 'Retomar aula' : 'Iniciar sessão'}</button>}
          {lessonStartedAt && <button className="sp-secondary" onClick={pauseLesson}><Pause size={16}/>Pausar</button>}
          {!lessonFinished && lessonElapsed > 0 && <button className="sp-primary" onClick={finishLesson}><Check size={16}/>Finalizar aula</button>}
          {lessonFinished && <button className="sp-secondary" onClick={() => { setLessonSavedSeconds(0); setLessonFinished(false); lab.setNote(`lesson-time:${id}`, '0'); lab.setNote(`lesson-session:${id}`, ''); }}><RotateCcw size={16}/>Nova sessão</button>}
        </div>
      </div> : <div style={{ display: 'grid', gap: 18 }}>
        <Card title={done ? 'Revisão concluída' : finalizationPending ? 'Finalização pendente' : active ? 'Revisão em andamento' : 'Pronto para iniciar'} subtitle={`Tempo registrado como revisão · Etapa ${currentStage}`}>
          <div style={{ textAlign: 'center', padding: '14px 0 20px' }}><div style={{ fontSize: 'clamp(40px,6vw,68px)', fontWeight: 800, letterSpacing: 2 }}>{formatElapsed(elapsed)}</div><small className="sp-muted">{active ? 'cronômetro em andamento' : elapsed > 0 ? 'tempo acumulado da revisão' : 'o tempo só começa ao iniciar a sessão'}</small></div>
          <div className="sp-subject-detail" style={{ textAlign: 'center' }}><span className="sp-pill">REVISÃO · {mode === 'study' ? 'TEORIA' : 'QUESTÕES'}</span><h3 style={{ marginTop: 10 }}>{item.subject}</h3><p>{moduleBySubject[item.subject] ?? 'Geral'}</p><p>{item.title}</p><p><strong>Objetivo:</strong> {objective || `Revisar ${item.title}`}</p></div>
        </Card>
        <Card title="Atividades e materiais vinculados" subtitle={`${item.subject} → ${moduleBySubject[item.subject] ?? 'Geral'} → ${item.title}`} action={<button className="sp-secondary" onClick={() => lab.go('materiais')}>Centro de Materiais</button>}>
          <AccessButtons targetSubject={subject} targetMaterials={linkedMaterials} targetQuestions={internalQuestions}/>
          {linkedMaterials.length ? <div className="sp-list">{linkedMaterials.map(material => <button className="sp-list-row" key={material.id} onClick={() => lab.open({ kind: 'material', material })}><FileText size={18}/><span><b>{material.title}</b><small>{material.type}</small></span><ArrowRight size={15}/></button>)}</div> : <div className="sp-empty">Nenhum material extra foi cadastrado para este assunto.</div>}
        </Card>
        <div className="sp-study-controls">
          {!active && !done && !finalizationPending && <button className="sp-primary" onClick={startReview}><Play size={16}/>Iniciar sessão</button>}
          {active && <button className="sp-secondary" onClick={pauseReview}><Pause size={16}/>Pausar</button>}
          {!done && elapsed > 0 && <button className="sp-primary" onClick={finishReview}><Check size={16}/>{mode === 'questions' || activeMode === 'questions' ? 'Finalizar sessão' : 'Concluir revisão'}</button>}
          {finalizationPending && <button className="sp-primary" onClick={() => onFinalize(savedSeconds)}><Check size={16}/>Continuar finalização</button>}
        </div>
      </div>}
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
    ].map(metric => <Metric key={metric.filter} icon={<metric.icon/>} label={metric.title} tone={metric.tone} value={String(metric.filter === 'Concluídas' ? lab.completedReviews.length : reviewItems.filter(r => r.status === metric.filter && !lab.completedReviews.includes(r.id)).length)} onClick={() => setFilter(metric.filter)}/>)}</div>
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
