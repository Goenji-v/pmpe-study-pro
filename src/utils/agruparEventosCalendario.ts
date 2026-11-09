export type EventoAgrupavel = {id:string;titulo:string;tipo:string;minutos:number;quantidadeQuestoes?:number;status?:string};
export function agruparEventosCalendario<T extends EventoAgrupavel>(eventos:T[]) {
 const grupos=new Map<string,{materia:string;eventos:T[];minutos:number;questoes:number;revisoesConcluidas:number;revisoesPendentes:number}>();
 for(const evento of eventos){
  const chave=evento.titulo.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const grupo=grupos.get(chave)??{materia:evento.titulo,eventos:[],minutos:0,questoes:0,revisoesConcluidas:0,revisoesPendentes:0};
  grupo.eventos.push(evento);
  // Sessões representam tempo estudado; registros de questões podem espelhar a mesma sessão.
  if(evento.tipo==='sessao') grupo.minutos+=Math.max(0,evento.minutos);
  if(evento.tipo==='questoes') grupo.questoes+=Math.max(0,evento.quantidadeQuestoes??0);
  if(evento.tipo==='revisao') evento.status==='concluida'?grupo.revisoesConcluidas++:grupo.revisoesPendentes++;
  grupos.set(chave,grupo);
 }
 return [...grupos.values()];
}
