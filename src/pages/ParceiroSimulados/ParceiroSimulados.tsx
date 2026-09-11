import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { carregarContextoComercial, carregarGestaoParceiro, type TurmaParceiro } from "../../services/parceriasService";
import {
  alterarStatusSimuladoProfessor,
  carregarPainelSimuladoProfessor,
  criarSimuladoProfessor,
  excluirSimuladoProfessor,
  listarSimuladosProfessor,
  type PainelSimuladoProfessor,
  type QuestaoProfessor,
  type SimuladoProfessor,
} from "../../services/simuladosProfessorService";
import "./ParceiroSimulados.css";

const ALTERNATIVAS = ["A", "B", "C", "D"];

export default function ParceiroSimulados() {
  const navigate = useNavigate();
  const [simulados, setSimulados] = useState<SimuladoProfessor[]>([]);
  const [turmas, setTurmas] = useState<TurmaParceiro[]>([]);
  const [parceiroId, setParceiroId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [painelId, setPainelId] = useState<string | null>(null);
  const [painel, setPainel] = useState<PainelSimuladoProfessor | null>(null);
  const [form, setForm] = useState(formInicial());

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const contexto = await carregarContextoComercial();
      if (!contexto.parceiroId || !["proprietario", "gestor", "professor"].includes(contexto.papel)) {
        throw new Error("Esta área é exclusiva do professor ou gestor da mentoria.");
      }
      const gestao = await carregarGestaoParceiro();
      const lista = await listarSimuladosProfessor(contexto.parceiroId);
      setParceiroId(contexto.parceiroId);
      setTurmas(gestao.turmas.filter((item) => item.ativa));
      setSimulados(lista);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os simulados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const nomesTurmas = useMemo(() => new Map(turmas.map((item) => [item.id, item.nome])), [turmas]);

  function atualizarQuestao(indice: number, campo: keyof QuestaoProfessor, valor: string) {
    setForm((atual) => ({
      ...atual,
      questoes: atual.questoes.map((questao, i) => i === indice ? { ...questao, [campo]: valor } : questao),
    }));
  }

  function atualizarAlternativa(indiceQuestao: number, id: string, texto: string) {
    setForm((atual) => ({
      ...atual,
      questoes: atual.questoes.map((questao, i) => i === indiceQuestao ? {
        ...questao,
        alternativas: questao.alternativas.map((alternativa) => alternativa.id === id ? { ...alternativa, texto } : alternativa),
      } : questao),
    }));
  }

  function alternarTurma(id: string) {
    setForm((atual) => ({
      ...atual,
      turmas: atual.turmas.includes(id) ? atual.turmas.filter((item) => item !== id) : [...atual.turmas, id],
    }));
  }

  async function salvar() {
    setMensagem("");
    setErro("");
    const questoesInvalidas = form.questoes.some((q) => !q.enunciado.trim() || q.alternativas.some((a) => !a.texto.trim()));
    if (!form.nome.trim()) return setErro("Informe o nome do simulado.");
    if (!form.turmas.length) return setErro("Selecione ao menos uma turma.");
    if (questoesInvalidas) return setErro("Preencha o enunciado e todas as alternativas das questões.");
    if (form.abreEm && form.encerraEm && new Date(form.encerraEm) <= new Date(form.abreEm)) return setErro("O encerramento precisa ser posterior à abertura.");

    setSalvando(true);
    try {
      await criarSimuladoProfessor({
        nome: form.nome,
        descricao: form.descricao,
        concurso: form.concurso,
        banca: form.banca,
        duracaoMinutos: Number(form.duracao) || 60,
        abreEm: iso(form.abreEm),
        encerraEm: iso(form.encerraEm),
        resultadoLiberadoEm: iso(form.resultadoEm),
        turmas: form.turmas,
        questoes: form.questoes,
        bonificacoes: form.premios.split("\n").map((premio, index) => ({ posicao: index + 1, premio: premio.trim() })).filter((item) => item.premio).slice(0, 5),
        exigirTelaCheia: form.telaCheia,
        registrarIntegridade: form.integridade,
      });
      setMensagem("Simulado salvo como rascunho. Revise e publique quando estiver pronto.");
      setForm(formInicial());
      setCriando(false);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o simulado.");
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatus(id: string, status: "publicado" | "encerrado") {
    setErro("");
    try {
      await alterarStatusSimuladoProfessor(id, status);
      setMensagem(status === "publicado" ? "Simulado publicado para as turmas selecionadas." : "Simulado encerrado.");
      await carregar();
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível alterar o simulado."); }
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este rascunho e todas as questões?")) return;
    try { await excluirSimuladoProfessor(id); await carregar(); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível excluir o rascunho."); }
  }

  async function abrirPainel(id: string) {
    setPainelId(id); setPainel(null); setErro("");
    try { setPainel(await carregarPainelSimuladoProfessor(id)); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível carregar os resultados."); }
  }

  if (carregando) return <section className="parceiro-simulados"><div className="psim-estado">Carregando simulados...</div></section>;

  return (
    <section className="parceiro-simulados">
      <header className="psim-hero">
        <div><span>MENTORIA · SIMULADOS</span><h1>Simulados do Professor</h1><p>Crie provas por turma, defina janela de aplicação e acompanhe ranking, desempenho e eventos de integridade.</p></div>
        <div className="psim-acoes"><button type="button" className="secundario" onClick={() => navigate("/parceiro")}>Painel do parceiro</button><button type="button" onClick={() => setCriando((v) => !v)}>{criando ? "Fechar editor" : "+ Novo simulado"}</button></div>
      </header>

      {erro && <div className="psim-aviso erro">{erro}</div>}
      {mensagem && <div className="psim-aviso sucesso">{mensagem}</div>}

      {criando && (
        <section className="psim-editor">
          <div className="psim-form-grid">
            <label>Nome<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Simulado 01 · PMPE" /></label>
            <label>Concurso<input value={form.concurso} onChange={(e) => setForm({ ...form, concurso: e.target.value })} /></label>
            <label>Banca<input value={form.banca} onChange={(e) => setForm({ ...form, banca: e.target.value })} placeholder="Ex.: AOCP" /></label>
            <label>Duração (min)<input type="number" min="1" max="1440" value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value })} /></label>
            <label>Abertura<input type="datetime-local" value={form.abreEm} onChange={(e) => setForm({ ...form, abreEm: e.target.value })} /></label>
            <label>Encerramento<input type="datetime-local" value={form.encerraEm} onChange={(e) => setForm({ ...form, encerraEm: e.target.value })} /></label>
            <label>Resultado liberado em<input type="datetime-local" value={form.resultadoEm} onChange={(e) => setForm({ ...form, resultadoEm: e.target.value })} /><small>Deixe vazio para liberar imediatamente.</small></label>
            <label className="psim-descricao">Descrição<textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Orientações para a prova..." /></label>
          </div>

          <div className="psim-turmas"><strong>Turmas que receberão a prova</strong><div>{turmas.map((turma) => <label key={turma.id}><input type="checkbox" checked={form.turmas.includes(turma.id)} onChange={() => alternarTurma(turma.id)} />{turma.nome}</label>)}</div></div>

          <div className="psim-config"><label><input type="checkbox" checked={form.telaCheia} onChange={(e) => setForm({ ...form, telaCheia: e.target.checked })} /> Solicitar tela cheia ao iniciar</label><label><input type="checkbox" checked={form.integridade} onChange={(e) => setForm({ ...form, integridade: e.target.checked })} /> Registrar troca de aba, perda de foco e saída da tela cheia</label></div>

          <label className="psim-premios">Prêmios/bonificações do Top 5<textarea value={form.premios} onChange={(e) => setForm({ ...form, premios: e.target.value })} placeholder={"1º prêmio\n2º prêmio\n3º prêmio"} /><small>Opcional. Uma linha por posição, até o Top 5.</small></label>

          <div className="psim-questoes-cab"><div><span>QUESTÕES</span><strong>{form.questoes.length} cadastrada(s)</strong></div><button type="button" className="secundario" onClick={() => setForm({ ...form, questoes: [...form.questoes, novaQuestao()] })}>+ Adicionar questão</button></div>
          <div className="psim-questoes">
            {form.questoes.map((questao, indice) => (
              <article key={indice}>
                <header><strong>Questão {indice + 1}</strong>{form.questoes.length > 1 && <button type="button" onClick={() => setForm({ ...form, questoes: form.questoes.filter((_, i) => i !== indice) })}>Remover</button>}</header>
                <div className="psim-qmeta"><input value={questao.materia} onChange={(e) => atualizarQuestao(indice, "materia", e.target.value)} placeholder="Matéria" /><input value={questao.assunto} onChange={(e) => atualizarQuestao(indice, "assunto", e.target.value)} placeholder="Assunto" /><select value={questao.dificuldade} onChange={(e) => atualizarQuestao(indice, "dificuldade", e.target.value)}><option value="facil">Fácil</option><option value="media">Média</option><option value="dificil">Difícil</option></select></div>
                <textarea className="psim-enunciado" value={questao.enunciado} onChange={(e) => atualizarQuestao(indice, "enunciado", e.target.value)} placeholder="Enunciado da questão" />
                <div className="psim-alternativas">{questao.alternativas.map((alt) => <label key={alt.id} className={questao.respostaCorretaId === alt.id ? "correta" : ""}><input type="radio" name={`gabarito-${indice}`} checked={questao.respostaCorretaId === alt.id} onChange={() => atualizarQuestao(indice, "respostaCorretaId", alt.id)} /><b>{alt.id}</b><input value={alt.texto} onChange={(e) => atualizarAlternativa(indice, alt.id, e.target.value)} placeholder={`Alternativa ${alt.id}`} /></label>)}</div>
                <input value={questao.explicacao ?? ""} onChange={(e) => atualizarQuestao(indice, "explicacao", e.target.value)} placeholder="Explicação do gabarito (opcional)" />
              </article>
            ))}
          </div>
          <div className="psim-salvar"><button type="button" disabled={salvando} onClick={() => void salvar()}>{salvando ? "Salvando..." : "Salvar como rascunho"}</button></div>
        </section>
      )}

      <section className="psim-lista">
        <header><div><span>PROVAS CADASTRADAS</span><h2>{simulados.length} simulado(s)</h2></div></header>
        {simulados.length === 0 ? <div className="psim-estado">Nenhum simulado criado ainda.</div> : simulados.map((simulado) => (
          <article key={simulado.id} className="psim-card">
            <div className="psim-card-principal"><div className="psim-status"><span className={simulado.status}>{simulado.status}</span><small>{simulado.total_questoes} questões · {simulado.duracao_minutos} min</small></div><h3>{simulado.nome}</h3><p>{simulado.descricao || `${simulado.concurso_alvo} · ${simulado.banca}`}</p><div className="psim-tags">{simulado.turmas.map((id) => <span key={id}>{nomesTurmas.get(id) || "Turma"}</span>)}</div><div className="psim-datas"><small>Abertura: {dataHora(simulado.abre_em) || "imediata"}</small><small>Encerramento: {dataHora(simulado.encerra_em) || "sem prazo"}</small><small>Resultado: {dataHora(simulado.resultado_liberado_em) || "imediato"}</small></div></div>
            <div className="psim-card-acoes">{simulado.status === "rascunho" && <><button type="button" onClick={() => void mudarStatus(simulado.id, "publicado")}>Publicar</button><button type="button" className="perigo" onClick={() => void excluir(simulado.id)}>Excluir</button></>}{simulado.status === "publicado" && <button type="button" className="secundario" onClick={() => void mudarStatus(simulado.id, "encerrado")}>Encerrar</button>}<button type="button" className="secundario" onClick={() => void abrirPainel(simulado.id)}>Resultados</button></div>
            {painelId === simulado.id && <PainelResultados painel={painel} onAluno={(id) => navigate(`/parceiro/mentoria/aluno/${id}`)} />}
          </article>
        ))}
      </section>
      <input type="hidden" value={parceiroId} readOnly />
    </section>
  );
}

function PainelResultados({ painel, onAluno }: { painel: PainelSimuladoProfessor | null; onAluno: (id: string) => void }) {
  if (!painel) return <div className="psim-resultado"><div className="psim-estado">Carregando resultados...</div></div>;
  return <div className="psim-resultado"><div className="psim-kpis"><div><strong>{painel.oficiaisConcluidas}</strong><span>oficiais concluídas</span></div><div><strong>{painel.treinosConcluidos}</strong><span>treinos</span></div><div><strong>{painel.mediaPercentual.toFixed(1)}%</strong><span>média</span></div><div><strong>{painel.alertasIntegridade}</strong><span>alertas de integridade</span></div></div><div className="psim-ranking"><div className="linha cab"><span>#</span><span>Aluno</span><span>Turma</span><span>Acertos</span><span>%</span><span>Tempo</span><span>Alertas</span></div>{painel.ranking.length === 0 ? <p>Nenhuma tentativa oficial concluída.</p> : painel.ranking.map((item, indice) => <button type="button" className="linha" key={`${item.usuarioId}-${indice}`} onClick={() => onAluno(item.usuarioId)}><span>{indice + 1}º</span><span>{item.nome}</span><span>{item.turma}</span><span>{item.certas}</span><span>{item.percentual.toFixed(1)}%</span><span>{item.minutos} min</span><span>{item.alertas}</span></button>)}</div></div>;
}

function formInicial() { return { nome: "", descricao: "", concurso: "PMPE", banca: "", duracao: "60", abreEm: "", encerraEm: "", resultadoEm: "", turmas: [] as string[], premios: "", telaCheia: true, integridade: true, questoes: [novaQuestao()] }; }
function novaQuestao(): QuestaoProfessor { return { materia: "", assunto: "", dificuldade: "media", enunciado: "", alternativas: ALTERNATIVAS.map((id) => ({ id, texto: "" })), respostaCorretaId: "A", explicacao: "" }; }
function iso(valor: string) { return valor ? new Date(valor).toISOString() : null; }
function dataHora(valor: string | null) { if (!valor) return ""; const d = new Date(valor); return Number.isNaN(d.getTime()) ? valor : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
