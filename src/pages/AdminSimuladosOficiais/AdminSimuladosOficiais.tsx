import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { analisarProvaOficial, criarSimuladoOficial, publicarSimuladoOficial, type QuestaoOficial } from "../../services/simuladosOficiaisService";
import "./AdminSimuladosOficiais.css";

const BANCAS = ["Instituto AOCP", "Cebraspe", "FGV", "FCC", "Vunesp", "IBFC", "Idecan", "Cesgranrio", "Quadrix", "Consulplan", "Outra"];

export default function AdminSimuladosOficiais() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [nome, setNome] = useState("");
  const [concurso, setConcurso] = useState("PMPE");
  const [edital, setEdital] = useState("PMPE 2024");
  const [banca, setBanca] = useState("Instituto AOCP");
  const [dataProva, setDataProva] = useState("");
  const [duracao, setDuracao] = useState(240);
  const [prova, setProva] = useState<File | null>(null);
  const [gabarito, setGabarito] = useState<File | null>(null);
  const [questoes, setQuestoes] = useState<QuestaoOficial[]>([]);
  const [etapa, setEtapa] = useState<"form" | "revisao">("form");
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function analisar() {
    if (!nome.trim() || !prova || !gabarito) { showToast("Informe o nome e envie a prova e o gabarito em PDF.", "warning"); return; }
    if (banca === "Outra") { showToast("Selecione uma banca conhecida ou informe a banca no campo adicional antes de continuar.", "warning"); return; }
    setProcessando(true);
    try {
      const resultado = await analisarProvaOficial({ prova, gabarito, concursoAlvo: concurso, editalAlvo: edital, concursoOrigem: concurso, cargoOrigem: "", anoOrigem: Number(edital.match(/20\d{2}/)?.[0] || new Date().getFullYear()), banca });
      const extraidas = (resultado.questoes || []).map((q, index) => ({ ...q, id: q.id || crypto.randomUUID(), numero: q.numeroOriginal || index + 1, ordem: index + 1 }));
      setQuestoes(extraidas);
      setEtapa("revisao");
      showToast(`${extraidas.length} questões extraídas. Revise antes de publicar.`, "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "Falha na análise da prova.", "error"); }
    finally { setProcessando(false); }
  }

  function atualizarQuestao(index: number, patch: Partial<QuestaoOficial>) {
    setQuestoes((atual) => atual.map((q, i) => i === index ? { ...q, ...patch } : q));
  }

  async function salvarPublicar() {
    if (!questoes.length) return;
    if (questoes.some((q) => !q.enunciado.trim() || !q.alternativas.length || !q.respostaCorretaId)) { showToast("Revise todas as questões: cada uma precisa de enunciado, alternativas e gabarito.", "warning"); return; }
    setSalvando(true);
    try {
      const simulado = await criarSimuladoOficial({ nome: nome.trim(), concursoAlvo: concurso.trim(), editalAlvo: edital.trim(), banca, dataProva, duracaoMinutos: duracao, fonteProvaNome: prova?.name || "prova.pdf", fonteGabaritoNome: gabarito?.name || "gabarito.pdf", questoes });
      await publicarSimuladoOficial(simulado.id);
      showToast("Simulado oficial publicado para o concurso.", "success");
      navigate("/simulados");
    } catch (error) { showToast(error instanceof Error ? error.message : "Não foi possível publicar o simulado.", "error"); }
    finally { setSalvando(false); }
  }

  return <section className="admin-simulados-oficiais">
    <header><div><span>ADMINISTRAÇÃO</span><h1>Simulados oficiais</h1><p>Importe a prova + gabarito, revise a extração da IA e publique para os alunos.</p></div><button onClick={() => navigate("/admin")}>Voltar</button></header>
    {etapa === "form" ? <div className="oficial-form">
      <div className="oficial-grid">
        <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: PMPE — Simulado Oficial 01" /></label>
        <label>Concurso<input value={concurso} onChange={(e) => setConcurso(e.target.value)} /></label>
        <label>Edital<input value={edital} onChange={(e) => setEdital(e.target.value)} /></label>
        <label>Banca<select value={banca} onChange={(e) => setBanca(e.target.value)}>{BANCAS.map((item) => <option key={item}>{item}</option>)}</select></label>
        {banca === "Outra" && <label>Nome da banca<input placeholder="Informe a banca" onChange={(e) => setBanca(e.target.value)} /></label>}
        <label>Data da prova<input type="date" value={dataProva} onChange={(e) => setDataProva(e.target.value)} /></label>
        <label>Duração (minutos)<input type="number" min={1} max={1440} value={duracao} onChange={(e) => setDuracao(Math.max(1, Number(e.target.value)))} /></label>
      </div>
      <div className="oficial-arquivos">
        <label>PDF da prova<input type="file" accept="application/pdf,.pdf" onChange={(e) => setProva(e.target.files?.[0] || null)} /></label>
        <label>PDF do gabarito<input type="file" accept="application/pdf,.pdf" onChange={(e) => setGabarito(e.target.files?.[0] || null)} /></label>
      </div>
      <button className="oficial-principal" disabled={processando} onClick={analisar}>{processando ? "IA analisando prova..." : "Analisar prova com IA"}</button>
      <small>A publicação só acontece depois desta revisão. A IA não publica automaticamente.</small>
    </div> : <div className="oficial-revisao">
      <div className="revisao-topo"><div><strong>{questoes.length} questões extraídas</strong><span>Revise classificação, enunciado, alternativas e gabarito.</span></div><button onClick={() => setEtapa("form")}>Recomeçar</button></div>
      {questoes.map((q, index) => <article key={q.id} className="questao-revisao">
        <div className="questao-numero">{q.numero}</div>
        <div className="questao-corpo">
          <label>Enunciado<textarea value={q.enunciado} onChange={(e) => atualizarQuestao(index, { enunciado: e.target.value })} /></label>
          <div className="questao-meta"><label>Matéria<input value={q.materia} onChange={(e) => atualizarQuestao(index, { materia: e.target.value })} /></label><label>Assunto<input value={q.assunto} onChange={(e) => atualizarQuestao(index, { assunto: e.target.value })} /></label><label>Gabarito<select value={q.respostaCorretaId || ""} onChange={(e) => atualizarQuestao(index, { respostaCorretaId: e.target.value })}><option value="">Selecione</option>{["A","B","C","D","E"].map((x) => <option key={x}>{x}</option>)}</select></label></div>
          <div className="alternativas">{q.alternativas.map((a) => <div key={a.id}><b>{a.id}</b><input value={a.texto} onChange={(e) => atualizarQuestao(index, { alternativas: q.alternativas.map((x) => x.id === a.id ? { ...x, texto: e.target.value } : x) })} /></div>)}</div>
        </div>
      </article>)}
      <button className="oficial-principal" disabled={salvando} onClick={salvarPublicar}>{salvando ? "Publicando..." : "Revisar e publicar simulado"}</button>
    </div>}
  </section>;
}
