import { useState } from "react";
import { useToast } from "../../context/ToastContext";
import {
  analisarProvaOficial,
  criarSimuladoOficial,
  publicarSimuladoOficial,
  type QuestaoOficial,
} from "../../services/simuladosOficiaisService";
import "./SimuladosOficiaisAdminSection.css";

const BANCAS = [
  "Instituto AOCP",
  "Cebraspe",
  "FGV",
  "FCC",
  "Vunesp",
  "IBFC",
  "Idecan",
  "Cesgranrio",
  "Quadrix",
  "Consulplan",
  "Outra",
];

type Props = { onPublished?: () => void };

export default function SimuladosOficiaisAdminSection({ onPublished }: Props) {
  const { showToast } = useToast();
  const [nome, setNome] = useState("");
  const [concurso, setConcurso] = useState("");
  const [banca, setBanca] = useState("Instituto AOCP");
  const [outraBanca, setOutraBanca] = useState("");
  const [data, setData] = useState("");
  const [duracao, setDuracao] = useState(240);
  const [prova, setProva] = useState<File | null>(null);
  const [gabarito, setGabarito] = useState<File | null>(null);
  const [questoes, setQuestoes] = useState<QuestaoOficial[]>([]);
  const [simuladoId, setSimuladoId] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [publicando, setPublicando] = useState(false);

  const bancaFinal = banca === "Outra" ? outraBanca.trim() : banca;

  async function analisar() {
    if (!nome.trim() || !concurso.trim() || !data || !prova || !gabarito || !bancaFinal) {
      showToast("Preencha os dados e envie a prova e o gabarito.", "warning");
      return;
    }
    try {
      setAnalisando(true);
      const resultado = await analisarProvaOficial(prova, gabarito);
      if (!resultado.questoes.length) throw new Error("A IA não encontrou questões na prova.");
      setQuestoes(resultado.questoes);
      showToast(`${resultado.questoes.length} questões extraídas. Revise antes de publicar.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Falha ao analisar a prova.", "error");
    } finally {
      setAnalisando(false);
    }
  }

  function atualizarQuestao(index: number, patch: Partial<QuestaoOficial>) {
    setQuestoes((atual) => atual.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  async function publicar() {
    if (!questoes.length) {
      showToast("Analise a prova antes de publicar.", "warning");
      return;
    }
    try {
      setPublicando(true);
      const criado = await criarSimuladoOficial({
        nome: nome.trim(),
        concurso: concurso.trim(),
        banca: bancaFinal,
        dataProva: data,
        duracaoMinutos: duracao,
        questoes,
        prova,
        gabarito,
      });
      setSimuladoId(criado.id);
      await publicarSimuladoOficial(criado.id);
      showToast("Simulado oficial publicado com sucesso.", "success");
      onPublished?.();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Falha ao publicar o simulado.", "error");
    } finally {
      setPublicando(false);
    }
  }

  return (
    <section className="simulados-oficiais-admin">
      <div className="simulados-oficiais-admin__header">
        <div>
          <span className="simulados-oficiais-admin__eyebrow">SIMULADO OFICIAL</span>
          <h2>Adicionar prova oficial</h2>
          <p>Envie a prova e o gabarito. A IA extrai as questões e você revisa antes da publicação.</p>
        </div>
      </div>

      <div className="simulados-oficiais-admin__form">
        <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: PMPE 2024 — Soldado" /></label>
        <label>Concurso / curso<input value={concurso} onChange={(e) => setConcurso(e.target.value)} placeholder="Ex.: PMPE" /></label>
        <label>Banca<select value={banca} onChange={(e) => setBanca(e.target.value)}>{BANCAS.map((item) => <option key={item}>{item}</option>)}</select></label>
        {banca === "Outra" && <label>Nome da banca<input value={outraBanca} onChange={(e) => setOutraBanca(e.target.value)} placeholder="Digite a banca" /></label>}
        <label>Data da prova<input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
        <label>Tempo (minutos)<input type="number" min={1} value={duracao} onChange={(e) => setDuracao(Math.max(1, Number(e.target.value)))} /></label>
        <label>PDF da prova<input type="file" accept="application/pdf,.pdf" onChange={(e) => setProva(e.target.files?.[0] ?? null)} /></label>
        <label>PDF do gabarito<input type="file" accept="application/pdf,.pdf" onChange={(e) => setGabarito(e.target.files?.[0] ?? null)} /></label>
      </div>

      <button className="simulados-oficiais-admin__analisar" type="button" onClick={analisar} disabled={analisando || publicando}>
        {analisando ? "Analisando prova..." : "Analisar prova com IA"}
      </button>

      {questoes.length > 0 && (
        <div className="simulados-oficiais-admin__review">
          <div className="simulados-oficiais-admin__review-head">
            <h3>Revisão das questões ({questoes.length})</h3>
            <button type="button" onClick={publicar} disabled={publicando}>{publicando ? "Publicando..." : "Revisar e publicar"}</button>
          </div>
          {questoes.map((q, index) => (
            <article key={`${q.numeroOriginal ?? index}-${index}`} className="simulados-oficiais-admin__question">
              <strong>Questão {q.numeroOriginal ?? index + 1}</strong>
              <textarea value={q.enunciado} onChange={(e) => atualizarQuestao(index, { enunciado: e.target.value })} rows={4} />
              <div className="simulados-oficiais-admin__alternativas">
                {q.alternativas.map((alternativa, alternativaIndex) => (
                  <label key={alternativaIndex}>
                    {String.fromCharCode(65 + alternativaIndex)}
                    <input value={alternativa} onChange={(e) => {
                      const novas = [...q.alternativas]; novas[alternativaIndex] = e.target.value; atualizarQuestao(index, { alternativas: novas });
                    }} />
                  </label>
                ))}
              </div>
              <div className="simulados-oficiais-admin__meta">
                <label>Gabarito<select value={q.gabarito} onChange={(e) => atualizarQuestao(index, { gabarito: e.target.value })}>{q.alternativas.map((_, i) => <option key={i}>{String.fromCharCode(65 + i)}</option>)}</select></label>
                <label>Matéria<input value={q.materia ?? ""} onChange={(e) => atualizarQuestao(index, { materia: e.target.value })} /></label>
                <label>Assunto<input value={q.assunto ?? ""} onChange={(e) => atualizarQuestao(index, { assunto: e.target.value })} /></label>
              </div>
            </article>
          ))}
        </div>
      )}

      {simuladoId && <p className="simulados-oficiais-admin__published">Publicado: {simuladoId}</p>}
    </section>
  );
}
