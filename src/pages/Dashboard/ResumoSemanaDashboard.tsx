import React from "react";
import type { ConfiguracoesApp, Materia, RegistroQuestao, Revisao, SessaoEstudo, Simulado } from "../../types/index";

type Props={materias:Materia[];questoes:RegistroQuestao[];sessoes:SessaoEstudo[];revisoes:Revisao[];simulados:Simulado[];configuracoes:ConfiguracoesApp;irPara:(rota:string)=>void};
function diaLocal(valor:string|Date){const data=new Date(valor);return Number.isNaN(data.getTime())?"":`${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,"0")}-${String(data.getDate()).padStart(2,"0")}`;}
export function gerarResumoSemanal(p:Omit<Props,"irPara">, hoje=new Date()){
 const inicio=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate());inicio.setDate(inicio.getDate() - ((inicio.getDay()+6)%7));
 const fim=new Date(inicio);fim.setDate(fim.getDate()+7);
 const pertence=(valor:string)=>{const d=new Date(valor);return !Number.isNaN(d.getTime())&&d>=inicio&&d<fim;};
 const sessoes=p.sessoes.filter(s=>pertence(s.data));
 const questoes=p.questoes.filter(q=>pertence(q.data));
 const totalMinutos=sessoes.reduce((n,s)=>n+Math.max(0,s.minutos||0),0);
 const feitas=questoes.reduce((n,q)=>n+Math.max(0,q.certas||0)+Math.max(0,q.erradas||0),0);
 const dias=new Set(sessoes.map(s=>diaLocal(s.data)));
 const porMateria=new Map<string,Set<string>>();
 for(const s of sessoes){const m=s.materia?.trim();if(m){const x=porMateria.get(m)??new Set<string>();x.add(diaLocal(s.data));porMateria.set(m,x);}}
 const atrasadas=p.revisoes.filter(r=>!r.concluida&&new Date(r.dataPrevista)<inicioDoDia(hoje)).length;
 const limite=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()-7);
 const semEstudo=p.materias.filter(m=>!p.sessoes.some(s=>(s.materiaId===m.id||s.materia===m.nome)&&new Date(s.data)>=limite)).map(m=>m.nome).slice(0,4);
 const provas=[...p.simulados].sort((a,b)=>new Date(b.data).getTime()-new Date(a.data).getTime());
 const taxa=(s:Simulado)=>{const n=s.certas+s.erradas;return n?Math.round(100*s.certas/n):null;};
 const ultimo=provas[0]?taxa(provas[0]):null, anterior=provas[1]?taxa(provas[1]):null;
 const prioridades:{texto:string;rota:string}[]=[];
 if(atrasadas)prioridades.push({texto:`Resolver ${atrasadas} revisão(ões) atrasada(s)`,rota:"/revisoes"});
 if(semEstudo.length)prioridades.push({texto:`Retomar ${semEstudo[0]} (7 dias sem estudo)`,rota:"/materias"});
 if(totalMinutos<7*p.configuracoes.metaMinutosDiaria)prioridades.push({texto:"Reservar um bloco para a meta de estudo",rota:"/central-estudos"});
 if(feitas<7*p.configuracoes.metaQuestoesDiaria)prioridades.push({texto:"Resolver questões para aproximar-se da meta",rota:"/questoes"});
 prioridades.push({texto:"Manter a próxima missão do plano",rota:"/plano"});
 return {inicio:diaLocal(inicio),fim:diaLocal(new Date(fim.getTime()-86400000)),totalMinutos,metaMinutos:7*p.configuracoes.metaMinutosDiaria,feitas,metaQuestoes:7*p.configuracoes.metaQuestoesDiaria,dias:dias.size,porMateria:[...porMateria].map(([nome,set])=>({nome,dias:set.size})),atrasadas,semEstudo,ultimo,anterior,prioridades:prioridades.slice(0,3)};
}
function inicioDoDia(d:Date){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
export default function ResumoSemanaDashboard({irPara,...dados}:Props){
 const r=React.useMemo(()=>gerarResumoSemanal(dados),[dados.materias,dados.questoes,dados.sessoes,dados.revisoes,dados.simulados,dados.configuracoes]);
 return <section aria-label="Resumo da semana" style={{padding:"18px",border:"1px solid var(--border-color, #9995)",borderRadius:16,margin:"16px 0"}}>
 <h2>Resumo da semana</h2><p>{r.inicio} a {r.fim} · calculado localmente, sem IA</p>
 <p><strong>Estudo:</strong> {Math.round(r.totalMinutos/60*10)/10}h / {Math.round(r.metaMinutos/60*10)/10}h planejadas</p>
 <p><strong>Questões:</strong> {r.feitas} / {r.metaQuestoes} planejadas · <strong>Dias estudados:</strong> {r.dias}/7</p>
 <p><strong>Revisões atrasadas:</strong> {r.atrasadas} · <strong>Sem estudo há 7 dias:</strong> {r.semEstudo.length?r.semEstudo.join(", "):"Nenhuma identificada"}</p>
 <p><strong>Último simulado:</strong> {r.ultimo===null?"Sem resultado":`${r.ultimo}%`}{r.anterior===null?"":` · anterior: ${r.anterior}%`}</p>
 <h3>Dias estudados por matéria</h3><p>{r.porMateria.length?r.porMateria.map(x=>`${x.nome}: ${x.dias} dia(s)`).join(" · "):"Ainda sem sessões nesta semana."}</p>
 <h3>Três prioridades para amanhã</h3><ol>{r.prioridades.map((p,i)=><li key={i}><button type="button" onClick={()=>irPara(p.rota)}>{p.texto}</button></li>)}</ol>
 </section>;
}
