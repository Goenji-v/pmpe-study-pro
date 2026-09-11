import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DadosIniciarSessao } from "../../context/CronometroContext";
import {
  limparTarefaMentoriaAtiva,
  registrarTarefaMentoriaAtiva,
} from "../../components/MentoriaCronometroBridge/MentoriaCronometroBridge";
import {
  atualizarStatusTarefaMentoria,
  carregarTrilhaCronogramaMentoria,
  dataLocalIso,
  listarMinhasTarefasMentoria,
  recalcularMeuCronogramaMentoria,
  salvarDisponibilidadeMentoria,
  salvarPreferenciasMentoria,
  type DisponibilidadeMentoria,
  type PreferenciasCronogramaMentoria,
  type TarefaMentoria,
  type TrilhaCronogramaMentoria,
} from "../../services/mentoriaCronogramaService";
import "./CronogramaMentoria.css";

const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Props = {
  trilhaInicial: TrilhaCronogramaMentoria;
};

export default function CronogramaMentoria({ trilhaInicial }: Props) {
  const navigate = useNavigate();
  const [trilha, setTrilha] = useState(trilhaInicial);
  const [tarefas, setTarefas] = useState<TarefaMentoria[]>([]);
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeMentoria[]>(() => disponibilidadeInicial(trilhaInicial));
  const [preferencias, setPreferencias] = useState<PreferenciasCronogramaMentoria>(() => trilhaInicial.preferencias);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [configAberta, setConfigAberta] = useState(false);

  const hoje = dataLocalIso();
  const inicio = useMemo(() => somarDias(hoje, -7), [hoje]);
  const fim = useMemo(() => somarDias(hoje, 45), [hoje]);

  const carregar = useCallback(async (gerarSeVazio = false) => {
    try {
      setCarregando(true);
      setErro("");

      const trilhaAtual = await carregarTrilhaCronogramaMentoria();
      if (trilhaAtual) {
        setTrilha(trilhaAtual);
        setDisponibilidade(disponibilidadeInicial(trilhaAtual));
        setPreferencias(trilhaAtual.preferencias);
      }

      let lista = await listarMinhasTarefasMentoria(inicio, fim);
      const futuras = lista.filter((tarefa) =>
        tarefa.data >= hoje && !["concluido", "pulado"].includes(tarefa.status)
      );

      if (gerarSeVazio && futuras.length === 0) {
        await recalcularMeuCronogramaMentoria(hoje, 30, "geracao_inicial");
        lista = await listarMinhasTarefasMentoria(inicio, fim);
      }

      setTarefas(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o cronograma da mentoria.");
    } finally {
      setCarregando(false);
    }
  }, [fim, hoje, inicio]);

  useEffect(() => {
    void carregar(true);
  }, [carregar]);

  useEffect(() => {
    const atualizar = () => void carregar(false);
    window.addEventListener("pmpe-mentoria-cronograma-atualizado", atualizar);
    return () => window.removeEventListener("pmpe-mentoria-cronograma-atualizado", atualizar);
  }, [carregar]);

  const tarefasHoje = tarefas.filter((tarefa) => tarefa.data === hoje && tarefa.status !== "pulado");
  const tarefaAtual =
    tarefasHoje.find((tarefa) => tarefa.status === "em_andamento") ??
    tarefasHoje.find((tarefa) => tarefa.status === "pendente" || tarefa.status === "atrasado") ??
    null;
  const proximas = tarefas.filter((tarefa) => tarefa.data > hoje && !["pulado", "reagendado"].includes(tarefa.status)).slice(0, 24);
  const progresso = trilha.itens.length
    ? Math.round((trilha.itens.filter((item) => item.concluido).length / trilha.itens.length) * 100)
    : 0;

  async function salvarRotina() {
    try {
      setProcessando("config");
      setErro("");
      setMensagem("");
      await Promise.all([
        salvarDisponibilidadeMentoria(disponibilidade),
        salvarPreferenciasMentoria(preferencias),
      ]);
      await recalcularMeuCronogramaMentoria(hoje, 30, "disponibilidade_atualizada");
      setMensagem("Rotina salva e próximos 30 dias reorganizados. O histórico concluído foi preservado.");
      setConfigAberta(false);
      await carregar(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar sua rotina.");
    } finally {
      setProcessando("");
    }
  }

  async function recalcular() {
    try {
      setProcessando("recalcular");
      setErro("");
      setMensagem("");
      await recalcularMeuCronogramaMentoria(hoje, 30, "recalculo_manual_aluno");
      setMensagem("Cronograma recalculado sem apagar tarefas concluídas.");
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
      registrarTarefaMentoriaAtiva({
        id: tarefa.id,
        materia: tarefa.materia,
        assunto: tarefa.assunto,
        iniciadaEm: new Date().toISOString(),
      });

      const prefillSessao: DadosIniciarSessao = {
        materia: tarefa.materia,
        assunto: tarefa.assunto,
        tipo: tipoSessao(tarefa),
        formatoRevisao:
          tarefa.tipo === "revisao"
            ? tarefa.questoesPlanejadas > 0 ? "questoes" : "teoria"
            : undefined,
        revisaoId: textoMeta(tarefa, "revisao_id") || undefined,
        objetivo: objetivoTarefa(tarefa),
        observacao: `Tarefa da mentoria · ${tarefa.minutosPlanejados} min planejados`,
        urlAula: textoMeta(tarefa, "material_url") || undefined,
      };

      navigate("/central-estudos", {
        state: { origem: "plano", prefillSessao },
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar a tarefa.");
      setProcessando("");
    }
  }

  async function pularTarefa(tarefa: TarefaMentoria) {
    try {
      setProcessando(tarefa.id);
      setErro("");
      await atualizarStatusTarefaMentoria(tarefa.id, "pulado");
      await recalcularMeuCronogramaMentoria(hoje, 30, "tarefa_pulada");
      setMensagem("Tarefa pulada e cronograma reorganizado.");
      await carregar(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reorganizar a tarefa.");
    } finally {
      setProcessando("");
    }
  }

  function atualizarDia(diaSemana: number, patch: Partial<DisponibilidadeMentoria>) {
    setDisponibilidade((anterior) =>
      anterior.map((dia) => dia.diaSemana === diaSemana ? { ...dia, ...patch } : dia)
    );
  }

  return (
    <section className="cronograma-mentoria">
      <header className="cm-header">
        <div>
          <span>CRONOGRAMA DA MENTORIA</span>
          <h1>{trilha.nome}</h1>
          <p>Seu mentor define a rota. O sistema distribui conteúdo, revisões e reforços conforme sua disponibilidade.</p>
        </div>
        <div className="cm-header-acoes">
          <button className="secundario" onClick={() => setConfigAberta((valor) => !valor)}>Minha rotina</button>
          <button disabled={processando === "recalcular"} onClick={() => void recalcular()}>
            {processando === "recalcular" ? "Recalculando..." : "Recalcular"}
          </button>
        </div>
      </header>

      {erro && <div className="cm-alerta erro" role="alert">{erro}</div>}
      {mensagem && <div className="cm-alerta sucesso">{mensagem}</div>}

      <div className="cm-resumos">
        <Resumo titulo="Progresso" valor={`${progresso}%`} detalhe={`${trilha.itens.filter((item) => item.concluido).length} de ${trilha.itens.length} conteúdos`} />
        <Resumo titulo="Questões" valor={String(preferencias.questoesPorSessao)} detalhe="por sessão" />
        <Resumo titulo="Matérias" valor={String(preferencias.maxMateriasDia)} detalhe="máximo por dia" />
        <Resumo titulo="Revisões" valor={preferencias.intervalosRevisao.join(" / ")} detalhe="dias" />
      </div>

      {configAberta && (
        <section className="cm-config">
          <div className="cm-titulo"><span>ROTINA PESSOAL</span><h2>Quando você consegue estudar?</h2></div>
          <div className="cm-dias">
            {disponibilidade.map((dia) => (
              <label className={dia.ativo ? "ativo" : ""} key={dia.diaSemana}>
                <div><input type="checkbox" checked={dia.ativo} onChange={(e) => atualizarDia(dia.diaSemana, { ativo: e.target.checked })} /><strong>{NOMES_DIAS[dia.diaSemana]}</strong></div>
                <input type="number" min={5} max={720} disabled={!dia.ativo} value={dia.minutosDisponiveis} onChange={(e) => atualizarDia(dia.diaSemana, { minutosDisponiveis: Number(e.target.value) })} />
                <small>min</small>
              </label>
            ))}
          </div>
          <div className="cm-preferencias">
            <label>Máx. matérias/dia<input type="number" min={1} max={4} value={preferencias.maxMateriasDia} onChange={(e) => setPreferencias((p) => ({ ...p, maxMateriasDia: Number(e.target.value) }))} /></label>
            <label>Questões/sessão<input type="number" min={0} max={200} value={preferencias.questoesPorSessao} onChange={(e) => setPreferencias((p) => ({ ...p, questoesPorSessao: Number(e.target.value) }))} /></label>
            <label>% teoria<input type="number" min={0} max={100} value={preferencias.percentualTeoria} onChange={(e) => setPreferencias((p) => ({ ...p, percentualTeoria: Number(e.target.value) }))} /></label>
            <label>Revisões (dias)<input value={preferencias.intervalosRevisao.join(", ")} onChange={(e) => setPreferencias((p) => ({ ...p, intervalosRevisao: parseIntervalos(e.target.value, p.intervalosRevisao) }))} /></label>
            <label>Simulado a cada N dias<input type="number" min={1} max={365} value={preferencias.simuladoCadaDias ?? ""} onChange={(e) => setPreferencias((p) => ({ ...p, simuladoCadaDias: e.target.value ? Number(e.target.value) : null }))} /></label>
            <label>Data da prova<input type="date" value={preferencias.dataProva ?? ""} onChange={(e) => setPreferencias((p) => ({ ...p, dataProva: e.target.value || null }))} /></label>
          </div>
          <button className="cm-salvar" disabled={processando === "config"} onClick={() => void salvarRotina()}>
            {processando === "config" ? "Salvando..." : "Salvar rotina e recalcular"}
          </button>
        </section>
      )}

      <section className="cm-missao">
        <div className="cm-titulo"><span>HOJE</span><h2>Próxima missão</h2></div>
        {carregando ? <Vazio texto="Montando seu cronograma..." /> : !tarefaAtual ? (
          <Vazio texto="Dia concluído ou sem carga prevista. Você pode atualizar sua rotina ou recalcular o cronograma." />
        ) : (
          <article className={`cm-tarefa destaque tipo-${tarefaAtual.tipo}`}>
            <div>
              <span>{rotuloTipo(tarefaAtual)}</span>
              <h3>{tarefaAtual.materia}</h3>
              <p>{tarefaAtual.assunto}</p>
              <div className="cm-meta"><b>{tarefaAtual.minutosPlanejados} min</b>{tarefaAtual.questoesPlanejadas > 0 && <b>{tarefaAtual.questoesPlanejadas} questões</b>}<b>{tarefaAtual.origem === "mentor" ? "Prioridade do mentor" : "Automático"}</b></div>
            </div>
            <div className="cm-acoes">
              <button disabled={processando === tarefaAtual.id} onClick={() => void iniciarTarefa(tarefaAtual)}>{tarefaAtual.status === "em_andamento" ? "Continuar estudo" : "Iniciar estudo"}</button>
              <button className="secundario" disabled={processando === tarefaAtual.id} onClick={() => void pularTarefa(tarefaAtual)}>Pular e reorganizar</button>
            </div>
          </article>
        )}

        {tarefasHoje.filter((tarefa) => tarefa.id !== tarefaAtual?.id).length > 0 && (
          <div className="cm-lista">
            {tarefasHoje.filter((tarefa) => tarefa.id !== tarefaAtual?.id).map((tarefa) => (
              <TarefaLinha key={tarefa.id} tarefa={tarefa} />
            ))}
          </div>
        )}
      </section>

      <section className="cm-proximas">
        <div className="cm-titulo"><span>PRÓXIMOS DIAS</span><h2>Planejamento futuro</h2></div>
        {proximas.length === 0 ? <Vazio texto="Nenhuma atividade futura gerada." /> : (
          <div className="cm-lista">{proximas.map((tarefa) => <TarefaLinha key={tarefa.id} tarefa={tarefa} />)}</div>
        )}
      </section>
    </section>
  );
}

function Resumo({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return <article><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>;
}

function TarefaLinha({ tarefa }: { tarefa: TarefaMentoria }) {
  return <article className="cm-tarefa"><time>{dataCurta(tarefa.data)}</time><div><strong>{tarefa.materia}</strong><small>{tarefa.assunto}</small></div><span>{rotuloTipo(tarefa)}</span><b>{tarefa.minutosPlanejados} min</b></article>;
}

function Vazio({ texto }: { texto: string }) {
  return <div className="cm-vazio">{texto}</div>;
}

function disponibilidadeInicial(trilha: TrilhaCronogramaMentoria): DisponibilidadeMentoria[] {
  if (trilha.disponibilidade.length > 0) {
    return Array.from({ length: 7 }, (_, diaSemana) =>
      trilha.disponibilidade.find((dia) => dia.diaSemana === diaSemana) ?? {
        diaSemana,
        ativo: diaSemana !== 0,
        minutosDisponiveis: trilha.minutosPadrao,
      }
    );
  }
  return Array.from({ length: 7 }, (_, diaSemana) => ({
    diaSemana,
    ativo: diaSemana !== 0,
    minutosDisponiveis: trilha.minutosPadrao,
  }));
}

function tipoSessao(tarefa: TarefaMentoria): DadosIniciarSessao["tipo"] {
  if (tarefa.tipo === "revisao") return "revisao";
  if (tarefa.tipo === "questoes" || (tarefa.tipo === "reforco" && tarefa.questoesPlanejadas > 0)) return "questoes";
  if (tarefa.tipo === "simulado") return "simulado";
  return "aula";
}

function objetivoTarefa(tarefa: TarefaMentoria) {
  const instrucao = textoMeta(tarefa, "instrucoes");
  if (instrucao) return instrucao;
  if (tarefa.tipo === "revisao") return `Revisar ${tarefa.assunto}`;
  if (tarefa.tipo === "reforco") return textoMeta(tarefa, "motivo") || `Reforçar ${tarefa.assunto}`;
  if (tarefa.tipo === "simulado") return "Executar o simulado programado pela mentoria.";
  return `Estudar ${tarefa.assunto}`;
}

function textoMeta(tarefa: TarefaMentoria, chave: string) {
  const valor = tarefa.metadados[chave];
  return typeof valor === "string" ? valor : "";
}

function rotuloTipo(tarefa: TarefaMentoria) {
  if (tarefa.tipo === "reforco") return "Reforço";
  if (tarefa.tipo === "revisao") return "Revisão";
  if (tarefa.tipo === "simulado") return "Simulado";
  if (tarefa.tipo === "questoes") return "Questões";
  if (tarefa.tipo === "teoria") return "Teoria";
  return "Estudo misto";
}

function parseIntervalos(valor: string, anterior: number[]) {
  const numeros = valor.split(",").map((item) => Number(item.trim())).filter((n) => Number.isInteger(n) && n > 0 && n <= 365);
  return numeros.length ? Array.from(new Set(numeros)).sort((a, b) => a - b) : anterior;
}

function somarDias(dataIso: string, dias: number) {
  const data = new Date(`${dataIso}T12:00:00`);
  data.setDate(data.getDate() + dias);
  return dataLocalIso(data);
}

function dataCurta(dataIso: string) {
  return new Date(`${dataIso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
