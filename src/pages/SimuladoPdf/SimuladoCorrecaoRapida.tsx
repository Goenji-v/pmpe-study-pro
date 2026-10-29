import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { calcularNotaLocal, lerGabarito, type FaixaMateria } from "../../utils/gabaritoLocal";

export default function SimuladoCorrecaoRapida() {
  const [total, setTotal] = useState(50);
  const [oficial, setOficial] = useState("");
  const [aluno, setAluno] = useState("");
  const [faixasTexto, setFaixasTexto] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const faixa = useMemo(() => faixasTexto.split("\\n").map(l => /^(\\d+)\\s*[-–]\\s*(\\d+)\\s+(.+)$/.exec(l.trim())).filter((m): m is RegExpExecArray => !!m).map(m => ({ inicio: Number(m[1]), fim: Number(m[2]), materia: m[3].trim() })), [faixasTexto]);
  const g = useMemo(() => lerGabarito(oficial, total), [oficial, total]);
  const a = useMemo(() => lerGabarito(aluno, total), [aluno, total]);
  const estruturaValida = !faixasTexto.trim() || (faixa.length > 0 && faixa.every((f: FaixaMateria) => f.inicio >= 1 && f.fim <= total && f.inicio <= f.fim) && new Set(faixa.flatMap(f => Array.from({length:f.fim-f.inicio+1},(_,i)=>f.inicio+i))).size === faixa.reduce((s,f)=>s+f.fim-f.inicio+1,0));
  const completo = g.faltantes.length === 0 && a.faltantes.length === 0 && !g.duplicadas.length && !a.duplicadas.length && !g.invalidas.length && !a.invalidas.length && estruturaValida;
  const nota = useMemo(() => completo && confirmado ? calcularNotaLocal(g.respostas,a.respostas,total,faixa) : null,[completo,confirmado,g,a,total,faixa]);
  return <main style={{maxWidth:850,margin:"0 auto",padding:24}}>
    <h1>Correção rápida do simulado</h1>
    <p>Resultado calculado neste aparelho, sem PDF, sem rede e sem IA. Questões anuladas no gabarito oficial não entram no total.</p>
    <Link to="/simulado-pdf">Usar análise por PDF (modo avançado)</Link>
    <p><label>Total de questões <input aria-label="Total de questões" type="number" min={1} max={200} value={total} onChange={e=>{setTotal(Math.max(1,Math.min(200,Number(e.target.value)||1)));setConfirmado(false);}} /></label></p>
    <div style={{display:"grid",gap:16}}>
      <label>Gabarito oficial<textarea aria-label="Gabarito oficial" rows={5} style={{display:"block",width:"100%"}} placeholder="1-A 2-B 3-C ou A B C" value={oficial} onChange={e=>{setOficial(e.target.value);setConfirmado(false);}} /></label>
      <label>Suas respostas<textarea aria-label="Suas respostas" rows={5} style={{display:"block",width:"100%"}} placeholder="1-A 2-N 3-C" value={aluno} onChange={e=>{setAluno(e.target.value);setConfirmado(false);}} /></label>
      <label>Matérias (opcional, uma por linha: 1-10 Português)<textarea aria-label="Faixas por matéria" rows={4} style={{display:"block",width:"100%"}} value={faixasTexto} onChange={e=>{setFaixasTexto(e.target.value);setConfirmado(false);}} /></label>
    </div>
    <h2>Prévia de conferência</h2>
    <p>Oficial: {g.respostas.size}/{total}; faltando {g.faltantes.join(", ")||"nenhuma"}; duplicadas {g.duplicadas.join(", ")||"nenhuma"}; inválidas {g.invalidas.join(", ")||"nenhuma"}.</p>
    <p>Aluno: {a.respostas.size}/{total}; faltando {a.faltantes.join(", ")||"nenhuma"}; duplicadas {a.duplicadas.join(", ")||"nenhuma"}; inválidas {a.invalidas.join(", ")||"nenhuma"}.</p>
    {!estruturaValida && <p role="alert">Verifique as faixas das matérias: há valores inválidos ou sobrepostos.</p>}
    <button type="button" disabled={!completo} onClick={()=>setConfirmado(true)}>Calcular minha nota</button>
    {nota && <section aria-live="polite"><h2>Resultado: {nota.percentual.toFixed(1)}%</h2><p>{nota.acertos} acertos · {nota.erros} erros · {nota.brancos} brancos · {nota.anuladas} anuladas</p><h3>Por matéria</h3>{nota.materias.map(m=><div key={m.materia} style={{marginBottom:14}}><strong>{m.materia}: {m.percentual.toFixed(1)}%</strong> ({m.acertos}/{m.validas})<div style={{height:12,background:"#d2d7e0",borderRadius:6}}><div style={{height:"100%",width:m.percentual+"%",background:"#257a96",borderRadius:6}} /></div></div>)}</section>}
  </main>;
}
