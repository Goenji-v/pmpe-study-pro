import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import { supabase } from "../../lib/supabase";
import {
  alternarAtivoCurso,
  carregarPainelCursosParceiro,
  criarAulaCurso,
  criarCursoParceiro,
  criarDisciplinaCurso,
  criarModuloCurso,
  definirTurmasCurso,
  excluirItemCurso,
  type AulaCursoParceiro,
  type CursoParceiro,
  type CursoStatusParceiro,
  type PainelCursosParceiro,
} from "../../services/cursoParceiroService";
import CursoFluxoPublicacao from "./CursoFluxoPublicacao";
import CursoImportador from "./CursoImportador";
import "./ParceiroCursos.css";
import "./CursoFluxoPublicacao.css";

const VAZIO: PainelCursosParceiro = { parceiroId: "", turmas: [], cursos: [] };

export default function ParceiroCursos() {
  const { contexto, carregando: verificando } = useContextoComercial();
  const [painel, setPainel] = useState<PainelCursosParceiro>(VAZIO);
  const [cursoId, setCursoId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const travaAcao = useRef(false);

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
      const dados = await carregarPainelCursosParceiro();
      setPainel(dados);
      setCursoId((atual) =>
        atual && dados.cursos.some((curso) => curso.id === atual)
          ? atual
          : dados.cursos[0]?.id ?? ""
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os conteúdos.");
    } finally {
      setCarregando(false);
    }
  }, [podeGerenciar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const curso = useMemo(
    () => painel.cursos.find((item) => item.id === cursoId) ?? null,
    [painel.cursos, cursoId]
  );

  async function executar(chave: string, tarefa: () => Promise<void>, sucesso?: string) {
    if (travaAcao.current) return;
    travaAcao.current = true;
    try {
      setProcessando(chave);
      setErro("");
      setMensagem("");
      await tarefa();
      if (sucesso) setMensagem(sucesso);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      travaAcao.current = false;
      setProcessando("");
    }
  }

  async function novoCurso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const nome = String(form.get("nome") || "").trim();
    if (!nome) return;
    await executar("curso-novo", async () => {
      const novoId = await criarCursoParceiro(painel.parceiroId, nome, String(form.get("descricao") || ""));
      setCursoId(novoId);
      evento.currentTarget.reset();
    }, "Curso criado como rascunho.");
  }

  async function novaDisciplina(evento: FormEvent<HTMLFormElement>, atual: CursoParceiro) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const titulo = String(form.get("titulo") || "").trim();
    if (!titulo) return;
    await executar(`disc-${atual.id}`, async () => {
      await criarDisciplinaCurso(
        atual.id,
        titulo,
        String(form.get("descricao") || ""),
        atual.disciplinas.length + 1
      );
      evento.currentTarget.reset();
    }, "Disciplina adicionada.");
  }

  async function novoModulo(
    evento: FormEvent<HTMLFormElement>,
    disciplinaId: string,
    ordem: number
  ) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const titulo = String(form.get("titulo") || "").trim();
    if (!titulo) return;
    await executar(`mod-${disciplinaId}`, async () => {
      await criarModuloCurso(
        painel.parceiroId,
        disciplinaId,
        titulo,
        String(form.get("descricao") || ""),
        ordem
      );
      evento.currentTarget.reset();
    }, "Módulo adicionado.");
  }

  async function novaAula(
    evento: FormEvent<HTMLFormElement>,
    moduloId: string,
    ordem: number
  ) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const titulo = String(form.get("titulo") || "").trim();
    const url = String(form.get("url") || "").trim();
    const duracaoTexto = String(form.get("duracao") || "").trim();
    if (!titulo || !url) return;
    if (!/^https:\/\//i.test(url)) {
      setErro("O link da aula precisa começar com https://.");
      return;
    }

    await executar(`aula-${moduloId}`, async () => {
      await criarAulaCurso(
        moduloId,
        titulo,
        String(form.get("descricao") || ""),
        String(form.get("tipo") || "video") as AulaCursoParceiro["tipo"],
        url,
        duracaoTexto ? Number(duracaoTexto) : null,
        ordem
      );
      evento.currentTarget.reset();
    }, "Link de aula adicionado.");
  }

  async function alternarTurma(turmaId: string) {
    if (!curso) return;
    const novos = curso.turmaIds.includes(turmaId)
      ? curso.turmaIds.filter((id) => id !== turmaId)
      : [...curso.turmaIds, turmaId];
    await executar(
      `turma-${turmaId}`,
      () => definirTurmasCurso(curso.id, novos),
      "Liberação por turma atualizada."
    );
  }

  async function editarLink(aula: AulaCursoParceiro) {
    const novoLink = window.prompt(
      `Link externo de “${aula.titulo}”`,
      aula.url || "https://"
    );
    if (novoLink === null) return;
    const url = novoLink.trim();
    if (!/^https:\/\//i.test(url)) {
      setErro("Informe uma URL HTTPS válida, começando com https://.");
      return;
    }

    await executar(`link-${aula.id}`, async () => {
      const { error } = await supabase
        .from("curso_parceiro_aulas")
        .update({ url, atualizado_em: new Date().toISOString() })
        .eq("id", aula.id);
      if (error) throw new Error(`Não foi possível atualizar o link: ${error.message}`);
    }, "Link atualizado. Todos os acessos passam a usar o novo endereço.");
  }

  async function excluir(
    entidade: "curso" | "disciplina" | "modulo" | "aula",
    id: string,
    nome: string,
    avisoExtra = "",
  ) {
    const alvo = entidade === "curso" ? "curso" : entidade === "disciplina" ? "disciplina" : entidade === "modulo" ? "módulo" : "aula";
    const confirmado = window.confirm(
      `Excluir ${alvo} “${nome}”?${avisoExtra ? `\n\n${avisoExtra}` : ""}\n\nEssa ação não pode ser desfeita.`
    );
    if (!confirmado) return;
    await executar(`excluir-${entidade}-${id}`, () => excluirItemCurso(entidade, id), `${nome} excluído.`);
  }

  if (verificando) return <div className="pc-estado">Verificando acesso à parceria...</div>;
  if (!podeGerenciar) return <Navigate to="/" replace />;

  return (
    <section className="pc-pagina">
      <header className="pc-hero">
        <div>
          <span>ÁREA DO PARCEIRO · CONTEÚDOS</span>
          <h1>Links do curso</h1>
          <p>
            O Study Pro organiza o estudo; as videoaulas continuam hospedadas na plataforma externa do parceiro. Cada aula pode apontar para um endereço diferente.
          </p>
        </div>
        <div className="pc-hero-acoes">
          <Link to="/parceiro">← Área do Parceiro</Link>
          <Link to="/parceiro/mentoria">Cronograma da turma</Link>
        </div>
      </header>

      {erro && <div className="pc-erro" role="alert">{erro}</div>}
      {mensagem && <div className="pc-estado" role="status">{mensagem}</div>}

      {carregando ? (
        <div className="pc-estado">Carregando conteúdos...</div>
      ) : (
        <div className="pc-layout">
          <aside className="pc-lateral">
            <h2>Cursos</h2>
            <div className="pc-cursos-lista">
              {painel.cursos.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={cursoId === item.id ? "ativo" : ""}
                  onClick={() => setCursoId(item.id)}
                >
                  <strong>{item.nome}</strong>
                  <small>{rotuloStatusCurto(item.status)} · {item.disciplinas.length} disciplinas · {contarAulas(item)} links</small>
                </button>
              ))}
            </div>

            <form className="pc-form" onSubmit={novoCurso}>
              <h3>Novo curso</h3>
              <input name="nome" required minLength={2} placeholder="Ex.: PMPE 2027" />
              <textarea name="descricao" placeholder="Descrição do curso" />
              <button disabled={processando === "curso-novo"}>
                {processando === "curso-novo" ? "Criando..." : "Criar rascunho"}
              </button>
            </form>
          </aside>

          <main className="pc-conteudo">
            {!curso ? (
              <>
                <div className="pc-vazio">
                  <h2>Crie o primeiro curso</h2>
                  <p>Você também pode usar o importador para trazer uma estrutura pronta e revisar antes de publicar.</p>
                </div>
                <CursoImportador parceiroId={painel.parceiroId} cursoAtual={null} onImportado={async (id) => { setCursoId(id); await carregar(); }} />
              </>
            ) : (
              <>
                <section className="pc-topo-curso">
                  <div>
                    <span>{curso.ativo ? "ATIVO" : "PAUSADO"}</span>
                    <h2>{curso.nome}</h2>
                    <p>{curso.descricao || "Sem descrição."}</p>
                  </div>
                  <div className="pc-topo-acoes">
                    <button
                      type="button"
                      className={curso.ativo ? "secundario" : "primario"}
                      disabled={processando === `curso-${curso.id}`}
                      onClick={() => void executar(
                        `curso-${curso.id}`,
                        () => alternarAtivoCurso("curso", curso.id, !curso.ativo)
                      )}
                    >
                      {curso.ativo ? "Pausar curso" : "Ativar curso"}
                    </button>
                    <button
                      type="button"
                      className="perigo"
                      disabled={curso.status === "publicado" || curso.possuiProgresso || processando === `excluir-curso-${curso.id}`}
                      title={curso.status === "publicado" ? "Arquive o curso antes de excluir." : curso.possuiProgresso ? "Há progresso de alunos protegido neste curso." : undefined}
                      onClick={() => void excluir(
                        "curso",
                        curso.id,
                        curso.nome,
                        `Serão excluídas ${curso.disciplinas.length} disciplinas, ${contarModulos(curso)} módulos e ${contarAulas(curso)} aulas.`
                      )}
                    >
                      {curso.status === "publicado" || curso.possuiProgresso ? "Exclusão protegida" : "Excluir curso"}
                    </button>
                  </div>
                </section>

                <CursoFluxoPublicacao
                  curso={curso}
                  onAtualizado={carregar}
                  onDuplicado={async (id) => {
                    setCursoId(id);
                    await carregar();
                  }}
                />

                <section className="pc-resumo">
                  <Resumo titulo="Disciplinas" valor={curso.disciplinas.length} />
                  <Resumo
                    titulo="Módulos"
                    valor={contarModulos(curso)}
                  />
                  <Resumo titulo="Aulas externas" valor={contarAulas(curso)} />
                  <Resumo titulo="Alunos liberados" valor={curso.progresso.length} />
                </section>

                {curso.status === "rascunho" ? (
                  <CursoImportador parceiroId={painel.parceiroId} cursoAtual={curso} onImportado={async (id) => { setCursoId(id); await carregar(); }} />
                ) : (
                  <div className="pc-estado">
                    Para importar uma estrutura grande neste curso, restaure-o como rascunho ou duplique o curso. Assim o conteúdo ao vivo dos alunos não é reestruturado por engano.
                  </div>
                )}

                <section className="pc-card">
                  <div className="pc-card-cabecalho">
                    <div>
                      <h3>Liberação por turma</h3>
                      <p>As turmas podem ser preparadas no rascunho; os alunos só enxergam o curso quando ele estiver publicado.</p>
                    </div>
                  </div>
                  <div className="pc-turmas">
                    {painel.turmas.filter((turma) => turma.ativa).map((turma) => (
                      <label key={turma.id}>
                        <input
                          type="checkbox"
                          checked={curso.turmaIds.includes(turma.id)}
                          disabled={processando.startsWith("turma-")}
                          onChange={() => void alternarTurma(turma.id)}
                        />
                        <span>{turma.nome}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="pc-card">
                  <div className="pc-card-cabecalho">
                    <div>
                      <h3>Conteúdo e links externos</h3>
                      <p>
                        Cadastre um link por aula. Alterações de link preservam o ID da aula e o progresso já feito. Exclusões em curso publicado ou em item com progresso são bloqueadas.
                      </p>
                    </div>
                  </div>

                  <form className="pc-form-inline" onSubmit={(e) => void novaDisciplina(e, curso)}>
                    <input name="titulo" required placeholder="Nova disciplina" />
                    <input name="descricao" placeholder="Descrição (opcional)" />
                    <button disabled={processando === `disc-${curso.id}`}>Adicionar disciplina</button>
                  </form>

                  <div className="pc-estrutura">
                    {curso.disciplinas.map((disciplina) => (
                      <article
                        className={`pc-disciplina ${disciplina.ativo ? "" : "inativo"}`}
                        key={disciplina.id}
                      >
                        <header>
                          <div>
                            <small>DISCIPLINA {disciplina.ordem}</small>
                            <h4>{disciplina.titulo}</h4>
                            <p>{disciplina.descricao}</p>
                          </div>
                          <div className="pc-item-acoes">
                            <button
                              type="button"
                              className="mini"
                              onClick={() => void executar(
                                `ativo-disc-${disciplina.id}`,
                                () => alternarAtivoCurso("disciplina", disciplina.id, !disciplina.ativo)
                              )}
                            >
                              {disciplina.ativo ? "Pausar" : "Ativar"}
                            </button>
                            <button
                              type="button"
                              className="mini perigo"
                              onClick={() => void excluir(
                                "disciplina",
                                disciplina.id,
                                disciplina.titulo,
                                `Os ${disciplina.modulos.length} módulos e ${disciplina.modulos.reduce((n, modulo) => n + modulo.aulas.length, 0)} aulas desta disciplina também serão excluídos. Se houver progresso, a exclusão será bloqueada.`
                              )}
                            >
                              Excluir
                            </button>
                          </div>
                        </header>

                        <form
                          className="pc-form-inline compacto"
                          onSubmit={(e) => void novoModulo(e, disciplina.id, disciplina.modulos.length + 1)}
                        >
                          <input name="titulo" required placeholder="Novo módulo" />
                          <input name="descricao" placeholder="Descrição" />
                          <button disabled={processando === `mod-${disciplina.id}`}>+ Módulo</button>
                        </form>

                        <div className="pc-modulos">
                          {disciplina.modulos.map((modulo) => (
                            <details open className={modulo.ativo ? "" : "inativo"} key={modulo.id}>
                              <summary>
                                <span>
                                  <b>Módulo {modulo.ordem} · {modulo.titulo}</b>
                                  <small>{modulo.aulas.length} aulas</small>
                                </span>
                                <div className="pc-item-acoes">
                                  <button
                                    type="button"
                                    className="mini"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      void executar(
                                        `ativo-mod-${modulo.id}`,
                                        () => alternarAtivoCurso("modulo", modulo.id, !modulo.ativo)
                                      );
                                    }}
                                  >
                                    {modulo.ativo ? "Pausar" : "Ativar"}
                                  </button>
                                  <button
                                    type="button"
                                    className="mini perigo"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      void excluir("modulo", modulo.id, modulo.titulo, `As ${modulo.aulas.length} aulas deste módulo também serão excluídas. Se houver progresso, a exclusão será bloqueada.`);
                                    }}
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </summary>

                              <div className="pc-aulas">
                                {modulo.aulas.map((aula) => (
                                  <div className={`pc-aula ${aula.ativo ? "" : "inativo"}`} key={aula.id}>
                                    <div>
                                      <b>{aula.ordem}. {aula.titulo}</b>
                                      <small>
                                        {rotuloTipo(aula.tipo)}
                                        {aula.duracaoMinutos ? ` · ${aula.duracaoMinutos} min` : ""}
                                      </small>
                                      {aula.descricao && <p>{aula.descricao}</p>}
                                      {aula.url && <small title={aula.url}>{encurtarUrl(aula.url)}</small>}
                                    </div>
                                    <div>
                                      {aula.url && (
                                        <a href={aula.url} target="_blank" rel="noreferrer">Abrir</a>
                                      )}
                                      <button
                                        type="button"
                                        className="mini"
                                        disabled={processando === `link-${aula.id}`}
                                        onClick={() => void editarLink(aula)}
                                      >
                                        Editar link
                                      </button>
                                      <button
                                        type="button"
                                        className="mini"
                                        onClick={() => void executar(
                                          `ativo-aula-${aula.id}`,
                                          () => alternarAtivoCurso("aula", aula.id, !aula.ativo)
                                        )}
                                      >
                                        {aula.ativo ? "Pausar" : "Ativar"}
                                      </button>
                                      <button
                                        type="button"
                                        className="mini perigo"
                                        onClick={() => void excluir("aula", aula.id, aula.titulo, "Se já existir progresso nesta aula, a exclusão será bloqueada e os dados serão preservados.")}
                                      >
                                        Excluir
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <form
                                className="pc-aula-form"
                                onSubmit={(e) => void novaAula(e, modulo.id, modulo.aulas.length + 1)}
                              >
                                <input name="titulo" required placeholder="Título da aula" />
                                <select name="tipo" defaultValue="video">
                                  <option value="video">Videoaula</option>
                                  <option value="material">Material</option>
                                  <option value="link">Link</option>
                                  <option value="texto">Texto</option>
                                </select>
                                <input name="url" type="url" required pattern="https://.*" placeholder="https://plataforma-do-parceiro/..." />
                                <input name="duracao" type="number" min="1" max="1440" placeholder="Min (opcional)" />
                                <input name="descricao" placeholder="Descrição" />
                                <button disabled={processando === `aula-${modulo.id}`}>Adicionar</button>
                              </form>
                            </details>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="pc-card">
                  <div className="pc-card-cabecalho">
                    <div>
                      <h3>Progresso dos alunos</h3>
                      <p>Acompanhamento das aulas concluídas dentro deste curso.</p>
                    </div>
                    <strong>{mediaProgresso(curso)}% média</strong>
                  </div>
                  {curso.progresso.length === 0 ? (
                    <div className="pc-vazio pequeno">Nenhum aluno ativo nas turmas liberadas.</div>
                  ) : (
                    <div className="pc-progresso-lista">
                      {curso.progresso.map((aluno) => (
                        <Link to={`/parceiro/mentoria/aluno/${aluno.userId}`} key={aluno.userId}>
                          <div>
                            <strong>{aluno.nome}</strong>
                            <small>{aluno.turma} · {aluno.concluidas}/{aluno.totalAulas} concluídas</small>
                          </div>
                          <div className="pc-progresso-barra">
                            <span style={{ width: `${Math.min(100, aluno.percentual)}%` }} />
                          </div>
                          <b>{Math.round(aluno.percentual)}%</b>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>
        </div>
      )}
    </section>
  );
}

function Resumo({ titulo, valor }: { titulo: string; valor: number }) {
  return <article><span>{titulo}</span><strong>{valor}</strong></article>;
}

function contarAulas(curso: CursoParceiro) {
  return curso.disciplinas.reduce(
    (total, disciplina) => total + disciplina.modulos.reduce((n, modulo) => n + modulo.aulas.length, 0),
    0
  );
}

function contarModulos(curso: CursoParceiro) {
  return curso.disciplinas.reduce((n, disciplina) => n + disciplina.modulos.length, 0);
}

function mediaProgresso(curso: CursoParceiro) {
  return curso.progresso.length
    ? Math.round(curso.progresso.reduce((n, aluno) => n + aluno.percentual, 0) / curso.progresso.length)
    : 0;
}

function rotuloStatusCurto(status: CursoStatusParceiro) {
  if (status === "publicado") return "Publicado";
  if (status === "arquivado") return "Arquivado";
  return "Rascunho";
}

function rotuloTipo(tipo: string) {
  return tipo === "video" ? "Videoaula" : tipo === "material" ? "Material" : tipo === "link" ? "Link" : "Texto";
}

function encurtarUrl(url: string) {
  try {
    const valor = new URL(url);
    return `${valor.hostname}${valor.pathname === "/" ? "" : valor.pathname}`.slice(0, 72);
  } catch {
    return url.slice(0, 72);
  }
}