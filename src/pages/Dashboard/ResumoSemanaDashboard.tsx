import type { ConfiguracoesApp, Materia, RegistroQuestao, Revisao, SessaoEstudo, Simulado } from "../../types/index";

type Props={materias:Materia[];questoes:RegistroQuestao[];sessoes:SessaoEstudo[];revisoes:Revisao[];simulados:Simulado[];configuracoes:ConfiguracoesApp;irPara:(rota:string)=>void};
function diaLocal(valor:string|Date){const data=new Date(valor);return Number.isNaN(data.getTime())?"":`${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,"0")}-${String(data.getDate()).padStart(2,"0")}`;}
export function gerarResumoSemanal(p:Omit<Props,"irPara">, hoje=new Date()){
 const inicio=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate());inicio.setDate(inicio.getDate() - ((inicio.getDay()+6)%7));
 const fim=new Date(inicio);fim.setDate(fim.getDate()+7);
 const pertence=(valor:string)=>{const d=new Date(valor);return !Number.isNaN(d.getTime())&&d>=inicio&&d<fim&&d<=hoje;};
 const sessoes=p.sessoes.filter(s=>pertence(s.data));
 const questoes=p.questoes.filter(q=>pertence(q.data));
 const totalMinutos=sessoes.reduce((n,s)=>n+(Number.isFinite(s.minutos)?Math.max(0,s.minutos):0),0);
 const feitas=questoes.reduce((n,q)=>n+(Number.isFinite(q.certas)?Math.max(0,q.certas):0)+(Number.isFinite(q.erradas)?Math.max(0,q.erradas):0),0);
 const dias=new Set(sessoes.map(s=>diaLocal(s.data)));
 const porMateria=new Map<string,Set<string>>();
 for(const s of sessoes){const m=s.materia?.trim();if(m){const x=porMateria.get(m)??new Set<string>();x.add(diaLocal(s.data));porMateria.set(m,x);}}
 const atrasadas=p.revisoes.filter(r=>!r.concluida&&new Date(r.dataPrevista)<inicioDoDia(hoje)).length;
 const limite=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()-7);
 const semEstudo=p.materias.filter(m=>!/^revis[aã]o dos erros dos simulados$/i.test(m.nome.trim())).filter(m=>!p.sessoes.some(s=>(s.materiaId===m.id||s.materia===m.nome)&&new Date(s.data)>=limite&&new Date(s.data)<=hoje)).map(m=>m.nome).slice(0,4);
 const provas=p.simulados.filter(s=>{const d=new Date(s.data);return !Number.isNaN(d.getTime())&&d<=hoje;}).sort((a,b)=>new Date(b.data).getTime()-new Date(a.data).getTime());
 const taxa=(s:Simulado)=>{const certas=Math.max(0,s.certas||0),erradas=Math.max(0,s.erradas||0);const n=certas+erradas;return n?Math.round(100*certas/n):null;};
 const ultimo=provas[0]?taxa(provas[0]):null, anterior=provas[1]?taxa(provas[1]):null;
 const prioridades:{texto:string;rota:string}[]=[];
 if(atrasadas)prioridades.push({texto:`Resolver ${atrasadas} ${atrasadas === 1 ? "revisão atrasada" : "revisões atrasadas"}`,rota:"/revisoes"});
 if(semEstudo.length)prioridades.push({texto:`Retomar ${semEstudo[0]} (7 dias sem estudo)`,rota:"/estudos"});
 if(totalMinutos<7*p.configuracoes.metaMinutosDiaria)prioridades.push({texto:"Reservar um bloco para a meta de estudo",rota:"/central-estudos"});
 if(feitas<7*p.configuracoes.metaQuestoesDiaria)prioridades.push({texto:"Resolver questões para aproximar-se da meta",rota:"/questoes"});
 prioridades.push({texto:"Manter a próxima missão do plano",rota:"/plano"});
 return {inicio:diaLocal(inicio),fim:diaLocal(new Date(fim.getTime()-86400000)),totalMinutos,metaMinutos:7*p.configuracoes.metaMinutosDiaria,feitas,metaQuestoes:7*p.configuracoes.metaQuestoesDiaria,dias:dias.size,porMateria:[...porMateria].map(([nome,set])=>({nome,dias:set.size})),atrasadas,semEstudo,ultimo,anterior,prioridades:prioridades.slice(0,3)};
}
function inicioDoDia(d:Date){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
export default function ResumoSemanaDashboard({irPara,...dados}:Props){
 const r=gerarResumoSemanal(dados);
 const data=(valor:string)=>valor.split('-').reverse().join('/');
 return <details className="resumo-semana-recolhido"><summary>Resumo da semana <span>Ver meu progresso</span></summary><section aria-label="Resumo da semana" className="resumo-semana">
   <header className="resumo-semana-topo"><div><h2>Resumo da semana</h2><p>{data(r.inicio)} a {data(r.fim)}</p></div><span>Seu progresso</span></header>
   <div className="resumo-semana-metricas">
     <div><span>Tempo de estudo</span><strong>{Math.round(r.totalMinutos/60*10)/10}h <small>/ {Math.round(r.metaMinutos/60*10)/10}h</small></strong></div>
     <div><span>Questões</span><strong>{r.feitas} <small>/ {r.metaQuestoes}</small></strong></div>
     <div><span>Dias estudados</span><strong>{r.dias} <small>/ 7</small></strong></div>
     <div><span>Último simulado</span><strong>{r.ultimo===null?"—":`${r.ultimo}%`}</strong><small>{r.anterior===null?"Sem comparação anterior":`Anterior: ${r.anterior}%`}</small></div>
   </div>
   <p className="resumo-semana-alerta"><strong>Revisões atrasadas: {r.atrasadas}</strong> · Sem estudo há 7 dias: {r.semEstudo.length?r.semEstudo.join(", "):"Nenhuma matéria identificada"}</p>
   <div className="resumo-semana-detalhes"><div><h3>Dias estudados por matéria</h3>
     {r.porMateria.length ? <ul className="resumo-semana-materias">{r.porMateria.map(m=><li key={m.nome}><span>{m.nome}</span><strong>{m.dias} {m.dias===1?'dia':'dias'}</strong></li>)}</ul> : <p>Ainda sem sessões nesta semana.</p>}
   </div><div><h3>Prioridades para amanhã</h3><ol className="resumo-semana-prioridades">{r.prioridades.map(p=><li key={p.texto}><button type="button" onClick={()=>irPara(p.rota)}>{p.texto}<span aria-hidden="true">↗</span></button></li>)}</ol></div></div>
 </section></details>;
}
