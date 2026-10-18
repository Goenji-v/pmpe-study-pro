import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { carregarRankingEstudo, type LinhaRankingEstudo } from '../../services/rankingService';
import { classeFundoPerfil } from '../../services/fundosPerfil';
import './Perfil.css';
import './FundosPerfil.css';
type PerfilResumo={nome:string;fundo:string|null;conquistas:number};
export default function PerfilPublico() {
 const {usuarioId}=useParams();
 const [perfil,setPerfil]=useState<PerfilResumo|null>(null);
 const [ranking,setRanking]=useState<LinhaRankingEstudo|null>(null);
 const [erro,setErro]=useState('');
 useEffect(()=>{
  let ativo=true;
  setPerfil(null);setRanking(null);setErro('');
  void (async()=>{
   try {
    const {data,error}=await supabase.rpc('perfil_publico_aluno',{p_usuario:usuarioId});
    if(error)throw new Error(error.message);
    if(!data)throw new Error('Perfil não encontrado.');
    if(ativo)setPerfil(data as PerfilResumo);
    const painel=await carregarRankingEstudo('mes','geral');
    if(ativo)setRanking(painel.ranking.find(p=>p.userId===usuarioId)??null);
   }catch(e){if(ativo)setErro(e instanceof Error?e.message:'Não foi possível abrir o perfil.');}
  })();return()=>{ativo=false;};
 },[usuarioId]);
 return <section className="perfil-page"><Link to="/ranking">← Voltar ao ranking</Link>{erro&&<p role="alert">{erro}</p>}{!perfil&&!erro&&<p>Carregando perfil…</p>}{perfil&&<><header className={`perfil-hero ${classeFundoPerfil(perfil.fundo)}`}><div className="perfil-avatar">{perfil.nome.split(' ').slice(0,2).map(n=>n[0]).join('')}</div><div className="perfil-identidade"><span className="perfil-kicker">PERFIL DO ESTUDANTE</span><h1>{perfil.nome}</h1><p>{perfil.conquistas} conquistas desbloqueadas</p></div></header><section className="perfil-publico-mensagem"><h2>Atividade no ranking deste mês</h2>{ranking?<div className="perfil-resumo"><p><strong>{(ranking.minutos/60).toLocaleString('pt-BR',{maximumFractionDigits:1})}h</strong> estudadas</p><p><strong>{ranking.questoes}</strong> questões · {ranking.acertos} acertos · {ranking.erradas} erros</p><p><strong>{ranking.revisoes}</strong> revisões · <strong>{ranking.xp}</strong> XP no mês</p></div>:<p>Sem posição disponível entre os participantes exibidos neste mês.</p>}</section></>}</section>;
}
