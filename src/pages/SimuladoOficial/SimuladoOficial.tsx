import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { finalizarTentativaOficial, iniciarTentativaOficial, listarQuestoesSimuladoOficial, listarSimuladosOficiais, type QuestaoOficial, type SimuladoOficial as SimuladoOficialTipo, type ResultadoSimuladoOficial } from "../../services/simuladosOficiaisService";
import "./SimuladoOficial.css";

export default function SimuladoOficial() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [simulado, setSimulado] = useState<SimuladoOficialTipo | null>(null);
  const [questoes, setQuestoes] = useState<QuestaoOficial[]>([]);
  const [respostas, setRespostas] = useState<Record<string,string>>({});
  const [eliminadas, setEliminadas] = useState<Record<string,string[]>>({});
  const [indice, setIndice] = useState(0);
  const [tentativa, setTentativa] = useState<{id:string;numero_tentativa:number;conta_ranking:boolean;iniciada_em:string} | null>(null);
  const [inicio, setInicio] = useState<number>(Date.now());
  const [restante, setRestante] = useState(0);
  const [resultado, setResultado] = useState<ResultadoSimuladoOficial | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const [lista, qs] = await Promise.all([listarSimuladosOficiais("publicado"), listarQuestoesSimuladoOficial(id)]);
        const atual = lista.find((item) => item.id === id);
        if (!atual) throw new Error("Simulado não encontrado ou não está publicado.");
        if (!qs.length) throw new Error("Este simulado ainda não possui questões.");
        const t = await iniciarTentativaOficial(id);
        if (!ativo) return;
        setSimulado(atual); setQuestoes(qs); setTentativa(t); setInicio(Date.now()); setRestante(atual.duracao_minutos * 60);
      } catch (e) { if (ativo) setErro(e instanceof Error ? e.message : "Erro ao abrir o simulado."); }
      finally { if (ativo) setCarregando(false); }
    }
    void carregar(); return () => { ativo = false; };
  }, [id]);

  useEffect(() => {
    if (!tentativa || resultado) return;
    const timer = window.setInterval(() => {
      const decorrido = Math.floor((Date.now() - inicio) / 1000);
      const limite = (simulado?.duracao_minutos || 0) * 60;
      const r = Math.max(0, limite - decorrido);
      setRestante(r);
      if (r === 0) void finalizar();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [tentativa, inicio, simulado?.duracao_minutos, resultado]);

  const questao = questoes[indice];
  const selecionada = questao ? respostas[questao.id] : undefined;
  const eliminadasAtual = questao ? (eliminadas[questao.id] || []) : [];
  const progresso = questoes.length ? Math.round(((indice + 1) / questoes.length) * 100) : 0;

  const materias = useMemo(() => {
    const nomes = new Set(questoes.map((q) => q.materia));
    return [...nomes];
  }, [questoes]);

  function alternarEliminacao(alternativa: string) {
    if (!questao) return;
    setEliminadas((atual) => ({ ...atual, [questao.id]: eliminadasAtual.includes(alternativa) ? eliminadasAtual.filter((x) => x !== alternativa) : [...eliminadasAtual, alternativa] }));
  }

  function selecionar(alternativa: string) {
    if (!questao || eliminadasAtual.includes(alternativa)) return;
    setRespostas((atual) => ({ ...atual, [questao.id]: alternativa }));
  }

  async function finalizar() {
    if (!tentativa || finalizando || resultado) return;
    setFinalizando(true);
    try { const r = await finalizarTentativaOficial(tentativa.id, respostas, (Date.now() - inicio) / 60000); setResultado(r); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível corrigir o simulado."); }
    finally { setFinalizando(false); }
  }

  if (carregando) return <section className="simulado-oficial"><div className="oficial-carregando">Preparando prova...</div></section>;
  if (erro && !questao) return <section className="simulado-oficial"><div className="oficial-erro">{erro}<button onClick={() => navigate("/simulados")}>Voltar</button></div></section>;
  if (resultado && simulado) return <Resultado resultado={resultado} simulado={simulado} tentativa={tentativa} onVoltar={() => navigate("/simulados")} materias={materias} />;
  if (!questao || !simulado) return null;

  return <section className="simulado-oficial">
    <header className="prova-header"><div><span>{simulado.concurso_alvo} • {simulado.banca}</span><h1>{simulado.nome}</h1><small>Tentativa {tentativa?.numero_tentativa} {tentativa?.conta_ranking ? "• oficial para ranking" : "• treinamento"}</small></div><div className="cronometro-oficial">{formatarSegundos(restante)}</div></header>
    <div className="progresso-oficial"><span style={{width:`${progresso}%`}} /></div>
    <div className="prova-layout">
      <main className="questao-oficial">
        <div className="questao-cabecalho"><strong>Questão {questao.numero}</strong><span>{questao.materia} • {questao.assunto}</span></div>
        <div className="enunciado-oficial">{questao.enunciado}</div>
        <div className="alternativas-oficial">{questao.alternativas.map((a) => { const eliminada = eliminadasAtual.includes(a.id); return <div key={a.id} className={`alternativa-oficial ${selecionada === a.id ? "selecionada" : ""} ${eliminada ? "eliminada" : ""}`}><button className="letra-alternativa" onClick={() => selecionar(a.id)}>{a.id}</button><button className="texto-alternativa" onClick={() => selecionar(a.id)}>{a.texto}</button><button className="tesoura-oficial" title="Eliminar alternativa" onClick={() => alternarEliminacao(a.id)}>✂</button></div>; })}</div>
        <div className="navegacao-oficial"><button disabled={indice===0} onClick={() => setIndice((x)=>Math.max(0,x-1))}>← Anterior</button><button onClick={() => indice === questoes.length - 1 ? void finalizar() : setIndice((x)=>Math.min(questoes.length-1,x+1))}>{indice === questoes.length - 1 ? "Finalizar prova" : "Próxima →"}</button></div>
      </main>
      <aside className="mapa-questoes"><strong>Questões</strong><div>{questoes.map((q,i) => <button key={q.id} className={`${i===indice?"atual":""} ${respostas[q.id]?"respondida":""}`} onClick={() => setIndice(i)}>{q.numero}</button>)}</div><small>{Object.keys(respostas).length}/{questoes.length} respondidas</small></aside>
    </div>
  </section>;
}

function Resultado({ resultado, simulado, tentativa, onVoltar, materias }: { resultado: ResultadoSimuladoOficial; simulado: SimuladoOficialTipo; tentativa: { numero_tentativa:number; conta_ranking:boolean } | null; onVoltar:()=>void; materias:string[] }) {
  return <section className="resultado-oficial"><header><span>RESULTADO</span><h1>{simulado.nome}</h1><p>{tentativa?.conta_ranking ? "Esta foi sua primeira tentativa e entra no ranking." : "Esta tentativa foi registrada apenas como treinamento."}</p></header><div className="resultado-principal"><strong>{resultado.percentual}%</strong><span>{resultado.certas} acertos de {resultado.total - resultado.anuladas} questões válidas</span></div><div className="resultado-materias">{materias.map((materia) => { const item = resultado.porMateria.find((x)=>x.materia===materia); return <article key={materia}><strong>{materia}</strong><span>{item ? `${item.certas}/${item.total} • ${item.percentual}%` : "—"}</span></article>; })}</div><div className="resultado-resumo"><span>Erradas: {resultado.erradas}</span><span>Em branco: {resultado.emBranco}</span><span>Anuladas: {resultado.anuladas}</span></div><button onClick={onVoltar}>Voltar para simulados</button></section>;
}

function formatarSegundos(total: number) { const h=Math.floor(total/3600); const m=Math.floor((total%3600)/60); const s=total%60; return h > 0 ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }
