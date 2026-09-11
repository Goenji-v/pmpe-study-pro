import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import { carregarPainelAcademicoAlunoParceiro, type PainelAcademicoAlunoParceiro } from "../../services/alunoParceiroService";
import {
  carregarPainelCronogramaAlunoMentor,
  criarReforcoMentoria,
  listarTrilhasMentoriaDoParceiro,
  recalcularCronogramaAlunoMentor,
  type PainelCronogramaAlunoMentor,
  type TrilhaMentoria,
} from "../../services/mentoriaService";
import "./ParceiroAluno.css";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function ParceiroAluno() {
  const { userId = "" } = useParams();
  const { contexto, carregando: verificando } = useContextoComercial();
  const [academico, setAcademico] = useState<PainelAcademicoAlunoParceiro | null>(null);
  const [cronograma, setCronograma] = useState<PainelCronogramaAlunoMentor | null>(null);
  const [trilhas, setTrilhas] = useState<TrilhaMentoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const podeGerenciar = contexto?.papel === "proprietario" || contexto?.papel === "gestor" || contexto?.papel === "professor";

  const carregar = useCallback(async () => {
    if (!userId || !podeGerenciar) return;
    try {
      setCarregando(true);
      setErro("");
      const [novoAcademico, novoCronograma, novasTrilhas] = await Promise.all([
        carregarPainelAcademicoAlunoParceiro(userId),
        carregarPainelCronogramaAlunoMentor(userId),
        listarTrilhasMentoriaDoParceiro(),
      ]);
      setAcademico(novoAcademico);
      setCronograma(novoCronograma);
      setTrilhas(novasTrilhas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o aluno.");
    } finally {
      setCarregando(false);
    }
  }, [userId, podeGerenciar]);

  useEffect(() => { void carregar(); }, [carregar]);

  const trilha = useMemo(
    () => trilhas.find((item) => item.id === cronograma?.trilha.id) ?? null,
    [trilhas, cronograma?.trilha.id]
  );
  const tarefasFuturas = useMemo(
    () => (cronograma?.tarefas ?? []).filter((item) => item.status !== "concluido" && item.status !== "pulado").slice(0, 16),
    [cronograma?.tarefas]
  );
  const progressoPercentual = cronograma?.progresso.total
    ? Math.round((cronograma.progresso.concluidos / cronograma.progresso.total) * 100)
    : 0;

  async function recalcular() {
    if (!userId) return;
    try {
      setProcessando("recalcular");
      setErro("");
      setMensagem("");
      await recalcularCronogramaAlunoMentor(userId, hojeIso(), 30, "recalculo_manual_professor");
      setMensagem("Cronograma recalculado. Atividades concluídas foram preservadas e somente o futuro foi reorganizado.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível recalcular o cronograma.");
    } finally {
      setProcessando("");
    }
  }

  async function reforcar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const itemId = String(form.get("itemId") || "");
    if (!itemId || !userId) return;
    try {
      setProcessando("reforco");
      setErro("");
      setMensagem("");
      await criarReforcoMentoria({
        userId,
        itemId,
        motivo: String(form.get("motivo") || ""),
        minutos: Number(form.get("minutos") || 30),
        questoes: Number(form.get("questoes") || 10),
        revisaoDias: Number(form.get("revisaoDias") || 7),
      });
      await recalcularCronogramaAlunoMentor(userId, hojeIso(), 30, "reforco_do_professor");
      setMensagem("Reforço criado e encaixado no próximo cronograma disponível do aluno.");
      evento.currentTarget.reset();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o reforço.");
    } finally {
      setProcessando("");
    }
  }

  if (verificando) return <div className="pa-estado">Verificando acesso...</div>;
  if (!podeGerenciar) return <Navigate to="/" replace />;

  return (
    <section className="pa-pagina">
      <header className="pa-cabecalho">
        <div>
          <span>PAINEL DO ALUNO</span>
          <h1>{academico?.aluno.nome || "Aluno"}</h1>
          <p>{academico ? `${academico.aluno.turma}${academico.aluno.concurso ? ` · ${academico.aluno.concurso}` : ""}` : "Carregando informações da mentoria..."}</p>
        </div>
        <div className="pa-cabecalho-acoes">
          <Link to="/parceiro">← Alunos</Link>
          <button onClick={() => void recalcular()} disabled={processando === "recalcular"}>{processando === "recalcular" ? "Recalculando..." : "Recalcular cronograma"}</button>
        </div>
      </header>

      {erro && <div className="pa-alerta erro">{erro}</div>}
      {mensagem && <div className="pa-alerta sucesso">{mensagem}</div>}
      {carregando ? <div className="pa-estado">Carregando painel completo...</div> : !academico ? <div className="pa-estado">Aluno não encontrado.</div> : (
        <>
          <div className="pa-cards">
            <Card titulo="Estudo na semana" valor={minutos(academico.tempo.semana)} detalhe={`${academico.tempo.diasEstudados} dias estudados no mês`} />
            <Card titulo="Questões" valor={String(academico.questoes.total)} detalhe={`${academico.questoes.percentual}% de acertos`} />
            <Card titulo="Revisões atrasadas" valor={String(academico.revisoes.atrasadas)} detalhe={`${academico.revisoes.pendentes} pendentes`} alerta={academico.revisoes.atrasadas > 0} />
            <Card titulo="Progresso da trilha" valor={`${progressoPercentual}%`} detalhe={`${cronograma?.progresso.concluidos ?? 0} de ${cronograma?.progresso.total ?? 0} conteúdos`} />
          </div>

          <div className="pa-grid-principal">
            <section className="pa-bloco">
              <div className="pa-bloco-topo"><div><span>CRONOGRAMA</span><h2>Próximas atividades</h2></div><strong>{cronograma?.trilha.nome || "Sem trilha"}</strong></div>
              {!cronograma ? <Vazio texto="Este aluno ainda não possui uma trilha ativa." /> : tarefasFuturas.length === 0 ? <Vazio texto="Nenhuma tarefa futura. Use Recalcular cronograma para gerar os próximos dias." /> : (
                <div className="pa-tarefas">
                  {tarefasFuturas.map((tarefa) => (
                    <article key={tarefa.id} className="pa-tarefa">
                      <time>{dataCurta(tarefa.data)}</time>
                      <div><strong>{tarefa.materia}</strong><span>{tarefa.assunto}</span><small>{rotuloTipo(tarefa.tipo)} · {tarefa.minutosPlanejados} min{tarefa.questoesPlanejadas ? ` · ${tarefa.questoesPlanejadas} questões` : ""}</small></div>
                      <b className={`pa-status ${tarefa.status}`}>{tarefa.status.replaceAll("_", " ")}</b>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <aside className="pa-bloco">
              <div className="pa-bloco-topo"><div><span>ROTINA</span><h2>Disponibilidade</h2></div></div>
              <div className="pa-disponibilidade">
                {(cronograma?.disponibilidade ?? []).map((dia) => <div key={dia.diaSemana} className={dia.ativo ? "ativo" : "inativo"}><strong>{DIAS[dia.diaSemana]}</strong><span>{dia.ativo ? minutos(dia.minutosDisponiveis) : "Folga"}</span></div>)}
              </div>
              {cronograma?.preferencias && <div className="pa-preferencias"><span>Máx. matérias/dia <b>{cronograma.preferencias.maxMateriasDia}</b></span><span>Questões/sessão <b>{cronograma.preferencias.questoesPorSessao}</b></span><span>Teoria <b>{cronograma.preferencias.percentualTeoria}%</b></span><span>Revisões <b>{cronograma.preferencias.intervalosRevisao.join(" / ")} dias</b></span></div>}
            </aside>
          </div>

          <div className="pa-grid-secundario">
            <section className="pa-bloco">
              <div className="pa-bloco-topo"><div><span>INTERVENÇÃO</span><h2>Reforçar assunto</h2></div></div>
              {!trilha || trilha.itens.length === 0 ? <Vazio texto="Cadastre assuntos na trilha antes de criar reforços." /> : (
                <form className="pa-reforco-form" onSubmit={reforcar}>
                  <label>Assunto<select name="itemId" required defaultValue=""><option value="" disabled>Selecione</option>{trilha.itens.map((item) => <option key={item.id} value={item.id}>{item.materia} — {item.assunto}</option>)}</select></label>
                  <label>Motivo<input name="motivo" placeholder="Ex.: baixo aproveitamento em questões" /></label>
                  <div><label>Minutos<input name="minutos" type="number" min="5" max="300" defaultValue="30" /></label><label>Questões<input name="questoes" type="number" min="0" max="200" defaultValue="10" /></label><label>Revisar em<input name="revisaoDias" type="number" min="1" max="365" defaultValue="7" /></label></div>
                  <button disabled={processando === "reforco"}>{processando === "reforco" ? "Aplicando..." : "Reforçar e recalcular"}</button>
                </form>
              )}
              {(cronograma?.reforcosPendentes.length ?? 0) > 0 && <div className="pa-reforcos-pendentes"><h3>Reforços pendentes</h3>{cronograma!.reforcosPendentes.map((reforco) => <div key={reforco.id}><strong>{reforco.materia} · {reforco.assunto}</strong><span>{reforco.minutosExtra} min · {reforco.questoesExtra} questões</span></div>)}</div>}
            </section>

            <section className="pa-bloco">
              <div className="pa-bloco-topo"><div><span>DESEMPENHO</span><h2>Matérias estudadas</h2></div></div>
              {academico.materias.length === 0 ? <Vazio texto="Sem sessões de estudo registradas." /> : <div className="pa-materias">{academico.materias.slice(0, 8).map((materia) => <div key={materia.materia}><strong>{materia.materia}</strong><span>{minutos(materia.minutos)} · {materia.sessoes} sessões · {materia.dias} dias</span></div>)}</div>}
            </section>
          </div>

          <section className="pa-bloco">
            <div className="pa-bloco-topo"><div><span>HISTÓRICO</span><h2>Atividade recente</h2></div></div>
            {academico.atividades.length === 0 ? <Vazio texto="Nenhuma atividade registrada." /> : <div className="pa-atividades">{academico.atividades.slice(0, 12).map((atividade, indice) => <article key={`${atividade.data}-${indice}`}><time>{dataHora(atividade.data)}</time><div><strong>{atividade.titulo}</strong><span>{atividade.detalhe}</span></div><b>{atividade.minutos} min</b></article>)}</div>}
          </section>
        </>
      )}
    </section>
  );
}

function Card({ titulo, valor, detalhe, alerta = false }: { titulo: string; valor: string; detalhe: string; alerta?: boolean }) {
  return <article className={`pa-card ${alerta ? "alerta" : ""}`}><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>;
}
function Vazio({ texto }: { texto: string }) { return <div className="pa-vazio">{texto}</div>; }
function hojeIso() { return new Date().toISOString().slice(0, 10); }
function minutos(valor: number) { const h = Math.floor(valor / 60); const m = valor % 60; return h ? `${h}h${m ? ` ${m}min` : ""}` : `${m}min`; }
function dataCurta(valor: string) { return new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
function dataHora(valor: string) { return new Date(valor).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function rotuloTipo(valor: string) { return ({ teoria: "Teoria", questoes: "Questões", revisao: "Revisão", simulado: "Simulado", reforco: "Reforço", misto: "Teoria + questões" } as Record<string, string>)[valor] ?? valor; }
