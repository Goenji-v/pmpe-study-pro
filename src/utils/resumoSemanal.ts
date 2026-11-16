import { calcularMetricasConsolidadas, calcularAproveitamentoSimulado } from "./metricasConsolidadas";
import { chaveDaMateria } from "./desempenhoMaterias";
import type { ConfiguracoesApp, Materia, RegistroQuestao, Revisao, SessaoEstudo, Simulado } from "../types/index";

export type Props={materias:Materia[];questoes:RegistroQuestao[];sessoes:SessaoEstudo[];revisoes:Revisao[];simulados:Simulado[];configuracoes:ConfiguracoesApp;irPara:(rota:string)=>void};
function diaLocal(valor:string|Date){const data=new Date(valor);return Number.isNaN(data.getTime())?"":`${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,"0")}-${String(data.getDate()).padStart(2,"0")}`;}
export function gerarResumoSemanal(p:Omit<Props,"irPara">, hoje=new Date()){
 const inicio=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate());inicio.setDate(inicio.getDate() - ((inicio.getDay()+6)%7));
 const fim=new Date(inicio);fim.setDate(fim.getDate()+7);
 const pertence=(valor:string)=>{const d=new Date(valor);return !Number.isNaN(d.getTime())&&d>=inicio&&d<fim&&d<=hoje;};
 const sessoes=p.sessoes.filter(s=>pertence(s.data));
 const questoes=p.questoes.filter(q=>pertence(q.data));
 const metricas=calcularMetricasConsolidadas({...p,inicio,fim:hoje});
 const totalMinutos=metricas.minutos;
 const feitas=metricas.questoes;

 const porMateria=new Map<string,Set<string>>();
 for(const s of [...sessoes,...questoes]){const m=p.materias.find(m=>chaveDaMateria(m.nome)===chaveDaMateria(s.materia))?.nome ?? s.materia?.trim();if(m){const x=porMateria.get(m)??new Set<string>();x.add(diaLocal(s.data));porMateria.set(m,x);}}
 const atrasadas=p.revisoes.filter(r=>!r.concluida&&new Date(r.dataPrevista)<inicioDoDia(hoje)).length;
 const limite=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()-7);
 const semEstudo=p.materias.filter(m=>!/^revis[aã]o dos erros dos simulados$/i.test(m.nome.trim())).filter(m=>!([...p.sessoes,...p.questoes]).some(s=>(s.materiaId===m.id||chaveDaMateria(s.materia)===chaveDaMateria(m.nome))&&new Date(s.data)>=limite&&new Date(s.data)<=hoje)).map(m=>m.nome).slice(0,4);
 const provas=p.simulados.filter(s=>{const d=new Date(s.data);return !Number.isNaN(d.getTime())&&d<=hoje;}).sort((a,b)=>new Date(b.data).getTime()-new Date(a.data).getTime());
 const taxa=(s:Simulado)=>calcularAproveitamentoSimulado(s);
 const ultimo=provas[0]?taxa(provas[0]):null, anterior=provas[1]?taxa(provas[1]):null;
 const prioridades:{texto:string;rota:string}[]=[];
 if(atrasadas)prioridades.push({texto:`Resolver ${atrasadas} ${atrasadas === 1 ? "revisão atrasada" : "revisões atrasadas"}`,rota:"/revisoes"});
 if(semEstudo.length)prioridades.push({texto:`Retomar ${semEstudo[0]} (7 dias sem estudo)`,rota:"/estudos"});
 if(totalMinutos<7*p.configuracoes.metaMinutosDiaria)prioridades.push({texto:"Reservar um bloco para a meta de estudo",rota:"/central-estudos"});
 if(feitas<7*p.configuracoes.metaQuestoesDiaria)prioridades.push({texto:"Resolver questões para aproximar-se da meta",rota:"/questoes"});
 prioridades.push({texto:"Manter a próxima missão do plano",rota:"/plano"});
 return {inicio:diaLocal(inicio),fim:diaLocal(new Date(fim.getTime()-86400000)),totalMinutos,metaMinutos:7*p.configuracoes.metaMinutosDiaria,feitas,metaQuestoes:7*p.configuracoes.metaQuestoesDiaria,dias:metricas.diasAtivos,porMateria:[...porMateria].map(([nome,set])=>({nome,dias:set.size})),atrasadas,semEstudo,ultimo,anterior,prioridades:prioridades.slice(0,3)};
}
function inicioDoDia(d:Date){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
