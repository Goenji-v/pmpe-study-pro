import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { registrarTarefaMentoriaAtiva, limparTarefaMentoriaAtiva } from "../../components/MentoriaCronometroBridge/MentoriaCronometroBridge";
import {
  atualizarStatusTarefaMentoria,
  carregarMinhaTrilhaMentoria,
  listarMinhasTarefasMentoria,
  recalcularMeuCronogramaMentoria,
  salvarDisponibilidadeMentoria,
  salvarPreferenciasMentoria,
  type DisponibilidadeMentoria,
  type PreferenciasCronogramaMentoria,
  type TarefaMentoria,
  type TrilhaMentoria,
} from "../../services/mentoriaService";
import type { DadosIniciarSessao } from "../../context/CronometroContext";
import "./CronogramaMentoria.css";

const NOMES_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Props = { trilhaInicial: TrilhaMentoria };

export default function CronogramaMentoria({ trilhaInicial }: Props) {
  const navigate = useNavigate();
  const [trilha, setTrilha] = useState(trilhaInicial);
  const [tarefas, setTarefas] = useState<TarefaMentoria[]>([]);
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeMentoria[]>(() => disponibilidadeInicial(trilhaInicial));
  const [preferencias, setPreferencias] = useState<PreferenciasCronogramaMentoria>(() => preferenciasIniciais(trilhaInicial));
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [configAberta, setConfigAberta] = useState(false);

  const inicio = useMemo(() => adicionarDias(dataLocalIso(), -7), []);
  const fim = useMemo(() => adicionarDias(dataLocalIso(), 45), []);

  const carregar = useCallback(async (gerarSeVazio = false) => {
    try {
      setCarregando(true);
      setErro("");
      const trilhaAtual = await carregarMinhaTrilhaMentoria();
      if (trilhaAtual) {
        setTrilha(trilhaAtual);
        setDisponibilidade(disponibilidadeInicial(trilhaAtual));
        setPreferencias(preferenciasIniciais(trilhaAtual));
      }
      let lista = await listarMinhasTarefasMentoria(inicio, fim);
      const futuras = lista.filter((item) => item.data >= dataLocalIso() && !["concluido", "pulado"].includes(item.status));
      if (gerarSeVazio && futuras.length === 0) {
        await recalcularMeuCronogramaMentoria(dataLocalIso(), 30, "geracao_inicial");
        lista = await listarMinhasTarefasMentoria(inicio, fim);
      }
      setTarefas(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o cronograma da mentoria.");
    } finally {
      setCarregando(false);
    }
  }, [inicio, fim]);

  useEffect(() => { void carregar(true); }, [carregar]);

  useEffect(() => {
    const atualizar = () => void carregar(false);
    window.addEventListener("pmpe-mentoria-cronograma-atualizado", atualizar);
    return () => window.removeEventListener("pmpe-mentoria-cronograma-atualizado", atualizar);
  }, [carregar]);

  const hoje = dataLocalIso();
  const tarefasHoje = tarefas.filter((item) => item.data === hoje && item.status !== "pulado");
  const tarefaAtual = tarefasHoje.find((item) => item.status === "em_andamento") ?? tarefasHoje.find((item) => item.status === "pendente" || item.status === "atrasado") ?? null;
  const proximosDias = agruparPorData(tarefas.filter((item) => item.data > hoje && item.status !== "pulado").slice(0, 40));
  const concluidasRecentes = tarefas.filter((item) => item.status === "concluido").slice(-8).reverse();
  const progresso = trilha.itens.length ? Math.round((trilha.itens.filter((item) => item.concluido).length / trilha.itens.length) * 100) : 0;

  async function salvarERecalcular() {
    try {
      setProcessando("config");
      setErro("");
      setMensagem("");
      await Promise.all([
        salvarDisponibilidadeMentoria(disponibilidade),
        salvarPreferenciasMentoria(preferencias),
      ]);
      await recalcularMeuCronogramaMentoria(dataLocalIso(), 30, "disponibilidade_atualizada");
      setMensagem("Rotina salva e próximos 30 dias reorganizados. O histórico concluído foi preservado.");
      setConfigAberta(false);
      await carregar(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar a rotina.");
    } finally {
      setProcessando("");
    }
  }

  async function recalcular() {
    try {
      setProcessando("recalcular");
      setErro("");
      setMensagem("");
      await recalcularMeuCronogramaMentoria(dataLocalIso(), 30, "recalculo_manual_aluno");
      setMensagem("Cronograma recalculado. Atividades concluídas continuam no histórico.");
      await carregar(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível recalcular o cronograma.");
    } finally {
      setProcessando("");
    }
  }

  async function iniciarTarefa(tarefa: TarefaMentoria) {
    try {
      setProcessando(tarefa.id);
      setErro("");
      await atualizarStatusTarefaMentoria(tarefa.id, "em_andamento");
      limparTarefaMentoriaAtiva();
      registrarTarefaMentoriaAtiva({ id: tarefa.id, materia: tarefa.materia, assunto: tarefa.assunto, iniciadaEm: new Date().toISOString() });
      const prefillSessao: DadosIniciarSessao = {
        materia: tarefa.materia,
        assunto: tarefa.assunto,
        tipo: tipoSessao(tarefa),
        formatoRevisao: tarefa.tipo === "revisao" && tarefa.questoesPlanejadas > 0 ? "questoes" : tarefa.tipo === "revisao" ? "teoria" : undefined,
        revisaoId: textoMeta(tarefa, "revisao_id") || undefined,
        objetivo: objetivoTarefa(tarefa),
        observacao: `Tarefa da mentoria · ${tarefa.minutosPlanejados} min planejados`,
        urlAula: textoMeta(tarefa, "material_url") || undefined,
      };
      navigate("/central-estudos", { state: { origem: "plano", prefillSessao } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar a tarefa.");
      setProcessando("");
    }
  }

  async function pularTarefa(tarefa: TarefaMentoria) {
    try {
      setProcessando(tarefa.id);
      await atualizarStatusTarefaMentoria(tarefa.id, "pulado");
      await recalcularMeuCronogramaMentoria(adicionarDias(dataLocalIso(), 1), 29, "tarefa_pulada");
      await carregar(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível pular a tarefa.");
    } finally {
      setProcessando("");
    }
  }

  function atualizarDisponibilidade(diaSemana: number, patch: Partial<DisponibilidadeMentoria>) {
    setDisponibilidade((anterior) => anterior.map((item) => item.diaSemana === diaSemana ? { ...item, ...patch } : item));
  }

  return (
    <section className="cm-pagina">
      <header className="cm-cabecalho">
        <div>
          <span>CRONOGRAMA DA MENTORIA</span>
          <h1>{trilha.nome}</h1>
          <p>Seu mentor define a rota. O sistema distribui revisões, reforços e conteúdos conforme a sua disponibilidade.</p>
        </div>
        <div className="cm-cabecalho-acoes">
          <button className="secundario" onClick={() => setConfigAberta((valor) => !valor)}>⚙ Minha rotina</button>
          <button onClick={() => void recalcular()} disabled={processando === "recalcular"}>{processando === "recalcular" ? "Recalculando..." : "Recalcular cronograma"}</button>
        </div>
      </header>

      {erro && <div className="cm-alerta erro">{erro}</div>}
      {mensagem && <div className="cm-alerta sucesso">{mensagem}</div>}

      <div className="cm-resumo-cards">
        <Resumo titulo="Progresso da trilha" valor={`${progresso}%`} detalhe={`${trilha.itens.filter((item) => item.concluido).length} de ${trilha.itens.length} conteúdos`} />
        <Resumo titulo="Questões por sessão" valor={String(preferencias.questoesPorSessao)} detalhe="meta pessoal" />
        <Resumo titulo="Matérias por dia" valor={String(preferencias.maxMateriasDia)} detalhe="limite do cronograma" />
        <Resumo titulo="Revisões" valor={preferencias.intervalosRevisao.join(" / ")} detalhe="dias após concluir" />
      </div>

      {configAberta && (
        <section className="cm-config">
          <div className="cm-secao-topo"><div><span>DISPONIBILIDADE</span><h2>Quando você consegue estudar?</h2><p>O cronograma nunca ultrapassa os minutos disponíveis em cada dia.</p></div></div>
          <div className="cm-dias-config">
            {disponibilidade.map((dia) => (
              <label key={dia.diaSemana} className={dia.ativo ? "ativo" : ""}>
                <div><input type="checkbox" checked={dia.ativo} onChange={(e) => atualizarDisponibilidade(dia.diaSemana, { ativo: e.target.checked })} /><strong>{NOMES_DIAS[dia.diaSemana]}</strong></div>
                <input type="number" min={5} max={720} disabled={!dia.ativo} value={dia.minutosDisponiveis} onChange={(e) => atualizarDisponibilidade(dia.diaSemana, { minutosDisponiveis: Number(e.target.value) })} />
                <small>minutos</small>
              </label>
            ))}
          </div>
          <div className="cm-preferencias-config">
            <label>Máx. matérias/dia<input type="number" min={1} max={4} value={preferencias.maxMateriasDia} onChange={(e) => setPreferencias((p) => ({ ...p, maxMateriasDia: Number(e.target.value) }))} /></label>
            <label>Questões/sessão<input type="number" min={0} max={200} value={preferencias.questoesPorSessao} onChange={(e) => setPreferencias((p) => ({ ...p, questoesPorSessao: Number(e.target.value) }))} /></label>
            <label>% teoria<input type="number" min={0} max={100} value={preferencias.percentualTeoria} onChange={(e) => setPreferencias((p) => ({ ...p, percentualTeoria: Number(e.target.value) }))} /></label>
            <label>Revisões (dias)<input value={preferencias.intervalosRevisao.join(", ")} onChange={(e) => setPreferencias((p) => ({ ...p, intervalosRevisao: parseIntervalos(e.target.value, p.intervalosRevisao) }))} /></label>
            <label>Simulado a cada N dias<input type="number" min={1} max={365} value={preferencias.simuladoCadaDias ?? ""} onChange={(e) => setPreferencias((p) => ({ ...p, simuladoCadaDias: e.target.value ? Number(e.target.value) : null }))} /></label>
            <label>Data da prova<input type="date" value={preferencias.dataProva ?? ""} onChange={(e) => setPreferencias((p) => ({ ...p, dataProva: e.target.value || null }))} /></label>
          </div>
          <div className="cm-config-rodape"><button onClick={() => void salvarERecalcular()} disabled={processando === "config"}>{processando === "config" ? "Salvando..." : "Salvar rotina e recalcular"}</button></div>
        </section>
      )}

      <section className="cm-missao">
        <div className="cm-secao-topo"><div><span>AGORA</span><h2>Sua próxima missão</h2></div><b>{dataExtenso(hoje)}</b></div>
        {carregando ? <Vazio texto="Montando seu cronograma..." /> : !tarefaAtual ? (
          <div className="cm-sem-missao"><strong>Dia concluído ou sem carga prevista.</strong><span>Se sua rotina mudou, atualize a disponibilidade ou recalcule o cronograma.</span></div>
        ) : (
          <article className={`cm-missao-card tipo-${tarefaAtual.tipo}`}>
            <div><span>{rotuloTipo(tarefaAtual.tipo)}</span><h3>{tarefaAtual.materia}</h3><p>{tarefaAtual.assunto}</p><div className="cm-meta"><b>{tarefaAtual.minutosPlanejados} min</b>{tarefaAtual.questoesPlanejadas > 0 && <b>{tarefaAtual.questoesPlanejadas} questões</b>}<b>{tarefaAtual.origem === "mentor" ? "Definida pelo mentor" : "Automática"}</b></div></div>
            <div className="cm-missao-acoes"><button onClick={() => void iniciarTarefa(tarefaAtual)} disabled={processando === tarefaAtual.id}>{tarefaAtual.status === "em_andamento" ? "Continuar estudo" : "Iniciar estudo"}</button><button className="secundario" onClick={() => void pularTarefa(tarefaAtual)} disabled={processando === tarefaAtual.id}>Pular e reorganizar</button></div>
          </article>
        )}

        {tarefasHoje.length > 1 && <div className="cm-hoje-lista">{tarefasHoje.filter((item) => item.id !== tarefaAtual?.id).map((tarefa) => <article key={tarefa.id}><span className={`cm-tipo ${tarefa.tipo}`}>{rotuloTipo(tarefa.tipo)}</span><div><strong>{tarefa.materia}</strong><small>{tarefa.assunto} · {tarefa.minutosPlanejados} min</small></div><b className={`cm-status ${tarefa.status}`}>{tarefa.status.replaceAll("_", " ")}</b></article>)}</div>}
      </section>

      <section className="cm-semana">
        <div className="cm-secao-topo"><div><span>DEPOIS</span><h2>Próximos dias</h2><p>O plano pode mudar quando houver revisão atrasada, reforço do mentor ou alteração na sua disponibilidade.</p></div></div>
        {proximosDias.length === 0 ? <Vazio texto="Nenhuma atividade futura gerada." /> : <div className="cm-dias">{proximosDias.map(([data, lista]) => <article key={data} className="cm-dia"><header><div><strong>{diaSemana(data)}</strong><span>{dataExtenso(data)}</span></div><b>{lista.reduce((total, item) => total + item.minutosPlanejados, 0)} min</b></header>{lista.map((tarefa) => <div className="cm-tarefa" key={tarefa.id}><span className={`cm-tipo ${tarefa.tipo}`}>{rotuloTipo(tarefa.tipo)}</span><div><strong>{tarefa.materia}</strong><small>{tarefa.assunto}</small></div><span>{tarefa.minutosPlanejados} min{tarefa.questoesPlanejadas ? ` · ${tarefa.questoesPlanejadas} q.` : ""}</span></div>)}</article>)}</div>}
      </section>

      {concluidasRecentes.length > 0 && <section className="cm-historico"><div className="cm-secao-topo"><div><span>HISTÓRICO</span><h2>Concluídas recentemente</h2></div></div><div>{concluidasRecentes.map((tarefa) => <article key={tarefa.id}><time>{dataCurta(tarefa.data)}</time><strong>{tarefa.materia}</strong><span>{tarefa.assunto}</span><b>Concluída</b></article>)}</div></section>}
    </section>
  );
}

function Resumo({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) { return <article className="cm-resumo"><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>; }
function Vazio({ texto }: { texto: string }) { return <div className="cm-vazio">{texto}</div>; }
function disponibilidadeInicial(trilha: TrilhaMentoria): DisponibilidadeMentoria[] {
  if (trilha.disponibilidade?.length) return trilha.disponibilidade;
  return Array.from({ length: 7 }, (_, diaSemana) => ({ diaSemana, ativo: diaSemana !== 0, minutosDisponiveis: diaSemana === 0 ? 0 : trilha.minutosPadrao }));
}
function preferenciasIniciais(trilha: TrilhaMentoria): PreferenciasCronogramaMentoria {
  return trilha.preferencias ?? { maxMateriasDia: trilha.materiasPorDia, questoesPorSessao: trilha.questoesPorSessao, percentualTeoria: trilha.percentualTeoria, intervalosRevisao: trilha.intervalosRevisao, simuladoCadaDias: trilha.simuladoCadaDias, dataInicio: dataLocalIso(), dataProva: null };
}
function tipoSessao(tarefa: TarefaMentoria): DadosIniciarSessao["tipo"] {
  if (tarefa.tipo === "questoes") return "questoes";
  if (tarefa.tipo === "revisao") return "revisao";
  if (tarefa.tipo === "simulado") return "simulado";
  return "aula";
}
function objetivoTarefa(tarefa: TarefaMentoria) { return `${rotuloTipo(tarefa.tipo)} · ${tarefa.minutosPlanejados} min${tarefa.questoesPlanejadas ? ` · ${tarefa.questoesPlanejadas} questões` : ""}`; }
function textoMeta(tarefa: TarefaMentoria, chave: string) { const valor = tarefa.metadados[chave]; return typeof valor === "string" ? valor : ""; }
function rotuloTipo(tipo: string) { return ({ teoria: "Teoria", questoes: "Questões", revisao: "Revisão", simulado: "Simulado", reforco: "Reforço do mentor", misto: "Teoria + questões" } as Record<string, string>)[tipo] ?? tipo; }
function agruparPorData(tarefas: TarefaMentoria[]): Array<[string, TarefaMentoria[]]> { const mapa = new Map<string, TarefaMentoria[]>(); for (const tarefa of tarefas) mapa.set(tarefa.data, [...(mapa.get(tarefa.data) ?? []), tarefa]); return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)); }
function dataLocalIso() { const agora = new Date(); return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`; }
function adicionarDias(data: string, dias: number) { const d = new Date(`${data}T12:00:00`); d.setDate(d.getDate() + dias); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dataExtenso(data: string) { return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }); }
function dataCurta(data: string) { return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR"); }
function diaSemana(data: string) { return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }); }
function parseIntervalos(valor: string, anterior: number[]) { const lista = valor.split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0 && item <= 365).slice(0, 8); return lista.length ? lista : anterior; }
