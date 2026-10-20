import { useEffect, useRef } from 'react';
import type { Assunto, Materia, Modulo } from '../../types';
import { useApp } from '../../context/AppContext';
import { calcularMetricasAssunto } from '../../utils/metricasAssunto';
import { abrirPdfInterno, ehLinkPdf } from '../../services/leitorMaterial';
import MateriaisDoAssunto from '../MateriaisDoAssunto/MateriaisDoAssunto';
import './PerfilAssunto.css';
export default function PerfilAssunto({materia,modulo,assunto,fechar}: {materia:Materia;modulo:Modulo;assunto:Assunto;fechar:()=>void}) {
 const {questoes,sessoes,revisoes}=useApp();
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 const metricas=calcularMetricasAssunto({materia,modulo,assunto,sessoes,questoes,revisoes});
 const ss=metricas.sessoesDoAssunto;
 const links=[...(assunto.materiais??[]),...(assunto.pdf?[{id:'pdf',nome:'PDF do assunto',url:assunto.pdf,tipo:'pdf'}]:[]),...(assunto.aula?[{id:'aula',nome:'Aula',url:assunto.aula,tipo:'link'}]:[]),...(assunto.questoes?[{id:'questoes',nome:'Lista de questões',url:assunto.questoes,tipo:'link'}]:[]),...(assunto.aulas??[]).filter(a=>a.url).map(a=>({id:a.id,nome:a.nome,url:a.url!,tipo:'link'}))];
 return <dialog ref={dialog} className="perfil-assunto" onCancel={fechar}>
  <header><div><small>{materia.nome} / {modulo.nome}</small><h2>{assunto.nome}</h2><p>Seu histórico e materiais deste conteúdo, reunidos aqui.</p></div><button onClick={fechar} aria-label="Fechar perfil do assunto">Fechar ✕</button></header>
  <div className="perfil-assunto-metricas">{[['Horas estudadas',(metricas.minutos/60).toLocaleString('pt-BR',{maximumFractionDigits:2})+'h'],['Questões',metricas.questoes],['Acertos',metricas.certas],['Erros',metricas.erradas],['Em branco',metricas.emBranco],['Revisões pendentes',metricas.revisoesPendentes],['Revisões concluídas',metricas.revisoesConcluidas]].map(([nome,valor])=><article key={nome}><small>{nome}</small><strong>{valor}</strong></article>)}</div>
  <section><h3>PDFs, aulas e links</h3>{!links.length&&<p>Nenhum link cadastrado neste assunto.</p>}<div className="perfil-assunto-links">{links.filter(l => /^https?:\/\//i.test(l.url)).filter((l,i,a)=>a.findIndex(x=>x.url===l.url)===i).map(l=><a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" onClick={e=>{if(l.tipo==='pdf'||ehLinkPdf(l.url)){e.preventDefault();abrirPdfInterno({id:`${materia.id}:${assunto.id}:${l.id}`,nome:l.nome,url:l.url});}}}>{l.tipo==='pdf'?'📄':'↗'} {l.nome}</a>)}</div><MateriaisDoAssunto materia={materia.nome} materiaId={materia.id} materiaCatalogo={materia} idsLegadosMateria={materia.idsLegados} modulo={modulo.nome} moduloId={modulo.id} assunto={assunto.nome} assuntoId={assunto.id} idsLegadosAssunto={[...(assunto.idsLegados??[]),...(assunto.referenciasEdital??[]),...(assunto.origemEditalId?[assunto.origemEditalId]:[])]}/></section>
  {(assunto.anotacoes||assunto.resumo)&&<section><h3>Suas anotações</h3><p style={{whiteSpace:'pre-wrap'}}>{assunto.anotacoes||assunto.resumo}</p></section>}
  <section><h3>Sessões recentes</h3>{ss.length===0?<p>Nenhuma sessão registrada ainda.</p>:ss.slice().sort((a,b)=>Date.parse(b.data)-Date.parse(a.data)).slice(0,10).map(s=><div className="perfil-assunto-sessao" key={s.id}><span>{new Date(s.data).toLocaleDateString('pt-BR')} · {s.tipo}</span><strong>{s.minutos} min</strong></div>)}</section>
 </dialog>;
}
