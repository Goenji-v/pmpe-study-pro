import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { listarModulosDaMateria } from '../../services/conteudos/navegarConteudos';
import { agruparAssuntosParaExibicao } from '../../utils/auditoriaAgrupamentoAssuntos';
import { correspondeAoAssunto } from '../../utils/metricasAssunto';
import { calcularMetricasConsolidadas } from '../../utils/metricasConsolidadas';
import { listarMateriais, abrirMaterial, type MaterialEstudo } from '../../services/materiaisService';
import { materialCorrespondeAoAssunto } from '../../utils/correspondenciaMateriais';
import { abrirPdfInterno, ehLinkPdf } from '../../services/leitorMaterial';
import { avaliarBlocoPreview } from './regrasBlocoPreview';
import type { Assunto, Materia, Modulo } from '../../types';
import type { ConfiguracoesComCursos } from '../../types/cursos';
import './ConteudosBlocosPreview.css';

type Bloco = {id:string;nome:string;materia:Materia;modulo:Modulo;assuntos:Assunto[]};
type Cadastro = 'materia'|'modulo'|'assunto'|'aula'|'pdf'|'link';
type AulaPreview = {id:string;nome:string;url?:string;fonte:string;concluida:boolean;obrigatoria?:boolean};
const limpar = (s:string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const dia = (s:string) => new Date(s).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const prioridade = (assuntos:Assunto[]) => assuntos.some(a=>a.prioridade==='alta')?'alta':assuntos.every(a=>a.prioridade==='baixa')?'baixa':'media';

export default function ConteudosBlocosPreview() {
 const app=useApp();
 const [extras,setExtras]=useState<Materia[]>([]);
 const [modulosExtras,setModulosExtras]=useState<Record<string,Modulo[]>>({});
 const [assuntosExtras,setAssuntosExtras]=useState<Record<string,Assunto[]>>({});
 const [matId,setMatId]=useState('');
 const [modId,setModId]=useState('');
 const [perfil,setPerfil]=useState<Bloco|null>(null);
 const [aprovados,setAprovados]=useState<Record<string,boolean>>({});
 const [sugestoes,setSugestoes]=useState(false);
 const [caixa,setCaixa]=useState('');
 const [fonte,setFonte]=useState<Record<string,string>>({});
 const [conclusoes,setConclusoes]=useState<Record<string,boolean>>({});
 const [aulasNovas,setAulasNovas]=useState<Record<string,AulaPreview[]>>({});
 const [linksNovos,setLinksNovos]=useState<Record<string,{nome:string;url:string;tipo:string}[]>>({});
 const [perguntaAula,setPerguntaAula]=useState<AulaPreview|null>(null);
 const [simulacao,setSimulacao]=useState(false);
 const [certas,setCertas]=useState(4);const [erradas,setErradas]=useState(1);const [brancos,setBrancos]=useState(0);
 const [resultado,setResultado]=useState('');
 const [reunir,setReunir]=useState(false);const [reunidas,setReunidas]=useState<Record<string,boolean>>({});
 const [cadastro,setCadastro]=useState<Cadastro|null>(null);
 const [nome,setNome]=useState('');const [url,setUrl]=useState('');const [nivel,setNivel]=useState<'alta'|'media'|'baixa'>('media');
 const [obrigatoria,setObrigatoria]=useState(true);const [mensagem,setMensagem]=useState('');
 const [materiais,setMateriais]=useState<MaterialEstudo[]>([]);const [erroMateriais,setErroMateriais]=useState('');
 const [materiaisCarregados,setMateriaisCarregados]=useState(false);
 const materias=useMemo(()=>[...app.materias,...extras].map(m=>({...m,modulos:[...listarModulosDaMateria(m),...(modulosExtras[m.id]??[])].map(mod=>({...mod,assuntos:[...mod.assuntos,...(assuntosExtras[mod.id]??[])]}))})),[app.materias,extras,modulosExtras,assuntosExtras]);
 const materia=materias.find(m=>m.id===matId);
 const modulos=materia?.modulos??[];
 const modulo=modulos.find(m=>m.id===modId);
 const gruposBase=modulo&&materia?agruparAssuntosParaExibicao(materia.nome,modulo.id,modulo.assuntos):[];
 const partesFonologia=modulo&&materia&&/portugues/.test(limpar(materia.nome))?modulo.assuntos.filter(a=>/digraf|hiato|ditongo|encontros? (consonantais|vocalicos)|separacao silabica|divisao silabica/.test(limpar(a.nome))):[];
 const idsFonologia=new Set(partesFonologia.map(a=>a.id));
 const grupos=partesFonologia.length>1&&modulo?[...gruposBase.map(g=>({...g,assuntos:g.assuntos.filter(a=>!idsFonologia.has(a.id))})).filter(g=>g.assuntos.length),{chave:modulo.id+':fonetica-fonologia',titulo:'Fonética e Fonologia',tipo:'tema' as const,assuntos:partesFonologia}]:gruposBase;
 const candidatos=grupos.filter(g=>g.assuntos.length>1&&g.tipo!=='unico');
 const blocos:Bloco[]=!modulo||!materia?[]:grupos.flatMap(g=>aprovados[g.chave]?[{id:g.chave,nome:g.titulo,materia,modulo,assuntos:g.assuntos}]:g.assuntos.map(a=>({id:a.id,nome:a.nome,materia,modulo,assuntos:[a]})));
 function abrirMateria(m:Materia){setMatId(m.id);setModId(m.modulos?.length===1?m.modulos[0].id:'');setPerfil(null);setMensagem('');}
 function voltarNivel(){setCaixa('');setMensagem('');if(perfil){setPerfil(null);}else if(modulo&&modulos.length>1){setModId('');}else{setMatId('');setModId('');}}
 function abrirPerfil(b:Bloco){setPerfil(b);setCaixa('');setResultado('');setMensagem('');}
 function abrirCadastro(tipo:Cadastro){setCadastro(tipo);setNome('');setUrl('');setMensagem('');setObrigatoria(true);setNivel('media');}
 function salvarCadastro(){
  if(!nome.trim()){setMensagem('Informe o nome.');return;}
  const id=crypto.randomUUID();
  if(cadastro==='materia'){
   if(materias.some(m=>limpar(m.nome)===limpar(nome.trim()))){setMensagem('Essa matéria já existe.');return;}
   setExtras(v=>[...v,{id,nome:nome.trim(),assuntos:[],modulos:[{id:'geral-'+id,nome:'Geral',ordem:0,assuntos:[]}]}]);
  } else if(cadastro==='modulo'&&materia){
   if(modulos.some(m=>limpar(m.nome)===limpar(nome.trim()))){setMensagem('Esse módulo já existe.');return;}
   setModulosExtras(v=>({...v,[materia.id]:[...(v[materia.id]??[]),{id,nome:nome.trim(),ordem:modulos.length,assuntos:[]}]}));setModId(id);
  } else if(cadastro==='assunto'&&modulo){
   if(modulo.assuntos.some(a=>limpar(a.nome)===limpar(nome.trim()))){setMensagem('Esse assunto já existe.');return;}
   setAssuntosExtras(v=>({...v,[modulo.id]:[...(v[modulo.id]??[]),{id,nome:nome.trim(),concluido:false,prioridade:nivel,origemConteudo:'manual'}]}));
  } else if(perfil&&(cadastro==='aula'||cadastro==='pdf'||cadastro==='link')){
   if(url&&!/^https?:\/\//i.test(url)){setMensagem('Use um endereço começando com https:// ou http://.');return;}
   if(cadastro==='aula')setAulasNovas(v=>({...v,[perfil.id]:[...(v[perfil.id]??[]),{id,nome:nome.trim(),url,fonte:'Aulas próprias',concluida:false,obrigatoria}]}));
   else setLinksNovos(v=>({...v,[perfil.id]:[...(v[perfil.id]??[]),{nome:nome.trim(),url,tipo:cadastro}]}));
  }
  setCadastro(null);setMensagem('Adicionado apenas nesta prévia. Nenhum dado da conta foi alterado.');
 }
 const aulas:AulaPreview[]=perfil?[...perfil.assuntos.flatMap(a=>a.aulas?.length?a.aulas.map(l=>({id:l.id,nome:l.nome,url:l.url,fonte:l.origemCurso?.cursoNome??'Aulas próprias',concluida:l.concluida})): [{id:a.id+':aula',nome:a.nome,url:a.aula,fonte:'Aulas próprias',concluida:a.concluido}]),...(aulasNovas[perfil.id]??[])]:[];
 const fontes=[...new Set(aulas.filter(a=>a.obrigatoria===undefined).map(a=>a.fonte))];
 const cursoPrincipalId=perfil?(app.configuracoes as ConfiguracoesComCursos).fontePrincipalPorMateria?.[perfil.materia.id]:undefined;
 const nomeCursoPrincipal=perfil?.assuntos.flatMap(a=>a.aulas??[]).find(a=>cursoPrincipalId&&a.origemCurso?.cursoId===cursoPrincipalId)?.origemCurso?.cursoNome;
 const principal=perfil?(fonte[perfil.id]??nomeCursoPrincipal??fontes[0]??'Aulas próprias'):'';
 const exigidas=aulas.filter(a=>a.obrigatoria===true||(a.obrigatoria!==false&&a.fonte===principal));
 const completa=(a:AulaPreview)=>conclusoes[a.id]??a.concluida;
 const aulasFeitas=exigidas.filter(completa).length;
 const todasAulas=exigidas.length>0&&aulasFeitas===exigidas.length;
 const avaliacao=avaliarBlocoPreview(todasAulas,certas,erradas,brancos);
 const corresponde=(r:Parameters<typeof correspondeAoAssunto>[0])=>Boolean(perfil?.assuntos.some(a=>correspondeAoAssunto(r,perfil.materia,perfil.modulo,a)));
 const sessoes=app.sessoes.filter(corresponde);
 const questoes=app.questoes.filter(corresponde);
 const revisoes=app.revisoes.filter(r=>corresponde(r)||Boolean(perfil&&r.materiaId===perfil.materia.id&&r.grupoAssuntosIds?.some(id=>perfil.assuntos.some(a=>a.id===id))));
 const pendentes=revisoes.filter(r=>!r.concluida);
 const metricas=calcularMetricasConsolidadas({sessoes,questoes,revisoes,simulados:[]});
 const vinculos=perfil?perfil.assuntos.flatMap(a=>[...(a.materiais??[]).map(m=>({id:m.id,nome:m.nome,url:m.url,tipo:m.tipo})),...(a.pdf?[{id:a.id+':pdf',nome:'PDF de '+a.nome,url:a.pdf,tipo:'pdf'}]:[]),...(a.questoes?[{id:a.id+':questoes',nome:'Questões de '+a.nome,url:a.questoes,tipo:'questoes'}]:[])]):[];
 const materiaisPerfil=perfil?materiais.filter(m=>perfil.assuntos.some(a=>materialCorrespondeAoAssunto(m,{materia:perfil.materia.nome,materiaId:perfil.materia.id,modulo:perfil.modulo.nome,moduloId:perfil.modulo.id,assunto:a.nome,assuntoId:a.id,assuntoIdsLegados:a.idsLegados}))):[];
 const historico=[...sessoes.map(s=>({id:'s:'+s.id,data:s.data,titulo:s.tipo==='revisao'?'Revisão':s.tipo==='questoes'?'Sessão de questões':s.tipo==='redacao'?'Redação':'Estudo / aula',texto:`${s.minutos} min${s.observacao?' · '+s.observacao:''}`,resultado:''})),...questoes.map(q=>{const total=q.certas+q.erradas+(q.emBranco??0);return {id:'q:'+q.id,data:q.data,titulo:'Resultado de questões',texto:`${q.minutos??0} min · ${q.certas} acertos · ${q.erradas} erros · ${q.emBranco??0} em branco`,resultado:total?`${Math.round(q.certas/total*100)}% · ${q.certas/total>=.8?'Bom resultado':'Reforçar resumo e questões'}`:'Quantidade não registrada'};})].sort((a,b)=>Date.parse(b.data)-Date.parse(a.data));
 async function abrirCaixa(valor:string){setCaixa(caixa===valor?'':valor);if(valor==='pdfs'&&!materiaisCarregados){try{setMateriais(await listarMateriais());setMateriaisCarregados(true);}catch(e){setErroMateriais(e instanceof Error?e.message:'Não foi possível carregar os materiais.');}}}
 function abrirLink(nomeLink:string,link:string){if(!/^https?:\/\//i.test(link)){setMensagem('Este item não possui um endereço válido.');return;}if(ehLinkPdf(link))abrirPdfInterno({id:link,nome:nomeLink,url:link});else window.open(link,'_blank','noopener,noreferrer');}
 return <section className="cb-page">
  <header className="cb-heading"><div><h1>Conteúdos</h1><p>Matérias, assuntos e o histórico do seu estudo.</p></div><button onClick={()=>abrirCadastro('materia')}>＋ Nova matéria</button></header>
  <p className="cb-preview">Prévia interativa · Seus registros aparecem para consulta. Cadastros, agrupamentos e conclusões feitos aqui são simulações nesta aba.</p>
  {mensagem&&<p role="status" className="cb-notice">{mensagem}</p>}
  <div className="cb-navigation">{materia&&<button className="cb-level-back" onClick={voltarNivel}><span aria-hidden="true">←</span> {perfil?'Voltar aos assuntos':modulo&&modulos.length>1?'Voltar aos módulos':'Voltar às matérias'}</button>}
  <nav className="cb-path" aria-label="Localização"><button onClick={()=>{setMatId('');setModId('');setPerfil(null);}}>Todas as matérias</button>{materia&&<><span>›</span><button onClick={()=>{setPerfil(null);setModId(modulos.length===1?modulos[0].id:'');}}>{materia.nome}</button></>}{modulo&&modulos.length>1&&<><span>›</span><button onClick={()=>setPerfil(null)}>{modulo.nome}</button></>}{perfil&&<><span>›</span><span>{perfil.nome}</span></>}</nav></div>
  {!materia&&<div className="cb-panel"><h2>Suas matérias</h2><div className="cb-table" role="table" aria-label="Matérias"><div className="cb-row cb-label" role="row"><span>Matéria</span><span>Assuntos</span><span>Acesso</span></div>{materias.map(m=><button role="row" className="cb-row" key={m.id} onClick={()=>abrirMateria(m)}><strong>{m.nome}</strong><span>{m.modulos.reduce((n,mod)=>n+mod.assuntos.length,0)}</span><span>Abrir →</span></button>)}</div></div>}
  {materia&&!perfil&&<div className="cb-panel"><header className="cb-panel-heading"><div><h2>{materia.nome}</h2><p>{modulo?modulo.nome==='Geral'?'Assuntos da matéria':modulo.nome:'Escolha um módulo'}</p></div><div className="cb-actions"><button onClick={()=>abrirCadastro('modulo')}>＋ Novo módulo</button>{modulo&&<button onClick={()=>abrirCadastro('assunto')}>＋ Novo assunto</button>}</div></header>
   {!modulo&&modulos.map(m=><button className="cb-module" key={m.id} onClick={()=>setModId(m.id)}><strong>{m.nome}</strong><span>{m.assuntos.length} assuntos →</span></button>)}
   {modulo&&<>{candidatos.length>0&&<div className="cb-group-hint"><span>{candidatos.filter(g=>!aprovados[g.chave]).length} sugestões de blocos. Nada é reunido sem sua confirmação.</span><button onClick={()=>setSugestoes(true)}>Conferir agrupamentos</button></div>}
   <div className="cb-table" role="table" aria-label="Assuntos"><div className="cb-topic-row cb-label" role="row"><span>Assunto / bloco</span><span>Prioridade</span><span>Aulas</span><span>Detalhes</span></div>{blocos.map(b=>{const lista=b.assuntos.flatMap(a=>a.aulas?.length?a.aulas:[{concluida:a.concluido}]);return <div className="cb-topic-row" role="row" key={b.id}><div><strong>{b.nome}</strong>{b.assuntos.length>1&&<small>{b.assuntos.length} partes no bloco</small>}</div><span className={'cb-priority '+prioridade(b.assuntos)}>{prioridade(b.assuntos)==='media'?'Média':prioridade(b.assuntos)==='alta'?'Alta':'Baixa'}</span><span>{lista.filter(a=>a.concluida).length}/{lista.length}</span><button onClick={()=>abrirPerfil(b)}>Perfil →</button></div>;})}</div>{blocos.length===0&&<p className="cb-empty">Nenhum assunto neste módulo. Use “Novo assunto” para experimentar o cadastro.</p>}</>}
  </div>}
  {perfil&&<>
   <header className="cb-panel-heading"><div><h2>{perfil.nome}</h2><p>Perfil do assunto · prioridade {prioridade(perfil.assuntos)==='media'?'média':prioridade(perfil.assuntos)}</p></div></header>
   <div className="cb-metrics">{[['Tempo estudado',`${Math.floor(metricas.minutos/60)}h ${Math.round(metricas.minutos%60)}min`],['Questões respondidas',metricas.questoes],['Acertos',metricas.certas],['Erros',metricas.erradas],['Em branco',metricas.emBranco],['Revisões concluídas',metricas.revisoesConcluidas],['Sessões com conclusão',sessoes.filter(s=>s.conteudoConcluido).length]].map(([label,v])=><article key={label}><span>{label}</span><strong>{v}</strong></article>)}</div>
   <div className="cb-boxes">{[['aulas','Aulas',`${aulas.length} aulas vinculadas`],['pdfs','PDFs e materiais','Arquivos do assunto'],['questoes','Questões',`${metricas.questoes} respondidas`],['notas','Anotações e links','Seu material de apoio']].map(([id,label,desc])=><button aria-expanded={caixa===id} className={caixa===id?'active':''} key={id} onClick={()=>{void abrirCaixa(id);}}><strong>{label}</strong><small>{desc}</small><span>{caixa===id?'−':'＋'}</span></button>)}</div>
   {caixa&&<div className="cb-panel">
    {caixa==='aulas'&&<><header className="cb-panel-heading"><h3>Aulas cadastradas</h3><button onClick={()=>abrirCadastro('aula')}>＋ Adicionar aula</button></header>{fontes.length>1&&<label className="cb-field">Curso principal<select value={principal} onChange={e=>setFonte(v=>({...v,[perfil.id]:e.target.value}))}>{fontes.map(f=><option key={f}>{f}</option>)}</select><small>Somente a fonte principal e aulas marcadas como obrigatórias entram na conclusão deste teste.</small></label>}{aulas.map(a=><div className="cb-lesson" key={a.id}><div><strong>{a.nome}</strong><small>{a.fonte} · {exigidas.some(e=>e.id===a.id)?'Obrigatória':'Complementar'}</small></div><span>{completa(a)?'Concluída':'Pendente'}</span>{a.url&&<button onClick={()=>abrirLink(a.nome,a.url!)}>Abrir aula</button>}<button onClick={()=>setPerguntaAula(a)}>Simular fim da sessão</button></div>)}</>}
    {caixa==='pdfs'&&<><header className="cb-panel-heading"><h3>PDFs e materiais vinculados</h3><button onClick={()=>abrirCadastro('pdf')}>＋ Adicionar PDF</button></header>{erroMateriais&&<p className="cb-notice">{erroMateriais}</p>}{vinculos.filter(l=>l.tipo!=='questoes').map(l=><div className="cb-lesson" key={l.id}><strong>{l.nome}</strong><button onClick={()=>abrirLink(l.nome,l.url)}>Abrir</button></div>)}{materiaisPerfil.map(m=><div className="cb-lesson" key={m.id}><strong>{m.nome}</strong><button onClick={()=>{void abrirMaterial(m).catch(()=>setMensagem('Não foi possível abrir este material.'));}}>Abrir</button></div>)}{(linksNovos[perfil.id]??[]).filter(l=>l.tipo==='pdf').map((l,i)=><div key={i} className="cb-lesson"><strong>{l.nome}</strong><small>Rascunho da prévia</small></div>)}{materiaisCarregados&&!materiaisPerfil.length&&!vinculos.filter(l=>l.tipo!=='questoes').length&&<p>Nenhum material encontrado para este assunto.</p>}</>}
    {caixa==='questoes'&&<><header className="cb-panel-heading"><h3>Questões do assunto</h3><button onClick={()=>setSimulacao(true)}>Testar resultado de questões</button></header><p>Os números mostram questões registradas no histórico. Links de listas aparecem abaixo.</p>{vinculos.filter(l=>l.tipo==='questoes').map(l=><button key={l.id} onClick={()=>abrirLink(l.nome,l.url)}>{l.nome} ↗</button>)}{!vinculos.some(l=>l.tipo==='questoes')&&<p>Nenhum link de questões vinculado.</p>}</>}
    {caixa==='notas'&&<><header className="cb-panel-heading"><h3>Resumos, anotações e links</h3><button onClick={()=>abrirCadastro('link')}>＋ Adicionar link</button></header>{perfil.assuntos.map(a=><div key={a.id}><h4>{a.nome}</h4><p className="cb-text">{a.resumo||a.anotacoes||'Nenhum resumo ou anotação registrado.'}</p></div>)}{(linksNovos[perfil.id]??[]).filter(l=>l.tipo==='link').map((l,i)=><p key={i}>{l.nome} · rascunho da prévia</p>)}</>}
   </div>}
   <div className="cb-block-rule"><div><strong>Conclusão do bloco</strong><p>{aulasFeitas}/{exigidas.length} aulas obrigatórias concluídas · depois, no mínimo 5 questões respondidas.</p><small>80% ou mais: revisão normal. Abaixo de 80%: resumo + 10 questões. Resultado baixo não bloqueia a conclusão.</small></div><button onClick={()=>setSimulacao(true)}>Testar conclusão</button></div>
   {resultado&&<p className="cb-notice" role="status">{resultado}</p>}
   {pendentes.length>1&&<div className="cb-group-hint"><span>{reunidas[perfil.id]?'Neste teste, as pendências foram reunidas numa revisão do bloco.':`${pendentes.length} revisões pendentes relacionadas a este bloco.`}</span><button onClick={()=>setReunir(true)}>Conferir reunião de revisões</button></div>}
   <div className="cb-panel"><h3>Sessões e resultados recentes</h3><p className="cb-caption">Eventos vinculados ao assunto, em ordem de data. Registros de questões são mostrados separadamente quando não há vínculo explícito com a sessão.</p>{historico.slice(0,30).map(h=><article className="cb-history" key={h.id}><time>{dia(h.data)}</time><div><strong>{h.titulo}</strong><p>{h.texto}</p>{h.resultado&&<small>{h.resultado}</small>}</div></article>)}{!historico.length&&<p className="cb-empty">Este assunto ainda não possui sessões ou questões vinculadas.</p>}</div>
  </>}
  {(cadastro||perguntaAula||simulacao||sugestoes||reunir)&&<div className="cb-overlay"><section className="cb-modal" role="dialog" aria-modal="true" aria-label={cadastro?'Adicionar conteúdo':perguntaAula?'Finalizar sessão':simulacao?'Resultado do bloco':sugestoes?'Sugestões de blocos':'Reunir revisões'}><button className="cb-close" aria-label="Fechar" onClick={()=>{setCadastro(null);setPerguntaAula(null);setSimulacao(false);setSugestoes(false);setReunir(false);}}>✕</button>
   {cadastro&&<><h2>{({materia:'Nova matéria',modulo:'Novo módulo',assunto:'Novo assunto',aula:'Adicionar aula',pdf:'Adicionar PDF',link:'Adicionar link'})[cadastro]}</h2><p>Destino: {materia?.nome??'Biblioteca'}{modulo?' → '+modulo.nome:''}{perfil?' → '+perfil.nome:''}</p><label className="cb-field">Nome<input value={nome} onChange={e=>setNome(e.target.value)}/></label>{cadastro==='assunto'&&<label className="cb-field">Prioridade<select value={nivel} onChange={e=>setNivel(e.target.value as typeof nivel)}><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></label>}{['aula','pdf','link'].includes(cadastro)&&<label className="cb-field">Link (opcional nesta simulação)<input type="url" value={url} onChange={e=>setUrl(e.target.value)}/></label>}{cadastro==='aula'&&<label className="cb-field">Participação na conclusão<select value={obrigatoria?'sim':'nao'} onChange={e=>setObrigatoria(e.target.value==='sim')}><option value="sim">Obrigatória — bloco fica pendente até concluí-la</option><option value="nao">Complementar — não reabre o bloco</option></select></label>}<p className="cb-caption">Este cadastro é um rascunho nesta aba. Não grava nem substitui dados da conta.</p>{mensagem&&<p role="status">{mensagem}</p>}<button onClick={salvarCadastro}>Adicionar à prévia</button></>}
   {perguntaAula&&<><h2>Você terminou esta aula?</h2><p>{perguntaAula.nome}</p><p>Encerrar uma sessão não significa terminar o conteúdo.</p><div className="cb-actions"><button onClick={()=>{setConclusoes(v=>({...v,[perguntaAula.id]:false}));setPerguntaAula(null);}}>Ainda não, continuar depois</button><button onClick={()=>{setConclusoes(v=>({...v,[perguntaAula.id]:true}));setPerguntaAula(null);}}>Sim, terminei a aula</button></div><p className="cb-caption">Simulação: não altera sessões nem cronômetros reais.</p></>}
   {simulacao&&<><h2>Resultado das questões</h2><p>{aulasFeitas}/{exigidas.length} aulas obrigatórias concluídas.</p><div className="cb-inputs">{[['Acertos',certas,setCertas],['Erros',erradas,setErradas],['Em branco',brancos,setBrancos]].map(([label,v,set])=><label key={label as string} className="cb-field">{label as string}<input type="number" min="0" step="1" value={v as number} onChange={e=>(set as (n:number)=>void)(Number(e.target.value))}/></label>)}</div><p>Em branco não conta para o mínimo de 5 respondidas e entra no cálculo do aproveitamento.</p><div className="cb-notice">{avaliacao.percentual!==null&&<strong>{Math.round(avaliacao.percentual)}% de aproveitamento · </strong>}{avaliacao.mensagem}</div><button disabled={!avaliacao.liberado} onClick={()=>{setResultado(`Simulação: bloco concluído. ${avaliacao.mensagem} A agenda real permanece igual.`);setSimulacao(false);}}>Simular conclusão e primeira revisão</button></>}
   {sugestoes&&<><h2>Conferir agrupamentos</h2><p>Os assuntos originais e seus materiais são preservados. A confirmação reúne apenas a apresentação neste teste.</p>{candidatos.map(g=><article className="cb-suggestion" key={g.chave}><strong>{g.titulo}</strong><ul>{g.assuntos.map(a=><li key={a.id}>{a.nome}</li>)}</ul><button onClick={()=>setAprovados(v=>({...v,[g.chave]:!v[g.chave]}))}>{aprovados[g.chave]?'Desfazer agrupamento':'Confirmar este bloco'}</button></article>)}</>}
   {reunir&&perfil&&<><h2>Uma revisão para este bloco</h2><p>Estas pendências seriam reunidas. Sessões e revisões concluídas continuam no histórico.</p><ul>{pendentes.map(r=><li key={r.id}>{r.assunto} · etapa {r.etapa} · {new Date(r.dataPrevista).toLocaleDateString('pt-BR')}</li>)}</ul><p>Nesta prévia, a simulação usa a data mais antiga entre as pendências, sem adiar a revisão.</p><button onClick={()=>{setReunidas(v=>({...v,[perfil.id]:true}));setReunir(false);}}>Confirmar reunião na prévia</button></>}
  </section></div>}
 </section>;
}
