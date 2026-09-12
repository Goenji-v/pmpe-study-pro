import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { weekly, type DemoTask } from './demoData';

export function Logo({ large = false }: { large?: boolean }) {
  const id = useId();
  return <div className={`sp-brand ${large ? 'large' : ''}`}><svg viewBox="0 0 60 70" aria-hidden="true"><defs><linearGradient id={id} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#A76F14"/><stop offset=".45" stopColor="#FFE5A2"/><stop offset="1" stopColor="#C98C20"/></linearGradient></defs><path d="M30 3 55 12v22c0 15-12 25-25 33C17 59 5 49 5 34V12Z" fill="#0b1d31" stroke={`url(#${id})`} strokeWidth="2"/><path d="m30 9 19 8v17c0 12-9 21-19 27-10-6-19-15-19-27V17Z" fill="none" stroke={`url(#${id})`} strokeOpacity=".35"/><path d="M41 24H24l-5 5 20 10v6l-5 5H19v-7h15L14 33v-6l7-9h20Z" fill={`url(#${id})`}/></svg><div><strong>STUDIO <em>PRO</em></strong><small>ESTUDO HOJE. CONQUISTA SEMPRE.</small></div></div>;
}
export function Progress({ value, label = 'Progresso' }: { value: number; label?: string }) {
  return <div className="sp-progress" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${value}%` }}/></div>;
}
export function Card({ title, subtitle, action, children, className = '' }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`sp-card ${className}`}>{title && <header className="sp-card-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>}{children}</section>;
}
export function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="sp-page-heading"><div><span className="sp-eyebrow">SEU CAMINHO ATÉ A APROVAÇÃO</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
export function Metric({ icon, value, label, hint, tone = 'blue', onClick }: { icon: ReactNode; value: string; label: string; hint?: string; tone?: string; onClick?: () => void }) {
  const body = <><span className={`sp-icon ${tone}`}>{icon}</span><span className="sp-metric-content"><small>{label}</small><strong>{value}</strong>{hint && <em>{hint}</em>}</span>{onClick && <ArrowUpRight className="sp-metric-arrow" size={14}/>}</>;
  return onClick ? <button className="sp-metric" onClick={onClick}>{body}</button> : <div className="sp-metric">{body}</div>;
}
export function Tabs({ options, value, onChange, label = 'Filtrar' }: { options: readonly string[]; value: string; onChange: (value: string) => void; label?: string }) {
  const visibleOptions = options.filter(option => option !== 'Videoaulas');
  return <div className="sp-tabs" role="group" aria-label={label}>{visibleOptions.map(option => <button key={option} aria-pressed={value === option} className={value === option ? 'active' : ''} onClick={() => onChange(option)}>{option}</button>)}</div>;
}
export function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="sp-select"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select></label>;
}
export function Donut({ value = 78, review = 18 }: { value?: number; review?: number }) {
  const error = Math.max(0, 100 - value - review);
  return <div className="sp-performance"><div className="sp-donut" role="img" aria-label={`${value}% acertos, ${review}% em revisão, ${error}% erros`} style={{ background: `conic-gradient(#1687ff 0 ${value}%, #efc56b ${value}% ${value + review}%, #ff5d61 ${value + review}% 100%)` }}><div><strong>{value}<small>%</small></strong><span>APROVEITAMENTO</span></div></div><div className="sp-legend">{[['Acertos', value, 'blue'], ['Em revisão', review, 'gold'], ['Erros', error, 'red']].map(([label, amount, color]) => <div key={label}><i className={String(color)}/><span>{label}</span><b>{amount}%</b></div>)}</div></div>;
}
const tooltipStyle = { background: '#10243a', border: '1px solid #35516c', borderRadius: 10, color: '#f6f8fc', fontSize: 12 };
export function WeeklyChart() {
  const [period, setPeriod] = useState('Esta semana');
  const data = weekly.map(row => ({ ...row, hours: period === 'Esta semana' ? row.hours : Math.round(row.hours * .75 * 10) / 10, questions: period === 'Esta semana' ? row.questions : Math.round(row.questions * .7) }));
  return <Card title="Meu progresso semanal" subtitle="Cada sessão conta para a sua conquista." action={<Select label="Período do gráfico" value={period} options={['Esta semana', 'Semana anterior']} onChange={setPeriod}/>}><div className="sp-chart-key"><span><i className="blue"/>Tempo estudado (h)</span><span><i className="gold"/>Questões</span></div><div className="sp-chart" role="img" aria-label={`Tempo de estudo e questões por dia: ${period}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} barGap={4} margin={{ left: -22, right: -22, top: 12, bottom: 0 }}><CartesianGrid stroke="#1c3248" vertical={false}/><XAxis dataKey="day" tick={{ fill: '#9aadc1', fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis yAxisId="hours" domain={[0, 5]} tick={{ fill: '#8598ae', fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis yAxisId="questions" orientation="right" domain={[0, 80]} tick={{ fill: '#8598ae', fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff04' }}/><Bar yAxisId="hours" dataKey="hours" name="Tempo (h)" fill="#1687ff" radius={[4, 4, 0, 0]} maxBarSize={15} isAnimationActive={false}/><Bar yAxisId="questions" dataKey="questions" name="Questões" fill="#e4bd6c" radius={[4, 4, 0, 0]} maxBarSize={15} isAnimationActive={false}/></BarChart></ResponsiveContainer></div></Card>;
}
export function EvolutionChart({ values = [62, 67, 65, 71, 73, 76, 78, 82] }: { values?: number[] }) {
  return <div className="sp-chart" role="img" aria-label={`Evolução do aproveitamento: ${values.join(', ')} por cento`}><ResponsiveContainer width="100%" height="100%"><LineChart data={values.map((score, i) => ({ day: `${i + 1}`, score }))} margin={{ left: -18, right: 10, top: 16 }}><CartesianGrid stroke="#1c3248" vertical={false}/><XAxis dataKey="day" tick={{ fill: '#9aadc1', fontSize: 11 }} tickLine={false} axisLine={false}/><YAxis domain={[0, 100]} tick={{ fill: '#9aadc1', fontSize: 10 }} tickFormatter={n => `${n}%`} tickLine={false} axisLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Aproveitamento']} labelFormatter={l => `Período ${l}`}/><Line dataKey="score" stroke="#eac36f" strokeWidth={3} dot={{ r: 4, fill: '#0b1a2d', strokeWidth: 2 }} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>;
}
export function Calendar({ selected, onSelect, tasks }: { selected: string; onSelect: (date: string) => void; tasks: DemoTask[] }) {
  const [month, setMonth] = useState(() => new Date(2026, 8, 1));
  const start = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dateKey = (day: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return <div className="sp-calendar"><div className="sp-calendar-title"><strong>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong><div><button className="sp-icon-button" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16}/></button><button className="sp-icon-button" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16}/></button></div></div><div className="sp-calendar-grid">{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day, index) => <small key={index}>{day}</small>)}{Array.from({ length: start }, (_, i) => <span key={`blank${i}`}/>)}{Array.from({ length: days }, (_, i) => i + 1).map(day => <button key={day} aria-label={new Date(month.getFullYear(), month.getMonth(), day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} aria-pressed={dateKey(day) === selected} className={`${dateKey(day) === selected ? 'selected' : ''} ${dateKey(day) === '2026-09-11' ? 'today' : ''}`} onClick={() => onSelect(dateKey(day))}>{day}{tasks.some(task => task.date === dateKey(day)) && <i/>}</button>)}</div><div className="sp-calendar-foot"><span><i/>Dia com atividade</span><button className="sp-text-button" onClick={() => { setMonth(new Date(2026, 8, 1)); onSelect('2026-09-11'); }}>Hoje</button></div></div>;
}
export function Tasks({ tasks, toggle, date, add }: { tasks: DemoTask[]; toggle: (id: string) => void; date: string; add: () => void }) {
  const shown = tasks.filter(task => task.date === date);
  return <div className="sp-task-list"><div className="sp-section-line"><h3>{date === '2026-09-11' ? 'Tarefas de hoje' : `Tarefas • ${date.slice(8)}/${date.slice(5, 7)}`}</h3><button className="sp-icon-button" aria-label="Adicionar tarefa" onClick={add}><Plus size={17}/></button></div><p className="sp-muted">{shown.filter(task => task.done).length} de {shown.length} concluídas</p>{shown.length === 0 ? <div className="sp-empty">Seu dia está livre.<br/>Adicione uma nova atividade.</div> : shown.map(task => <label className={`sp-task ${task.done ? 'done' : ''}`} key={task.id}><input type="checkbox" checked={task.done} onChange={() => toggle(task.id)}/><span><b>{task.title}</b><small>{task.time} · {task.subject}</small></span></label>)}</div>;
}
export function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`sp-modal ${wide ? 'wide' : ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}><div className="sp-modal-inner"><header><div><span className="sp-eyebrow">STUDIO PRO · DEMONSTRAÇÃO</span><h2 id={titleId}>{title}</h2></div><button className="sp-icon-button" aria-label="Fechar" onClick={close}><X size={20}/></button></header>{children}</div></dialog>;
}
