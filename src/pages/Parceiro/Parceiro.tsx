import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import {
  alterarStatusConvite,
  alterarStatusLicenca,
  carregarGestaoParceiro,
  carregarResumoParceiro,
  criarConvite,
  decidirSolicitacao,
  listarAlunosDoParceiro,
  moverAlunoEntreTurmas,
  type AlunoParceiro,
  type GestaoParceiro,
  type ResumoParceiro,
} from "../../services/parceriasService";
import ProfessorDashboard from "./ProfessorDashboard";
import "./Parceiro.css";
import "./ParceiroArea.css";

type Aba = "visao" | "alunos" | "convites" | "financeiro" | "auditoria";

const GESTAO_VAZIA: GestaoParceiro = {
  turmas: [],
  convites: [],
  solicitacoes: [],
  auditoria: [],
  faturamento: [],
};

export default function Parceiro() {
  const { contexto, carregando: verificando } = useContextoComercial();
  const [resumo, setResumo] = useState<ResumoParceiro | null>(null);
  const [alunos, setAlunos] = useState<AlunoParceiro[]>([]);
  const [gestao, setGestao] = useState<GestaoParceiro>(GESTAO_VAZIA);
  const [aba, setAba] = useState<Aba>("visao");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [linkCriado, setLinkCriado] = useState("");

  const podeGerenciar =
    contexto?.papel === "proprietario" ||
    contexto?.papel === "gestor" ||
    contexto?.papel === "professor";

  const carregar = useCallback(async () => {
    if (!podeGerenciar) {
      setCarregando(false);
      return;
    }

    try {
      setErro("");
      const [novoResumo, novosAlunos, novaGestao] = await Promise.all([
        carregarResumoParceiro(),
        listarAlunosDoParceiro(),
        carregarGestaoParceiro(),
      ]);
      setResumo(novoResumo);
      setAlunos(novosAlunos);
      setGestao(novaGestao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar a área do parceiro.");
    } finally {
      setCarregando(false);
    }
  }, [podeGerenciar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return termo
      ? alunos.filter((aluno) =>
          `${aluno.nome} ${aluno.email} ${aluno.turma} ${aluno.status}`
            .toLocaleLowerCase("pt-BR")
            .includes(termo)
        )
      : alunos;
  }, [alunos, busca]);

  const pendentes = gestao.solicitacoes.filter((s) => s.status === "pendente").length;
  const turmasAtivas = gestao.turmas.filter((turma) => turma.ativa);

  async function executar(chave: string, tarefa: () => Promise<void>, sucesso?: string) {
    try {
      setProcessando(chave);
      setErro("");
      setMensagem("");
      await tarefa();
      if (sucesso) setMensagem(sucesso);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
    } finally {
      setProcessando("");
    }
  }

  async function responder(id: string, decisao: "aprovar" | "recusar") {
    await executar(
      `solicitacao-${id}`,
      () => decidirSolicitacao(id, decisao),
      decisao === "aprovar" ? "Aluno aprovado na turma." : "Solicitação recusada."
    );
  }

  async function mudarLicenca(
    aluno: AlunoParceiro,
    status: "ativa" | "suspensa" | "cancelada"
  ) {
    const motivo =
      status === "suspensa"
        ? "Acesso suspenso pelo responsável da turma."
        : status === "cancelada"
          ? "Aluno removido da turma pelo parceiro."
          : undefined;

    await executar(
      `licenca-${aluno.licencaId}`,
      () => alterarStatusLicenca(aluno.licencaId, status, motivo),
      status === "ativa"
        ? "Acesso reativado."
        : status === "suspensa"
          ? "Acesso suspenso."
          : "Aluno removido da turma."
    );
  }

  async function moverAluno(aluno: AlunoParceiro, turmaDestinoId: string) {
    if (!turmaDestinoId || turmaDestinoId === aluno.turmaId) return;
    const destino = gestao.turmas.find((turma) => turma.id === turmaDestinoId);
    if (!destino) return;

    if (!window.confirm(`Mover ${aluno.nome} para ${destino.nome}?`)) return;

    await executar(
      `mover-${aluno.licencaId}`,
      () => moverAlunoEntreTurmas(aluno.licencaId, turmaDestinoId),
      `${aluno.nome} agora está em ${destino.nome}.`
    );
  }

  async function alternarConvite(id: string, ativo: boolean) {
    await executar(
      `convite-${id}`,
      () => alterarStatusConvite(id, ativo),
      ativo ? "Convite reativado." : "Convite revogado."
    );
  }

  async function gerar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const turma = String(form.get("turma") || "");
    if (!turma) return;

    try {
      setProcessando("convite-novo");
      setErro("");
      setMensagem("");
      const codigo = await criarConvite(
        turma,
        Number(form.get("validade") || 30),
        form.get("maxUsos") ? Number(form.get("maxUsos")) : null,
        Number(form.get("duracao") || 12),
        String(form.get("titulo") || "")
      );
      setLinkCriado(`${window.location.origin}/convite/${codigo}`);
      setMensagem("Link criado. Envie apenas para os alunos desta turma.");
      evento.currentTarget.reset();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o convite.");
    } finally {
      setProcessando("");
    }
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(linkCriado);
    setMensagem("Link copiado.");
  }

  if (verificando) {
    return <div className="parceiro-estado">Verificando acesso à parceria...</div>;
  }

  if (!podeGerenciar) return <Navigate to="/" replace />;

  return (
    <section className="parceiro-pagina">
      <header className="parceiro-cabecalho parceiro-area-cabecalho">
        <div>
          <span>ÁREA DO PARCEIRO</span>
          <h1>{resumo?.parceiroNome || contexto?.parceiroNome || "Minha parceria"}</h1>
          <p>
            Gerencie suas turmas, acompanhe os alunos e mantenha o cronograma e os conteúdos da parceria atualizados.
          </p>
          <div className="parceiro-area-atalhos">
            <Link to="/parceiro/mentoria">Cronograma da turma</Link>
            <Link to="/parceiro/cursos">Conteúdos do curso</Link>
            <Link to="/parceiro/simulados">Simulados</Link>
          </div>
        </div>
        <div className="parceiro-valor">
          <small>Turmas ativas</small>
          <strong>{turmasAtivas.length}</strong>
          <span>{resumo?.alunosAtivos ?? 0} alunos ativos</span>
        </div>
      </header>

      {erro && <div className="parceiro-erro" role="alert">{erro}</div>}
      {mensagem && <div className="parceiro-area-sucesso" role="status">{mensagem}</div>}

      <nav className="parceiro-abas" aria-label="Seções da área do parceiro">
        {([
          ["visao", "Visão geral"],
          ["alunos", "Alunos e turmas"],
          ["convites", "Convites"],
          ["financeiro", "Financeiro"],
          ["auditoria", "Histórico"],
        ] as [Aba, string][]).map(([id, nome]) => (
          <button
            type="button"
            key={id}
            className={aba === id ? "ativo" : ""}
            onClick={() => setAba(id)}
          >
            {nome}
            {id === "convites" && pendentes > 0 ? ` (${pendentes})` : ""}
          </button>
        ))}
      </nav>

      {carregando ? (
        <div className="parceiro-estado">Carregando parceria...</div>
      ) : (
        <>
          {aba === "visao" && (
            <>
              <section className="parceiro-area-resumo">
                <article>
                  <span>Turmas</span>
                  <strong>{turmasAtivas.length}</strong>
                  <small>Você administra apenas as turmas vinculadas à sua parceria.</small>
                </article>
                <article>
                  <span>Alunos ativos</span>
                  <strong>{resumo?.alunosAtivos ?? 0}</strong>
                  <small>Dados e desempenho ficam restritos a esses alunos.</small>
                </article>
                <article>
                  <span>Solicitações</span>
                  <strong>{pendentes}</strong>
                  <small>Entradas aguardando sua aprovação.</small>
                </article>
              </section>
              <ProfessorDashboard />
            </>
          )}

          {aba === "alunos" && (
            <section className="parceiro-lista">
              <div className="parceiro-lista-topo">
                <div>
                  <h2>Alunos das suas turmas</h2>
                  <p>
                    Você pode acompanhar, suspender, remover e mover alunos entre turmas desta mesma parceria.
                  </p>
                </div>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar aluno ou turma"
                  aria-label="Buscar aluno ou turma"
                />
              </div>

              <div className="parceiro-area-turmas">
                {turmasAtivas.map((turma) => (
                  <article key={turma.id}>
                    <strong>{turma.nome}</strong>
                    <span>{alunos.filter((aluno) => aluno.turmaId === turma.id && aluno.status === "ativa").length} ativos</span>
                  </article>
                ))}
              </div>

              {filtrados.length === 0 ? (
                <Vazio texto="Nenhum aluno encontrado." />
              ) : (
                <div className="parceiro-tabela-area">
                  <div className="parceiro-tabela parceiro-tabela-alunos parceiro-area-tabela cabecalho">
                    <span>Aluno</span>
                    <span>Turma</span>
                    <span>Desempenho</span>
                    <span>Acesso</span>
                    <span>Ações</span>
                  </div>

                  {filtrados.map((aluno) => (
                    <article className="parceiro-tabela parceiro-tabela-alunos parceiro-area-tabela" key={aluno.licencaId}>
                      <div>
                        <strong>{aluno.nome}</strong>
                        <small>{aluno.email || "E-mail não informado"}</small>
                        {aluno.status === "ativa" && (
                          <Link to={`/parceiro/mentoria/aluno/${aluno.userId}`}>Abrir acompanhamento</Link>
                        )}
                      </div>
                      <span>{aluno.turma}</span>
                      <div>
                        <strong>{aluno.questoes} questões · {aluno.minutos} min</strong>
                        <small>
                          {aluno.questoes
                            ? `${Math.round((aluno.acertos / aluno.questoes) * 100)}% de acertos`
                            : "Sem atividade"}
                        </small>
                      </div>
                      <div>
                        <b className={`status ${aluno.status}`}>{aluno.status}</b>
                        <small>{aluno.expiraEm ? `até ${data(aluno.expiraEm)}` : ""}</small>
                      </div>
                      <div className="parceiro-acoes parceiro-area-acoes">
                        {aluno.status !== "cancelada" && turmasAtivas.length > 1 && (
                          <select
                            aria-label={`Mover ${aluno.nome} para outra turma`}
                            value=""
                            disabled={processando === `mover-${aluno.licencaId}`}
                            onChange={(e) => void moverAluno(aluno, e.target.value)}
                          >
                            <option value="">Mover para...</option>
                            {turmasAtivas
                              .filter((turma) => turma.id !== aluno.turmaId)
                              .map((turma) => (
                                <option key={turma.id} value={turma.id}>{turma.nome}</option>
                              ))}
                          </select>
                        )}

                        {aluno.status === "ativa" ? (
                          <button
                            type="button"
                            disabled={processando === `licenca-${aluno.licencaId}`}
                            onClick={() => void mudarLicenca(aluno, "suspensa")}
                          >
                            Suspender
                          </button>
                        ) : aluno.status === "suspensa" ? (
                          <button
                            type="button"
                            disabled={processando === `licenca-${aluno.licencaId}`}
                            onClick={() => void mudarLicenca(aluno, "ativa")}
                          >
                            Reativar
                          </button>
                        ) : null}

                        {aluno.status !== "cancelada" && (
                          <button
                            type="button"
                            className="perigo"
                            disabled={processando === `licenca-${aluno.licencaId}`}
                            onClick={() => {
                              if (window.confirm(`Remover ${aluno.nome} desta parceria?`)) {
                                void mudarLicenca(aluno, "cancelada");
                              }
                            }}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <p className="parceiro-area-regra">
                Transferências para uma turma de outro parceiro não ficam disponíveis aqui. Esse tipo de mudança precisa ser solicitado ao suporte do Study Pro.
              </p>
            </section>
          )}

          {aba === "convites" && (
            <div className="parceiro-grade">
              <section className="parceiro-lista">
                <h2>Solicitações pendentes</h2>
                {pendentes === 0 ? (
                  <Vazio texto="Nenhum aluno aguardando aprovação." />
                ) : (
                  gestao.solicitacoes
                    .filter((solicitacao) => solicitacao.status === "pendente")
                    .map((solicitacao) => (
                      <article className="solicitacao" key={solicitacao.id}>
                        <div>
                          <strong>{solicitacao.nome}</strong>
                          <small>{solicitacao.email} · {solicitacao.turmaNome} · {data(solicitacao.solicitadoEm)}</small>
                        </div>
                        <div>
                          <button
                            type="button"
                            disabled={processando === `solicitacao-${solicitacao.id}`}
                            onClick={() => void responder(solicitacao.id, "aprovar")}
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            className="perigo"
                            disabled={processando === `solicitacao-${solicitacao.id}`}
                            onClick={() => void responder(solicitacao.id, "recusar")}
                          >
                            Recusar
                          </button>
                        </div>
                      </article>
                    ))
                )}
              </section>

              <section className="parceiro-lista">
                <h2>Gerar link de convite</h2>
                <p>O link já nasce preso à turma escolhida. Quem entrar por ele aparece somente nesta parceria.</p>
                <form className="convite-form" onSubmit={gerar}>
                  <label>
                    Turma
                    <select name="turma" required defaultValue="">
                      <option value="" disabled>Selecione</option>
                      {turmasAtivas.map((turma) => (
                        <option value={turma.id} key={turma.id}>{turma.nome}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Título
                    <input name="titulo" placeholder="Ex.: Turma PMPE 2027" />
                  </label>
                  <div>
                    <label>
                      Validade (dias)
                      <input name="validade" type="number" min="1" max="365" defaultValue="30" />
                    </label>
                    <label>
                      Acesso (meses)
                      <input name="duracao" type="number" min="1" max="60" defaultValue="12" />
                    </label>
                  </div>
                  <label>
                    Limite de usos (opcional)
                    <input name="maxUsos" type="number" min="1" />
                  </label>
                  <button disabled={processando === "convite-novo"}>
                    {processando === "convite-novo" ? "Gerando..." : "Gerar link com aprovação"}
                  </button>
                </form>

                {linkCriado && (
                  <div className="link-gerado">
                    <input readOnly value={linkCriado} aria-label="Link de convite criado" />
                    <button type="button" onClick={() => void copiarLink()}>Copiar</button>
                    <small>O código completo é mostrado apenas agora. Guarde o link antes de sair.</small>
                  </div>
                )}

                <h3>Convites criados</h3>
                {gestao.convites.length === 0 ? (
                  <Vazio texto="Nenhum convite criado." />
                ) : (
                  gestao.convites.map((convite) => (
                    <article className="convite-linha parceiro-area-convite" key={convite.id}>
                      <div>
                        <strong>{convite.titulo || convite.turmaNome}</strong>
                        <small>
                          {convite.turmaNome} · {convite.usos}{convite.maxUsos ? ` de ${convite.maxUsos}` : ""} usos
                          {convite.expiraEm ? ` · expira ${data(convite.expiraEm)}` : ""}
                        </small>
                      </div>
                      <div className="parceiro-area-convite-acoes">
                        <b className={`status ${convite.ativo ? "ativa" : "cancelada"}`}>
                          {convite.ativo ? "ativo" : "revogado"}
                        </b>
                        <button
                          type="button"
                          disabled={processando === `convite-${convite.id}`}
                          onClick={() => void alternarConvite(convite.id, !convite.ativo)}
                        >
                          {convite.ativo ? "Revogar" : "Reativar"}
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </section>
            </div>
          )}

          {aba === "financeiro" && (
            <section className="parceiro-lista">
              <h2>Financeiro da parceria</h2>
              <p>A estimativa considera somente licenças ativas desta parceria.</p>
              <div className="financeiro-destaque">
                <strong>{resumo?.alunosAtivos ?? 0} alunos ativos</strong>
                <span>{moeda(resumo?.valorMensal ?? 0)}</span>
              </div>
              {gestao.faturamento.length === 0 ? (
                <Vazio texto="Ainda não há fechamento mensal." />
              ) : (
                gestao.faturamento.map((faturamento) => (
                  <article className="convite-linha" key={faturamento.competencia}>
                    <div>
                      <strong>{mes(faturamento.competencia)}</strong>
                      <small>{faturamento.alunosAtivos} alunos ativos</small>
                    </div>
                    <strong>{moeda(faturamento.valorTotal)}</strong>
                  </article>
                ))
              )}
            </section>
          )}

          {aba === "auditoria" && (
            <section className="parceiro-lista">
              <h2>Histórico da parceria</h2>
              <p>Alterações de acesso, convites e movimentações de turma ficam registradas aqui.</p>
              {gestao.auditoria.length === 0 ? (
                <Vazio texto="Ainda não há eventos registrados." />
              ) : (
                gestao.auditoria.map((evento) => (
                  <article className="convite-linha" key={evento.id}>
                    <div>
                      <strong>{rotuloEvento(evento.evento)}</strong>
                      <small>{evento.usuarioNome}</small>
                    </div>
                    <time>{dataHora(evento.criadoEm)}</time>
                  </article>
                ))
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div className="parceiro-estado">{texto}</div>;
}

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function data(valor: string | null) {
  if (!valor) return "sem prazo";
  return new Date(valor).toLocaleDateString("pt-BR");
}

function dataHora(valor: string) {
  return new Date(valor).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function mes(valor: string) {
  const [ano, numeroMes] = valor.slice(0, 7).split("-").map(Number);
  if (!ano || !numeroMes) return valor;
  return new Date(ano, numeroMes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function rotuloEvento(evento: string) {
  const rotulos: Record<string, string> = {
    convite_criado: "Convite criado",
    convite_revogado: "Convite revogado",
    convite_reativado: "Convite reativado",
    aluno_movido_turma: "Aluno movido de turma",
    licenca_ativada: "Acesso ativado",
    licenca_suspensa: "Acesso suspenso",
    licenca_cancelada: "Aluno removido",
  };
  return rotulos[evento] || evento.replaceAll("_", " ");
}
