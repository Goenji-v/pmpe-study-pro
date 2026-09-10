import { useState } from "react";
import { useToast } from "../../context/ToastContext";
import {
  BANCAS_SIMULADO_OFICIAL,
  criarSimuladoOficial,
  publicarSimuladoOficial,
  type QuestaoOficial,
} from "../../services/simuladosOficiaisService";
import { analisarProvaOficialComContexto } from "../../services/simuladosOficiaisAnaliseService";
import "./SimuladosOficiaisAdminSection.css";

export default function SimuladosOficiaisAdminSection() {
  const { showToast } = useToast();
  const [nome, setNome] = useState("");
  const [concurso, setConcurso] = useState("");
  const [edital, setEdital] = useState("");
  const [banca, setBanca] = useState<string>("Instituto AOCP");
  const [outraBanca, setOutraBanca] = useState("");
  const [dataProva, setDataProva] = useState("");
  const [duracao, setDuracao] = useState(240);
  const [prova, setProva] = useState<File | null>(null);
  const [gabarito, setGabarito] = useState<File | null>(null);
  const [questoes, setQuestoes] = useState<QuestaoOficial[]>([]);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [publicadoId, setPublicadoId] = useState<string | null>(null);

  const bancaFinal = banca === "Outra" ? outraBanca.trim() : banca;

  async function analisar() {
    if (!nome.trim() || !concurso.trim() || !prova || !gabarito || !bancaFinal) {
      showToast("Preencha nome, concurso, banca e envie a prova e o gabarito em PDF.", "warning");
      return;
    }

    try {
      setAnalisando(true);
      setAlertas([]);
      const resultado = await analisarProvaOficialComContexto(prova, gabarito, {
        concurso: concurso.trim(),
        edital: edital.trim(),
        banca: bancaFinal,
      });
      if (!resultado.questoes.length) {
        throw new Error("A IA não encontrou questões na prova.");
      }
      setQuestoes(resultado.questoes);
      setAlertas(resultado.alertas);
      showToast(`${resultado.questoes.length} questões extraídas. Revise antes de publicar.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Falha ao analisar a prova.", "error");
    } finally {
      setAnalisando(false);
    }
  }

  function atualizarQuestao(index: number, patch: Partial<QuestaoOficial>) {
    setQuestoes((atual) => atual.map((questao, itemIndex) => (
      itemIndex === index ? { ...questao, ...patch } : questao
    )));
  }

  function atualizarAlternativa(index: number, alternativaId: string, texto: string) {
    setQuestoes((atual) => atual.map((questao, itemIndex) => {
      if (itemIndex !== index) return questao;
      return {
        ...questao,
        alternativas: questao.alternativas.map((alternativa) => (
          alternativa.id === alternativaId ? { ...alternativa, texto } : alternativa
        )),
      };
    }));
  }

  async function publicar() {
    if (!questoes.length || !prova || !gabarito) {
      showToast("Analise a prova antes de publicar.", "warning");
      return;
    }

    const incompletas = questoes.filter((questao) => (
      !questao.enunciado.trim() ||
      questao.alternativas.length < 2 ||
      questao.alternativas.some((alternativa) => !alternativa.texto.trim()) ||
      (!questao.respostaCorretaId && questao.statusSugerido !== "anulada")
    ));

    if (incompletas.length) {
      showToast(`Existem ${incompletas.length} questões incompletas na revisão.`, "warning");
      return;
    }

    try {
      setPublicando(true);
      const simulado = await criarSimuladoOficial({
        nome: nome.trim(),
        concursoAlvo: concurso.trim(),
        editalAlvo: edital,
        banca: bancaFinal,
        dataProva,
        duracaoMinutos: duracao,
        prova,
        gabarito,
        questoes,
      });
      await publicarSimuladoOficial(simulado.id);
      setPublicadoId(simulado.id);
      showToast("Simulado oficial publicado para o concurso.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Falha ao publicar o simulado.", "error");
    } finally {
      setPublicando(false);
    }
  }

  return (
    <section className="simulados-oficiais-admin" aria-labelledby="simulado-oficial-admin-titulo">
      <div className="simulados-oficiais-admin__topo">
        <div>
          <span className="simulados-oficiais-admin__etiqueta">ADMINISTRAÇÃO · SIMULADOS</span>
          <h2 id="simulado-oficial-admin-titulo">Adicionar simulado oficial</h2>
          <p>Use a mesma área de Simulados: envie a prova, analise com IA, revise e só então publique.</p>
        </div>
        {publicadoId && <span className="simulados-oficiais-admin__publicado">Publicado</span>}
      </div>

      <div className="simulados-oficiais-admin__formulario">
        <label>Nome do simulado<input value={nome} onChange={(evento) => setNome(evento.target.value)} placeholder="Ex.: PMPE 2024 — Soldado" /></label>
        <label>Concurso / curso<input value={concurso} onChange={(evento) => setConcurso(evento.target.value)} placeholder="Ex.: PMPE" /></label>
        <label>Edital<input value={edital} onChange={(evento) => setEdital(evento.target.value)} placeholder="Ex.: PMPE 2024" /></label>
        <label>Banca<select value={banca} onChange={(evento) => setBanca(evento.target.value)}>{BANCAS_SIMULADO_OFICIAL.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        {banca === "Outra" && <label>Nome da banca<input value={outraBanca} onChange={(evento) => setOutraBanca(evento.target.value)} placeholder="Informe a banca" /></label>}
        <label>Data da prova<input type="date" value={dataProva} onChange={(evento) => setDataProva(evento.target.value)} /></label>
        <label>Duração (minutos)<input type="number" min={1} max={1440} value={duracao} onChange={(evento) => setDuracao(Math.max(1, Math.min(1440, Number(evento.target.value) || 1)))} /></label>
        <label>PDF da prova<input type="file" accept="application/pdf,.pdf" onChange={(evento) => setProva(evento.target.files?.[0] ?? null)} /></label>
        <label>PDF do gabarito<input type="file" accept="application/pdf,.pdf" onChange={(evento) => setGabarito(evento.target.files?.[0] ?? null)} /></label>
      </div>

      <button className="simulados-oficiais-admin__analisar" type="button" onClick={analisar} disabled={analisando || publicando}>
        {analisando ? "Analisando prova com IA..." : "Analisar prova com IA"}
      </button>

      {alertas.length > 0 && (
        <div className="simulados-oficiais-admin__alertas">
          <strong>Atenção antes da publicação</strong>
          <ul>{alertas.slice(0, 8).map((alerta, index) => <li key={`${alerta}-${index}`}>{alerta}</li>)}</ul>
        </div>
      )}

      {questoes.length > 0 && (
        <div className="simulados-oficiais-admin__revisao">
          <div className="simulados-oficiais-admin__revisao-topo">
            <div><strong>Revisão humana · {questoes.length} questões</strong><span>A IA apenas extrai e sugere. O administrador confirma o conteúdo antes da publicação.</span></div>
            <button type="button" onClick={publicar} disabled={publicando}>{publicando ? "Publicando..." : "Revisar e publicar"}</button>
          </div>

          {questoes.map((questao, index) => (
            <article className="simulados-oficiais-admin__questao" key={`${questao.numero}-${index}`}>
              <div className="simulados-oficiais-admin__questao-numero">Questão {questao.numero}</div>
              <label>Enunciado<textarea value={questao.enunciado} onChange={(evento) => atualizarQuestao(index, { enunciado: evento.target.value })} rows={5} /></label>
              <div className="simulados-oficiais-admin__alternativas">
                {questao.alternativas.map((alternativa) => (
                  <label key={alternativa.id}><span>{alternativa.id}</span><input value={alternativa.texto} onChange={(evento) => atualizarAlternativa(index, alternativa.id, evento.target.value)} /></label>
                ))}
              </div>
              <div className="simulados-oficiais-admin__metadados">
                <label>Matéria<input value={questao.materia} onChange={(evento) => atualizarQuestao(index, { materia: evento.target.value })} /></label>
                <label>Assunto<input value={questao.assunto} onChange={(evento) => atualizarQuestao(index, { assunto: evento.target.value })} /></label>
                <label>Gabarito<select value={questao.respostaCorretaId || ""} onChange={(evento) => atualizarQuestao(index, { respostaCorretaId: evento.target.value })} disabled={questao.statusSugerido === "anulada"}><option value="">Selecione</option>{questao.alternativas.map((alternativa) => <option key={alternativa.id} value={alternativa.id}>{alternativa.id}</option>)}</select></label>
                <label>Status<select value={questao.statusSugerido || "pendente"} onChange={(evento) => atualizarQuestao(index, { statusSugerido: evento.target.value as QuestaoOficial["statusSugerido"] })}><option value="pendente">Pendente</option><option value="anulada">Anulada</option><option value="desatualizada">Desatualizada</option><option value="duvidosa">Duvidosa</option></select></label>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
