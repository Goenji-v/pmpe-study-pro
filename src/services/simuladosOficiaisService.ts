import { supabase } from "../lib/supabase";
import { fetchApiAutenticada } from "./apiAutenticada";

export type QuestaoOficial = {
  id: string;
  simulado_id?: string;
  numero: number;
  numeroOriginal?: number;
  materia: string;
  materia_id?: string | null;
  modulo?: string | null;
  modulo_id?: string | null;
  assunto: string;
  assunto_id?: string | null;
  subassunto?: string | null;
  dificuldade: "facil" | "media" | "dificil";
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  respostaCorretaId?: string;
  explicacao?: string | null;
  ordem: number;
};

export type SimuladoOficial = {
  id: string; nome: string; concurso_alvo: string; edital_alvo?: string | null; banca: string;
  data_prova?: string | null; duracao_minutos: number; total_questoes: number;
  status: "rascunho" | "publicado" | "encerrado"; fonte_prova_nome?: string | null;
  fonte_gabarito_nome?: string | null; criado_em: string;
};
export type ResultadoSimuladoOficial = { total:number; certas:number; erradas:number; emBranco:number; anuladas:number; percentual:number; porMateria:Array<{materia:string;total:number;certas:number;erradas:number;emBranco:number;percentual:number}> };
const URL_API = import.meta.env.VITE_API_URL || "";
const urlApi=(c:string)=>`${URL_API}${c}`;

export async function analisarProvaOficial(args:{prova:File;gabarito:File;concursoAlvo:string;editalAlvo:string;concursoOrigem:string;cargoOrigem:string;anoOrigem:number;banca:string;mapaEdital?:unknown[]}){
  const [provaBase64,gabaritoBase64]=await Promise.all([arquivoParaBase64(args.prova),arquivoParaBase64(args.gabarito)]);
  const resposta=await fetchApiAutenticada(urlApi("/api/analisar-prova"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prova:{nome:args.prova.name,base64:provaBase64},gabarito:{nome:args.gabarito.name,base64:gabaritoBase64},metadados:{concursoAlvo:args.concursoAlvo,editalAlvo:args.editalAlvo,concursoOrigem:args.concursoOrigem,cargoOrigem:args.cargoOrigem,anoOrigem:args.anoOrigem,banca:args.banca},mapaEdital:args.mapaEdital||[]})});
  const dados=await resposta.json() as {sucesso?:boolean;erro?:string;analise?:{questoes?:QuestaoOficial[];totalEsperadas?:number}};
  if(!resposta.ok||!dados.sucesso||!dados.analise)throw new Error(dados.erro||"Não foi possível analisar a prova.");
  return dados.analise;
}
export async function criarSimuladoOficial(args:{nome:string;concursoAlvo:string;editalAlvo:string;banca:string;dataProva:string;duracaoMinutos:number;fonteProvaNome:string;fonteGabaritoNome:string;questoes:QuestaoOficial[]}){
  const {data:simulado,error}=await supabase.from("simulados_oficiais").insert({nome:args.nome,concurso_alvo:args.concursoAlvo,edital_alvo:args.editalAlvo,banca:args.banca,data_prova:args.dataProva||null,duracao_minutos:args.duracaoMinutos,total_questoes:args.questoes.length,status:"rascunho",fonte_prova_nome:args.fonteProvaNome,fonte_gabarito_nome:args.fonteGabaritoNome}).select("*").single();
  if(error||!simulado)throw new Error(error?.message||"Erro ao criar o simulado.");
  const qs=args.questoes.map(q=>({id:q.id,simulado_id:simulado.id,numero:q.numeroOriginal??q.numero,materia:q.materia,materia_id:q.materia_id||null,modulo:q.modulo||null,modulo_id:q.modulo_id||null,assunto:q.assunto,assunto_id:q.assunto_id||null,subassunto:q.subassunto||null,dificuldade:q.dificuldade,enunciado:q.enunciado,alternativas:q.alternativas,explicacao:q.explicacao||null,ordem:q.ordem||q.numeroOriginal||q.numero}));
  const {error:erroQuestoes}=await supabase.from("simulados_oficiais_questoes").insert(qs);
  if(erroQuestoes){await supabase.from("simulados_oficiais").delete().eq("id",simulado.id);throw new Error(`Erro ao salvar questões: ${erroQuestoes.message}`);}
  const gs=args.questoes.map(q=>({simulado_id:simulado.id,numero:q.numeroOriginal??q.numero,resposta:q.respostaCorretaId||"A",anulada:!q.respostaCorretaId}));
  const {error:erroGabarito}=await supabase.from("simulados_oficiais_gabaritos").insert(gs);
  if(erroGabarito){await supabase.from("simulados_oficiais").delete().eq("id",simulado.id);throw new Error(`Erro ao salvar gabarito: ${erroGabarito.message}`);}
  return simulado as SimuladoOficial;
}
export async function publicarSimuladoOficial(id:string){const {error}=await supabase.from("simulados_oficiais").update({status:"publicado",publicado_em:new Date().toISOString()}).eq("id",id);if(error)throw new Error(error.message);}
export async function listarSimuladosOficiais(status?:SimuladoOficial["status"]){let q=supabase.from("simulados_oficiais").select("*").order("data_prova",{ascending:false});if(status)q=q.eq("status",status);const {data,error}=await q;if(error)throw new Error(error.message);return(data||[]) as SimuladoOficial[];}
export async function listarQuestoesSimuladoOficial(id:string){const {data,error}=await supabase.from("simulados_oficiais_questoes").select("*").eq("simulado_id",id).order("ordem");if(error)throw new Error(error.message);return(data||[]) as QuestaoOficial[];}
export async function iniciarTentativaOficial(id:string){const {data,error}=await supabase.from("simulados_oficiais_tentativas").insert({simulado_id:id}).select("*").single();if(error||!data)throw new Error(error?.message||"Não foi possível iniciar a tentativa.");return data as {id:string;numero_tentativa:number;conta_ranking:boolean;iniciada_em:string};}
export async function finalizarTentativaOficial(id:string,respostas:Record<string,string>,minutos:number){const {data,error}=await supabase.rpc("finalizar_simulado_oficial",{p_tentativa_id:id,p_respostas:respostas,p_minutos_gastos:Math.max(0,Math.round(minutos))});if(error)throw new Error(error.message);return data as ResultadoSimuladoOficial;}
export async function listarTentativasDoAluno(id:string){const {data,error}=await supabase.from("simulados_oficiais_tentativas").select("id,numero_tentativa,conta_ranking,iniciada_em,finalizada_em,finalizada,resultado").eq("simulado_id",id).order("numero_tentativa");if(error)throw new Error(error.message);return data||[];}
function arquivoParaBase64(arquivo:File):Promise<string>{return new Promise((resolve,reject)=>{const leitor=new FileReader();leitor.onload=()=>{const resultado=String(leitor.result||"");const i=resultado.indexOf(",");resolve(i>=0?resultado.slice(i+1):resultado)};leitor.onerror=()=>reject(new Error(`Não foi possível ler ${arquivo.name}.`));leitor.readAsDataURL(arquivo);});}
