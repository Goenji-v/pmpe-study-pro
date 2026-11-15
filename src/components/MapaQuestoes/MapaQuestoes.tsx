import {useState} from 'react';
import './MapaQuestoes.css';
type Item = {id:string;respostaCorreta:string};
type Filtro = 'todas'|'pendentes'|'respondidas'|'acertos'|'erros';
export default function MapaQuestoes({questoes,respostas,finalizado,atual,onNavigate}:{questoes:Item[];respostas:Record<string,string>;finalizado:boolean;atual:number;onNavigate:(index:number)=>void}) {
 const [filtro,setFiltro]=useState<Filtro>('todas');
 const estado=(q:Item)=>!respostas[q.id]?'pendentes':!finalizado?'respondidas':respostas[q.id]===q.respostaCorreta?'acertos':'erros';
 const filtros:Filtro[]=finalizado?['todas','pendentes','acertos','erros']:['todas','pendentes','respondidas'];
 const ativo=filtros.includes(filtro)?filtro:'todas';
 const itens=questoes.map((q,index)=>({q,index,status:estado(q)})).filter(x=>ativo==='todas'||x.status===ativo);
 const nomes={todas:'Todas',pendentes:finalizado?'Em branco':'Pendentes',respondidas:'Respondidas',acertos:'Acertos',erros:'Erros'};
 return <aside className="resolver-ia-navegacao sp-mapa" aria-label="Mapa de questões"><h2>Mapa do treino</h2><p>{Object.keys(respostas).filter(id=>questoes.some(q=>q.id===id)).length} de {questoes.length} respondidas</p>
 <div className="sp-mapa-filtros" role="group" aria-label="Filtrar mapa">{filtros.map(f=><button key={f} type="button" aria-pressed={ativo===f} onClick={()=>setFiltro(f)}>{nomes[f]}</button>)}</div>
 <div className="resolver-ia-numeros">{itens.map(({q,index,status})=><button key={q.id} type="button" aria-label={`Questão ${index+1}: ${nomes[status as keyof typeof nomes]}`} aria-current={atual===index?'step':undefined} className={[atual===index?'ativa':'',status==='acertos'?'correta':status==='erros'?'errada':status==='respondidas'?'respondida':''].join(' ')} onClick={()=>onNavigate(index)}>{index+1}</button>)}</div>
 {!itens.length&&<p role="status">Nenhuma questão neste filtro.</p>}
 <small>{finalizado?'Selecione uma questão para conferir o gabarito e a explicação.':'O gabarito aparece ao finalizar. Você pode navegar sem perder as respostas.'}</small></aside>;
}
