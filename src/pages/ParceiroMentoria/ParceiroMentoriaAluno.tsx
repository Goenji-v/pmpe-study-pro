import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import { listarAlunosDoParceiro, type AlunoParceiro } from "../../services/parceriasService";
import {
  cancelarReforcoMentoria,
  criarReforcoMentoria,
  listarTrilhasMentoriaDoParceiro,
  type ReforcoMentoria,
  type TrilhaMentoria,
} from "../../services/mentoriaService";
import {
  carregarPainelAlunoParceiro,
  type PainelAlunoParceiro,
} from "../../services/painelAlunoParceiroService";
import {
  carregarEstadoMentoriaAluno,
  restaurarRotaMentoriaAluno,
  salvarRotaMentoriaAluno,
  type ItemRotaMentoriaAluno,
} from "../../services/rotaMentoriaAlunoService";
import "./ParceiroMentoriaAluno.css";

export default function ParceiroMentoriaAluno() {
  const { userId = "" } = useParams();
  const { contexto, carregando: verificando } = useContextoComercial();
  const [aluno, setAluno] = useState<AlunoParceiro | null>(null);
  const [painel, setPainel] = useState<PainelAlunoParceiro | null>(null);
  const [trilha, setTrilha] = useState<TrilhaMentoria | null>(null);
  const [rota, setRota] = useState<ItemRotaMentoriaAluno[]>([]);
  const [reforcos, setReforcos] = useState<ReforcoMentoria[]>([]);
  const [rotaPersonalizada, setRotaPersonalizada] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const podeGerenciar =
    contexto?.papel === "proprietario" ||
    contexto?.papel === "gestor" ||
    contexto?.papel === "professor";

  const carregar = useCallback(async () => {
    if (!podeGerenciar || !userId) {
      setCarregando(false);
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const [alunos, painelAtual, trilhas] = await Promise.all([
        listarAlunosDoParceiro(),
        carregarPainelAlunoParceiro(userId),
        listarTrilhasMentoriaDoParceiro(),
      ]);

      const alunoAtual = alunos.find((item) => item.userId === userId) ?? null;
      if (!alunoAtual) throw new Error("Aluno não encontrado na sua organização.");

      const trilhaAtual = alunoAtual.turmaId
        ? trilhas.find((item) => item.turmaId === alunoAtual.turmaId) ?? null
        : null;

      setAluno(alunoAtual);
      setPainel(painelAtual);
      setTrilha(trilhaAtual);

      if (!trilhaAtual) {
        setRota([]);
        setReforcos([]);
        setRotaPersonalizada(false);
        return;
      }

      const estado = await carregarEstadoMentoriaAluno(trilhaAtual, userId);
      setRota(estado.rota);
      setReforcos(estado.reforcos);
      setRotaPersonalizada(estado.personalizada);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o aluno.");
    } finally {
      setCarregando(false);
    }
  }, [podeGerenciar, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const itensAtivos = useMemo(() => rota.filter((item) => item.ativo), [rota]);
  const concluidos = useMemo(
    () => itensAtivos.filter((item) => item.concluido).length,
    [itensAtivos]
  );
  const percentualTrilha = itensAtivos.length
    ? Math.round((concluidos / itensAtivos.length) * 100)
    : 0;
  const proximoItem = itensAtivos.find((item) => !item.concluido) ?? null;
  const reforcosPendentes = reforcos.filter((item) => item.status === "pendente");

  function moverItem(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= rota.length) return;
    setRota((atual) => {
      const nova = [...atual];
      [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
      return nova.map((item, ordem) => ({ ...item, ordem: ordem + 1 }));
    });
  }

  function alternarItem(itemId: string) {
    setRota((atual) =>
      atual.map((item) =>
        item.id === itemId ? { ...item, ativo: !item.ativo } : item
      )
    );
  }

  async function salvarRota() {
    if (!trilha || !aluno?.turmaId || !contexto?.parceiroId) return;

    try {
      setSalvando(true);
      setErro("");
      setMensagem("");
      await salvarRotaMentoriaAluno({
        trilha,
        userId,
        parceiroId: contexto.parceiroId,
        turmaId: aluno.turmaId,
        itens: rota,
      });
      setMensagem(`Rota individual de ${aluno.nome} salva. O Cronograma IA já passa a respeitar essa ordem.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a rota individual.");
    } finally {
      setSalvando(false);
    }
  }

  async function restaurarRota() {
    if (!trilha) return;
    try {
      setSalvando(true);
      setErro("");
      setMensagem("");
      await restaurarRotaMentoriaAluno(trilha.id, userId);
      setMensagem("Rota individual removida. O aluno voltou a seguir exatamente a trilha da turma.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível restaurar a trilha da turma.");
    } finally {
      setSalvando(false);
    }
  }

  async function reforcar(item: ItemRotaMentoriaAluno) {
    if (!trilha || !aluno?.turmaId || !contexto?.parceiroId) return;
    if (reforcosPendentes.some((reforco) => reforco.itemId === item.id)) {
      setErro(`${item.assunto} já está como reforço pendente para este aluno.`);
      return;
    }

    try {
      setProcessando(item.id);
      setErro("");
      setMensagem("");
      await criarReforcoMentoria({
        parceiroId: contexto.parceiroId,
        turmaId: aluno.turmaId,
        trilhaId: trilha.id,
        userId,
        item,
        motivo: "Reforço solicitado no painel individual da mentoria.",
      });
      setMensagem(`Reforço de ${item.materia} — ${item.assunto} enviado para ${aluno.nome}.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o reforço.");
    } finally {
      setProcessando("");
    }
  }

  async function cancelarReforco(id: string) {
    try {
      setProcessando(id);
      setErro("");
      await cancelarReforcoMentoria(id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cancelar o reforço.");
    } finally {
      setProcessando("");
    }
  }

  if (verificando) return <div className="mentoria-aluno-estado">Verificando acesso...</div>;
  if (!podeGerenciar) return <Navigate to="/" replace />;

  return (
    <section className="mentoria-aluno-pagina">
      <header className="mentoria-aluno-cabecalho">
        <div>
          <span>PAINEL INDIVIDUAL DA MENTORIA</span>
          <h1>{painel?.aluno.nome || aluno?.nome || "Aluno"}</h1>
          <p>
            {painel?.aluno.turma || aluno?.turma || "Sem turma"}
            {painel?.aluno.concurso ? ` · ${painel.aluno.concurso}` : ""}
          </p>
          <small>{painel?.aluno.email || aluno?.email || "E-mail não informado"}</small>
        </div>
        <Link to="/parceiro/mentoria">← Voltar à mentoria</Link>
      </header>

      {erro && <div className="mentoria-aluno-alerta erro">{erro}</div>}
      {mensagem && <div className="mentoria-aluno-alerta sucesso">{mensagem}</div>}

      {carregando ? (
        <div className="mentoria-aluno-estado">Carregando dados do aluno...</div>
      ) : !painel || !aluno ? (
        <div className="mentoria-aluno-estado">Não foi possível localizar os dados deste aluno.</div>
      ) : (
        <>
          <div className="mentoria-aluno-metricas">
            <Metrica titulo="Hoje" valor={formatarMinutos(painel.tempo.hoje)} detalhe="tempo estudado" />
            <Metrica titulo="Semana" valor={formatarMinutos(painel.tempo.semana)} detalhe="tempo estudado" />
            <Metrica titulo="Mês" valor={formatarMinutos(painel.tempo.mes)} detalhe={`${painel.tempo.diasEstudados} dias estudados`} />
            <Metrica titulo="Sequência" valor={`${painel.tempo.sequencia} dias`} detalhe="ritmo atual" />
            <Metrica titulo="Questões" valor={String(painel.questoes.total)} detalhe={`${painel.questoes.certas} certas · ${painel.questoes.erradas} erradas`} />
            <Metrica titulo="Acurácia" valor={`${painel.questoes.percentual.toFixed(1)}%`} detalhe="questões registradas" />
            <Metrica titulo="Revisões atrasadas" valor={String(painel.revisoes.atrasadas)} detalhe={`${painel.revisoes.pendentes} pendentes`} alerta={painel.revisoes.atrasadas > 0} />
            <Metrica titulo="Reforços" valor={String(reforcosPendentes.length)} detalhe="pendentes na mentoria" alerta={reforcosPendentes.length > 0} />
          </div>

          <div className="mentoria-aluno-principal">
            <section className="mentoria-aluno-card rota">
              <div className="mentoria-aluno-card-topo">
                <div>
                  <span>ROTA INDIVIDUAL</span>
                  <h2>{trilha?.nome || "Trilha não configurada"}</h2>
                  <p>
                    {trilha
                      ? "Reordene ou pause assuntos somente para este aluno. Os demais alunos continuam na trilha da turma."
                      : "Esta turma ainda não possui uma trilha de mentoria configurada."}
                  </p>
                </div>
                {trilha && (
                  <b className={rotaPersonalizada ? "personalizada" : "base"}>
                    {rotaPersonalizada ? "Personalizada" : "Rota da turma"}
                  </b>
                )}
              </div>

              {trilha && (
                <>
                  <div className="mentoria-aluno-progresso-resumo">
                    <div>
                      <strong>{concluidos}/{itensAtivos.length}</strong>
                      <span>{percentualTrilha}% da rota ativa concluída</span>
                    </div>
                    <div className="mentoria-aluno-barra">
                      <span style={{ width: `${Math.min(100, percentualTrilha)}%` }} />
                    </div>
                    <small>
                      {proximoItem
                        ? `Próximo: ${proximoItem.materia} — ${proximoItem.assunto}`
                        : itensAtivos.length
                          ? "Todos os itens ativos foram concluídos."
                          : "Todos os itens estão pausados para este aluno."}
                    </small>
                  </div>

                  <div className="mentoria-aluno-rota-lista">
                    {rota.map((item, indice) => {
                      const reforco = reforcosPendentes.find((atual) => atual.itemId === item.id);
                      const status = !item.ativo
                        ? "Pausado"
                        : item.concluido
                          ? "Concluído"
                          : reforco
                            ? "Reforço pendente"
                            : proximoItem?.id === item.id
                              ? "Próximo"
                              : "Pendente";

                      return (
                        <article className={`mentoria-aluno-rota-item ${!item.ativo ? "pausado" : ""}`} key={item.id}>
                          <span className="mentoria-aluno-ordem">{indice + 1}</span>
                          <div className="mentoria-aluno-rota-conteudo">
                            <div>
                              <strong>{item.materia}</strong>
                              <span className={`status ${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
                            </div>
                            <p>{item.assunto}</p>
                            {item.concluidoEm && <small>Concluído em {formatarData(item.concluidoEm)}</small>}
                            {reforco && (
                              <small className="reforco-info">
                                Reforço solicitado em {formatarData(reforco.criadoEm)}
                                <button type="button" onClick={() => void cancelarReforco(reforco.id)} disabled={processando === reforco.id}>
                                  cancelar
                                </button>
                              </small>
                            )}
                          </div>
                          <div className="mentoria-aluno-rota-acoes">
                            <button type="button" onClick={() => moverItem(indice, -1)} disabled={indice === 0} aria-label="Mover para cima">↑</button>
                            <button type="button" onClick={() => moverItem(indice, 1)} disabled={indice === rota.length - 1} aria-label="Mover para baixo">↓</button>
                            <button type="button" onClick={() => alternarItem(item.id)}>{item.ativo ? "Pausar" : "Ativar"}</button>
                            <button type="button" className="reforcar" onClick={() => void reforcar(item)} disabled={!!reforco || processando === item.id}>
                              {processando === item.id ? "Enviando..." : "Reforçar"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <footer className="mentoria-aluno-rota-rodape">
                    <button type="button" className="secundario" onClick={() => void restaurarRota()} disabled={salvando || !rotaPersonalizada}>
                      Restaurar rota da turma
                    </button>
                    <button type="button" className="principal" onClick={() => void salvarRota()} disabled={salvando}>
                      {salvando ? "Salvando..." : "Salvar rota individual"}
                    </button>
                  </footer>
                </>
              )}
            </section>

            <aside className="mentoria-aluno-card resumo">
              <span>LEITURA RÁPIDA</span>
              <h2>O que merece atenção</h2>
              <ResumoLinha titulo="Próximo conteúdo" valor={proximoItem ? `${proximoItem.materia} — ${proximoItem.assunto}` : "Nenhum conteúdo pendente"} />
              <ResumoLinha titulo="Revisões atrasadas" valor={String(painel.revisoes.atrasadas)} alerta={painel.revisoes.atrasadas > 0} />
              <ResumoLinha titulo="Reforços pendentes" valor={String(reforcosPendentes.length)} alerta={reforcosPendentes.length > 0} />
              <ResumoLinha titulo="Tempo total" valor={formatarMinutos(painel.tempo.total)} />
              <ResumoLinha titulo="Acurácia geral" valor={`${painel.questoes.percentual.toFixed(1)}%`} />
              <ResumoLinha titulo="Status da licença" valor={painel.aluno.status || aluno.status} />
            </aside>
          </div>

          <div className="mentoria-aluno-dados-grid">
            <section className="mentoria-aluno-card">
              <div className="mentoria-aluno-card-topo compacto">
                <div><span>MATÉRIAS</span><h2>Distribuição do estudo</h2></div>
              </div>
              {painel.materias.length === 0 ? (
                <p className="mentoria-aluno-vazio">Ainda não há sessões de estudo registradas.</p>
              ) : (
                <div className="mentoria-aluno-materias">
                  {painel.materias.slice(0, 8).map((materia) => (
                    <div key={materia.materia}>
                      <strong>{materia.materia}</strong>
                      <span>{formatarMinutos(materia.minutos)}</span>
                      <small>{materia.sessoes} sessões · {materia.dias} dias</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mentoria-aluno-card">
              <div className="mentoria-aluno-card-topo compacto">
                <div><span>ATIVIDADE RECENTE</span><h2>Últimos estudos</h2></div>
              </div>
              {painel.atividades.length === 0 ? (
                <p className="mentoria-aluno-vazio">Nenhuma atividade recente.</p>
              ) : (
                <div className="mentoria-aluno-atividades">
                  {painel.atividades.slice(0, 8).map((atividade, indice) => (
                    <div key={`${atividade.data}-${indice}`}>
                      <span>{formatarData(atividade.data)}</span>
                      <strong>{atividade.titulo}</strong>
                      <small>{atividade.detalhe || atividade.tipo} · {formatarMinutos(atividade.minutos)}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mentoria-aluno-card simulados">
              <div className="mentoria-aluno-card-topo compacto">
                <div><span>SIMULADOS</span><h2>Desempenho oficial</h2></div>
              </div>
              {painel.simulados.length === 0 ? (
                <p className="mentoria-aluno-vazio">O aluno ainda não concluiu simulados oficiais.</p>
              ) : (
                <div className="mentoria-aluno-simulados">
                  {painel.simulados.slice(0, 6).map((simulado) => (
                    <div key={simulado.id}>
                      <div>
                        <strong>{simulado.nome}</strong>
                        <small>{simulado.finalizadaEm ? formatarData(simulado.finalizadaEm) : "Data não informada"}</small>
                      </div>
                      <b>{simulado.percentual.toFixed(1)}%</b>
                      <span>{simulado.certas} C · {simulado.erradas} E · {simulado.emBranco} B</span>
                      {simulado.alertas > 0 && <em>{simulado.alertas} alerta(s) de integridade</em>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function Metrica({ titulo, valor, detalhe, alerta = false }: { titulo: string; valor: string; detalhe: string; alerta?: boolean }) {
  return (
    <div className={`mentoria-aluno-metrica ${alerta ? "alerta" : ""}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </div>
  );
}

function ResumoLinha({ titulo, valor, alerta = false }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={`mentoria-aluno-resumo-linha ${alerta ? "alerta" : ""}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function formatarMinutos(minutos: number) {
  const total = Math.max(0, Math.round(minutos || 0));
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (horas === 0) return `${resto}min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h ${resto}min`;
}

function formatarData(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(data);
}
