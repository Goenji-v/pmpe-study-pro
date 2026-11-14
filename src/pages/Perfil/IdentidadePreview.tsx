import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useIdentidadePreview, prepararFoto, type IdentidadePreview as Dados } from '../../services/identidadePreview';
import type { ResumoGamificacao } from '../../services/gamificacaoService';
import AlterarSenha from '../Configuracoes/AlterarSenha';
import '../Configuracoes/Configuracoes.css';
import './IdentidadePreview.css';

export default function IdentidadePreview({gamificacao,titulo,moedas,conquistas}:{gamificacao:ResumoGamificacao;titulo:string;moedas:number;conquistas:number}){
 const {usuario}=useAuth();const {configuracoes}=useApp();const {dados,salvar}=useIdentidadePreview(usuario?.id);
 const [aviso,setAviso]=useState('');const [fotoOcupada,setFotoOcupada]=useState(false);
 const nome=dados.nome||configuracoes.nomeUsuario||'Estudante';const iniciais=nome.split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase();
 const xpNivel=gamificacao.xpTotal%250;const falta=250-xpNivel;
 const ingresso=usuario?.created_at?new Date(usuario.created_at).toLocaleDateString('pt-BR'):'Não informado';
 const dataProva=dados.dataProva??configuracoes.dataProva;const hoje=new Date();hoje.setHours(0,0,0,0);
 const dias=dataProva?Math.round((new Date(`${dataProva}T00:00:00`).getTime()-hoje.getTime())/86400000):null;
 async function foto(file?:File){if(!file)return;setFotoOcupada(true);setAviso('');try{salvar({foto:await prepararFoto(file)});setAviso('Foto atualizada nesta prévia.');}catch(e){setAviso(e instanceof Error?e.message:'Não foi possível salvar a foto neste navegador.');}finally{setFotoOcupada(false);}}
 function salvarDados(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const campos:Dados={};for(const key of ['nome','cidade','uf','whatsapp','nascimento','concurso','dataProva'] as const)campos[key]=String(f.get(key)||'').trim();try{salvar(campos);setAviso('Dados salvos somente neste navegador para avaliar a prévia.');}catch{setAviso('Não foi possível salvar. Verifique o espaço disponível no navegador.');}}
 return <div className="id-preview">
  <header className="id-heading"><div><span className="id-eyebrow">SUA JORNADA COMEÇA AQUI</span><h1>Meu perfil</h1><p>Seu objetivo, sua identidade e cada conquista pelo caminho.</p></div><span className="id-preview-tag">PRÉVIA</span></header>
  <p className="id-local-note">Foto e novos dados são salvos apenas neste navegador, nesta conta de prévia. Seu histórico e cadastro oficial permanecem iguais.</p>
  <section className="id-card" aria-label="Identidade Study Pro">
   <div className="id-card-brand"><img src="/assets/study-pro-sp-v8.svg" alt=""/><strong>STUDY PRO</strong><span>IDENTIDADE DO ESTUDANTE</span></div>
   <div className="id-card-body"><div className="id-photo-column"><div className="id-photo">{dados.foto?<img src={dados.foto} alt={`Foto de ${nome}`}/>:<span>{iniciais}</span>}</div><label className="id-upload">{fotoOcupada?'Preparando…':dados.foto?'Trocar foto':'Adicionar foto'}<input aria-label="Escolher foto do perfil" type="file" accept="image/png,image/jpeg,image/webp" disabled={fotoOcupada} onChange={e=>{void foto(e.target.files?.[0]);e.target.value='';}}/></label>{dados.foto&&<button className="id-text-button" onClick={()=>{try{salvar({foto:''});setAviso('Foto removida da prévia.');}catch{setAviso('Não foi possível remover a foto.');}}}>Remover foto</button>}<small>JPG, PNG ou WebP · até 8 MB</small></div>
   <div className="id-information"><span className="id-eyebrow">ESTUDANTE</span><h2>{nome}</h2><p className="id-rank">Nível {gamificacao.nivel} <span>•</span> {titulo}</p><dl><div><dt>E-mail</dt><dd>{usuario?.email||'Não informado'}</dd></div><div><dt>No Study Pro desde</dt><dd>{ingresso}</dd></div><div><dt>Identificação da conta</dt><dd className="id-account-code">{usuario?.id||'Disponível ao entrar na conta'}</dd></div><div><dt>Plano</dt><dd>Não informado nesta prévia</dd></div></dl></div></div>
   <div className="id-progress"><div><strong>Rumo ao nível {gamificacao.nivel+1}</strong><span>Faltam {falta} XP</span></div><progress aria-label="Progresso até o próximo nível" max={250} value={xpNivel}/><small>Estudo, questões, revisões e simulados contribuem para seu XP.</small></div>
  </section>
  <div className="id-stats"><article><span>XP acumulados</span><strong>{gamificacao.xpTotal.toLocaleString('pt-BR')}</strong></article><article><span>Moedas</span><strong>{moedas.toLocaleString('pt-BR')}</strong></article><article><span>Conquistas</span><strong>{conquistas}</strong></article></div>
  <section className="id-objective"><div><span className="id-eyebrow">SEU PRÓXIMO OBJETIVO</span><h2>{dados.concurso||configuracoes.concurso||'Defina seu concurso'}</h2><p>{dataProva?`Prova em ${new Date(`${dataProva}T00:00:00`).toLocaleDateString('pt-BR')}`:'Adicione a data da prova nos dados abaixo.'}</p></div><strong>{dias===null?'Sem data':dias>0?`${dias} dias`:dias===0?'É hoje': 'Data passada'}</strong></section>
  {aviso&&<p className="id-feedback" role="status">{aviso}</p>}
  <details className="id-details"><summary>Dados pessoais e objetivo <span>Editar</span></summary><form onSubmit={salvarDados} key={usuario?.id}><div className="id-form-grid">
   <label>Nome<input name="nome" required maxLength={80} defaultValue={nome} autoComplete="name"/></label><label>Concurso-alvo<input name="concurso" maxLength={100} defaultValue={dados.concurso||configuracoes.concurso}/></label>
   <label>Data da prova<input name="dataProva" type="date" defaultValue={dataProva}/></label><label>WhatsApp (opcional)<input name="whatsapp" type="tel" maxLength={25} autoComplete="tel" defaultValue={dados.whatsapp}/></label>
   <label>Data de nascimento (opcional)<input name="nascimento" type="date" max={new Date().toLocaleDateString('en-CA')} defaultValue={dados.nascimento}/></label><label>Cidade (opcional)<input name="cidade" maxLength={100} autoComplete="address-level2" defaultValue={dados.cidade}/></label>
   <label>UF (opcional)<select name="uf" defaultValue={dados.uf||''}><option value="">Selecione</option>{'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(uf=><option key={uf}>{uf}</option>)}</select></label>
  </div><button className="id-save" type="submit">Salvar na prévia</button></form></details>
  <details className="id-details"><summary>Segurança da conta <span>Abrir</span></summary><p className="id-local-note">Esta seção usa a segurança real da sua conta. Alterar a senha aqui também altera o acesso ao site oficial.</p><AlterarSenha/></details>
 </div>;
}
