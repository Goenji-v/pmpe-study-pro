import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import {
  alterarStatusConvite,
  carregarGestaoParceiro,
  carregarResumoParceiro,
  criarConvite,
  decidirSolicitacao,
  type GestaoParceiro,
  type ResumoParceiro,
} from "../../services/parceriasService";
import { obterPermissoesParceiro } from "../../utils/permissoesParceiro";
import ParceiroFinanceiro from "../../components/ParceiroFinanceiro/ParceiroFinanceiro";
import ProfessorDashboard from "./ProfessorDashboard";
import "./Parceiro.css";
import "./ParceiroArea.css";

type Aba = "visao" | "convites" | "financeiro" | "auditoria";

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
  const [gestao, setGestao] = useState<GestaoParceiro>(GESTAO_VAZIA);
  const [aba, setAba] = useState<Aba>("visao");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [linkCriado, setLinkCriado] = useState("");

  const permissoes = useMemo(
    () => obterPermissoesParceiro(contexto?.papel),
    [contexto?.papel],
  );
  const podeGerenciar = permissoes.podeAcessarArea;

  const carregar = useCallback(async () => {
    if (!podeGerenciar) {
      setCarregando(false);
      return;
    }

    try {
      setErro("");
      const [novoResumo, novaGestao] = await Promise.all([
        carregarResumoParceiro(),
        carregarGestaoParceiro(),
      ]);
      setResumo(novoResumo);
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

  const pendentes = gestao.solicitacoes.filter((s) => s.status === "pendente").length;
  const turmasAtivas = gestao.turmas.filter((turma) => turma.ativa);
  const abas = useMemo(() => {
    const itens: [Aba, string][] = [["visao", "Visão geral"]];
    if (permissoes.podeGerenciarConvites) itens.push(["convites", "Convites"]);
    if (permissoes.podeVerFinanceiro) itens.push(["financeiro", "Financeiro"]);
    if (permissoes.podeVerHistorico) itens.push(["auditoria", "Histórico"]);
    return itens;
  }, [permissoes]);

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
    if (!permissoes.podeGerenciarConvites) return;
    await executar(
      `solicitacao-${id}`,
      () => decidirSolicitacao(id, decisao),
      decisao === "aprovar" ? "Aluno aprovado na turma." : "Solicitação recusada."
    );
  }

  async function alternarConvite(id: string, ativo: boolean) {
    if (!permissoes.podeGerenciarConvites) return;
    await executar(
      `convite-${id}`,
      () => alterarStatusConvite(id, ativo),
      ativo ? "Convite reativado." : "Convite revogado."
    );
  }

  async function gerar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!permissoes.podeGerenciarConvites) return;
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
    <section className={`parceiro-pagina papel-${contexto?.papel || "desconhecido"}`}>
      <header className="parceiro-cabecalho parceiro-area-cabecalho">
        <div>
          <span>ÁREA DO PARCEIRO</span>
          <h1>{resumo?.parceiroNome || contexto?.parceiroNome || "Minha parceria"}</h1>
          <p>
            Organize seu curso uma vez e acompanhe somente os resultados consolidados das turmas.
          </p>
          <div className="parceiro-area-atalhos">
            <Link to="/parceiro/cursos">Gerenciar meu curso</Link>
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
        {abas.map(([id, nome]) => (
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
                  <small>{permissoes.podeGerenciarTurmas ? "Você pode criar, editar, arquivar e duplicar turmas." : "Você acompanha as turmas vinculadas à sua parceria."}</small>
                </article>
                <article>
                  <span>Alunos ativos</span>
                  <strong>{resumo?.alunosAtivos ?? 0}</strong>
                  <small>Somente números consolidados são exibidos ao parceiro.</small>
                </article>
                <article>
                  <span>{permissoes.podeGerenciarConvites ? "Solicitações" : "Seu perfil"}</span>
                  <strong>{permissoes.podeGerenciarConvites ? pendentes : "Professor"}</strong>
                  <small>{permissoes.podeGerenciarConvites ? "Entradas aguardando sua aprovação." : "Foco na organização do curso e no resumo das turmas."}</small>
                </article>
              </section>
              <ProfessorDashboard />
            </>
          )}

          {permissoes.podeGerenciarConvites && aba === "convites" && (
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

          {permissoes.podeVerFinanceiro && aba === "financeiro" && (
            <ParceiroFinanceiro
              alunosAtivos={resumo?.alunosAtivos ?? 0}
              valorMensal={resumo?.valorMensal ?? 0}
            />
          )}

          {permissoes.podeVerHistorico && aba === "auditoria" && (
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

function rotuloEvento(evento: string) {
  const rotulos: Record<string, string> = {
    convite_criado: "Convite criado",
    convite_revogado: "Convite revogado",
    convite_reativado: "Convite reativado",
    aluno_movido_turma: "Aluno movido de turma",
    licenca_ativada: "Acesso ativado",
    licenca_suspensa: "Acesso suspenso",
    licenca_cancelada: "Aluno removido",
    turma_criada: "Turma criada",
    turma_atualizada: "Turma atualizada",
  };
  return rotulos[evento] || evento.replaceAll("_", " ");
}
