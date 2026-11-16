import { gerarResumoSemanal, type Props } from "../../utils/resumoSemanal";
export default function ResumoSemanaDashboard({irPara,...dados}:Props){
 const r=gerarResumoSemanal(dados);
 const data=(valor:string)=>valor.split('-').reverse().join('/');
 return <section aria-label="Resumo da semana" className="resumo-semana">
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
 </section>;
}
