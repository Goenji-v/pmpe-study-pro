import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import {
  alterarStatusLicenca,
  carregarGestaoParceiro,
  carregarResumoParceiro,
  criarConvite,
  decidirSolicitacao,
  listarAlunosDoParceiro,
  type AlunoParceiro,
  type GestaoParceiro,
  type ResumoParceiro,
} from "../../services/parceriasService";
import ProfessorDashboard from "./ProfessorDashboard";
import "./Parceiro.css";

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
      setErro(e instanceof Error ? e.message : "Erro ao carregar painel.");
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
      ? alunos.filter((a) =>
          `${a.nome} ${a.email} ${a.turma} ${a.status}`
            .toLocaleLowerCase("pt-BR")
            .includes(termo)
        )
      : alunos;
  }, [alunos, busca]);

  async function responder(id: string, decisao: "aprovar" | "recusar") {
    try {
      setProcessando(id);
      setErro("");
      await decidirSolicitacao(id, decisao);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível responder.");
    } finally {
      setProcessando("");
    }
  }

  async function mudarLicenca(
    aluno: AlunoParceiro,
    status: "ativa" | "suspensa" | "cancelada"
  ) {
    const motivo =
      status === "suspensa"
        ? "Acesso suspenso pelo responsável da turma."
        : status === "cancelada"
          ? "Acesso cancelado pelo responsável da turma."
          : undefined;

    try {
      setProcessando(aluno.licencaId);
      await alterarStatusLicenca(aluno.licencaId, status, motivo);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar.");
    } finally {
      setProcessando("");
    }
  }

  async function gerar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const turma = String(form.get("turma") || "");
    if (!turma) return;

    try {
      setProcessando("convite");
      setErro("");
      const codigo = await criarConvite(
        turma,
        Number(form.get("validade") || 30),
        form.get("maxUsos") ? Number(form.get("maxUsos")) : null,
        Number(form.get("duracao") || 12),
        String(form.get("titulo") || "")
      );
      setLinkCriado(`${window.location.origin}/convite/${codigo}`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o convite.");
    } finally {
      setProcessando("");
    }
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(linkCriado);
  }

  if (verificando) {
    return <div className="parceiro-estado">Verificando perfil do parceiro...</div>;
  }

  if (!podeGerenciar) return <Navigate to="/" replace />;

  const pendentes = gestao.solicitacoes.filter((s) => s.status === "pendente").length;

  return (
    <section className="parceiro-pagina">
      <header className="parceiro-cabecalho">
        <div>
          <span>ÁREA DO PROFESSOR</span>
          <h1>{resumo?.parceiroNome || contexto?.parceiroNome || "Minha organização"}</h1>
          <p>
            Acompanhe sua mentoria, identifique quem precisa de ajuda e gerencie os acessos da sua turma.
          </p>
          <Link className="parceiro-atalho-mentoria" to="/parceiro/mentoria">
            Configurar trilha da mentoria →
          </Link>
        </div>
        <div className="parceiro-valor">
          <small>Estimativa do mês</small>
          <strong>{moeda(resumo?.valorMensal ?? 0)}</strong>
          <span>R$ 20 por aluno ativo</span>
        </div>
      </header>

      {erro && <div className="parceiro-erro" role="alert">{erro}</div>}

      <nav className="parceiro-abas" aria-label="Seções do painel">
        {([
          ["visao", "Visão geral"],
          ["alunos", "Alunos"],
          ["convites", "Turmas e convites"],
          ["financeiro", "Financeiro"],
          ["auditoria", "Histórico"],
        ] as [Aba, string][]).map(([id, nome]) => (
          <button
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
        <div className="parceiro-estado">Carregando painel...</div>
      ) : (
        <>
          {aba === "visao" && <ProfessorDashboard />}

          {aba === "alunos" && (
            <section className="parceiro-lista">
              <div className="parceiro-lista-topo">
                <div>
                  <h2>Alunos vinculados</h2>
                  <p>Nome, contato, licença e resumo mensal. Notas e anotações pessoais não aparecem aqui.</p>
                </div>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar aluno ou turma"
                  aria-label="Buscar aluno ou turma"
                />
              </div>

              {filtrados.length === 0 ? (
                <Vazio texto="Nenhum aluno encontrado." />
              ) : (
                <div className="parceiro-tabela-area">
                  <div className="parceiro-tabela parceiro-tabela-alunos cabecalho">
                    <span>Aluno</span>
                    <span>Turma</span>
                    <span>Desempenho no mês</span>
                    <span>Acesso</span>
                    <span>Ações</span>
                  </div>

                  {filtrados.map((a) => (
                    <article className="parceiro-tabela parceiro-tabela-alunos" key={a.licencaId}>
                      <div>
                        <strong>{a.nome}</strong>
                        <small>{a.email || "E-mail não informado"}</small>
                        {a.status === "ativa" && (
                          <Link to={`/parceiro/mentoria/aluno/${a.userId}`}>Abrir acompanhamento</Link>
                        )}
                      </div>
                      <span>{a.turma}</span>
                      <div>
                        <strong>{a.questoes} questões · {a.minutos} min</strong>
                        <small>
                          {a.questoes
                            ? `${Math.round((a.acertos / a.questoes) * 100)}% de acertos`
                            : "Sem atividade"}
                        </small>
                      </div>
                      <div>
                        <b className={`status ${a.status}`}>{a.status}</b>
                        <small>{a.expiraEm ? `até ${data(a.expiraEm)}` : ""}</small>
                      </div>
                      <div className="parceiro-acoes">
                        {a.status === "ativa" ? (
                          <button
                            disabled={processando === a.licencaId}
                            onClick={() => mudarLicenca(a, "suspensa")}
                          >
                            Suspender
                          </button>
                        ) : a.status === "suspensa" ? (
                          <button
                            disabled={processando === a.licencaId}
                            onClick={() => mudarLicenca(a, "ativa")}
                          >
                            Reativar
                          </button>
                        ) : null}
                        {a.status !== "cancelada" && (
                          <button
                            className="perigo"
                            disabled={processando === a.licencaId}
                            onClick={() => mudarLicenca(a, "cancelada")}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
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
                    .filter((s) => s.status === "pendente")
                    .map((s) => (
                      <article className="solicitacao" key={s.id}>
                        <div>
                          <strong>{s.nome}</strong>
                          <small>{s.email} · {s.turmaNome} · {data(s.solicitadoEm)}</small>
                        </div>
                        <div>
                          <button disabled={processando === s.id} onClick={() => responder(s.id, "aprovar")}>Aprovar</button>
                          <button className="perigo" disabled={processando === s.id} onClick={() => responder(s.id, "recusar")}>Recusar</button>
                        </div>
                      </article>
                    ))
                )}
              </section>

              <section className="parceiro-lista">
                <h2>Gerar link de convite</h2>
                <form className="convite-form" onSubmit={gerar}>
                  <label>
                    Turma
                    <select name="turma" required defaultValue="">
                      <option value="" disabled>Selecione</option>
                      {gestao.turmas.filter((t) => t.ativa).map((t) => (
                        <option value={t.id} key={t.id}>{t.nome}</option>
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
                  <button disabled={processando === "convite"}>
                    {processando === "convite" ? "Gerando..." : "Gerar link com aprovação"}
                  </button>
                </form>

                {linkCriado && (
                  <div className="link-gerado">
                    <input readOnly value={linkCriado} aria-label="Link de convite criado" />
                    <button onClick={copiarLink}>Copiar</button>
                    <small>Guarde este link: por segurança, o código não pode ser recuperado depois.</small>
                  </div>
                )}

                <h3>Convites criados</h3>
                {gestao.convites.length === 0 ? (
                  <Vazio texto="Nenhum convite criado." />
                ) : (
                  gestao.convites.map((c) => (
                    <article className="convite-linha" key={c.id}>
                      <div>
                        <strong>{c.titulo || c.turmaNome}</strong>
                        <small>{c.usos}{c.maxUsos ? ` de ${c.maxUsos}` : ""} usos · expira {data(c.expiraEm)}</small>
                      </div>
                      <b className={`status ${c.ativo ? "ativa" : "cancelada"}`}>
                        {c.ativo ? "ativo" : "encerrado"}
                      </b>
                    </article>
                  ))
                )}
              </section>
            </div>
          )}

          {aba === "financeiro" && (
            <section className="parceiro-lista">
              <h2>Financeiro</h2>
              <p>A estimativa atual considera somente licenças ativas. Fechamentos oficiais aparecem abaixo.</p>
              <div className="financeiro-destaque">
                <strong>{resumo?.alunosAtivos ?? 0} alunos × R$ 20,00</strong>
                <span>{moeda(resumo?.valorMensal ?? 0)}</span>
              </div>
              {gestao.faturamento.length === 0 ? (
                <Vazio texto="Ainda não há fechamento mensal." />
              ) : (
                gestao.faturamento.map((f) => (
                  <article className="convite-linha" key={f.competencia}>
                    <div>
                      <strong>{mes(f.competencia)}</strong>
                      <small>{f.alunosAtivos} alunos ativos</small>
                    </div>
                    <strong>{moeda(f.valorTotal)}</strong>
                  </article>
                ))
              )}
            </section>
          )}

          {aba === "auditoria" && (
            <section className="parceiro-lista">
              <h2>Histórico de acessos</h2>
              <p>Últimas aprovações, suspensões e cancelamentos.</p>
              {gestao.auditoria.length === 0 ? (
                <Vazio texto="Nenhuma alteração registrada." />
              ) : (
                gestao.auditoria.map((e) => (
                  <article className="convite-linha" key={e.id}>
                    <div>
                      <strong>{eventoLegivel(e.evento)}</strong>
                      <small>{e.usuarioNome}</small>
                    </div>
                    <time>{dataHora(e.criadoEm)}</time>
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

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function data(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}

function dataHora(v: string) {
  return new Date(v).toLocaleString("pt-BR");
}

function mes(v: string) {
  return new Date(`${v.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function eventoLegivel(v: string) {
  return v.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}
