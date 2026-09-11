import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import {
  alternarAtivoCurso,
  carregarPainelCursosParceiro,
  criarAulaCurso,
  criarCursoParceiro,
  criarDisciplinaCurso,
  criarModuloCurso,
  definirTurmasCurso,
  type CursoParceiro,
  type PainelCursosParceiro,
} from "../../services/cursoParceiroService";
import "./ParceiroCursos.css";

const VAZIO: PainelCursosParceiro = { parceiroId: "", turmas: [], cursos: [] };

export default function ParceiroCursos() {
  const { contexto, carregando: verificando } = useContextoComercial();
  const [painel, setPainel] = useState<PainelCursosParceiro>(VAZIO);
  const [cursoId, setCursoId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const podeGerenciar = contexto?.papel === "proprietario" || contexto?.papel === "gestor" || contexto?.papel === "professor";

  const carregar = useCallback(async () => {
    if (!podeGerenciar) { setCarregando(false); return; }
    try {
      setErro("");
      const dados = await carregarPainelCursosParceiro();
      setPainel(dados);
      setCursoId((atual) => atual && dados.cursos.some((c) => c.id === atual) ? atual : dados.cursos[0]?.id ?? "");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os cursos.");
    } finally { setCarregando(false); }
  }, [podeGerenciar]);

  useEffect(() => { void carregar(); }, [carregar]);
  const curso = useMemo(() => painel.cursos.find((c) => c.id === cursoId) ?? null, [painel.cursos, cursoId]);

  async function executar(chave: string, tarefa: () => Promise<void>) {
    try { setProcessando(chave); setErro(""); await tarefa(); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setProcessando(""); }
  }

  async function novoCurso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const nome = String(form.get("nome") || "").trim();
    if (!nome) return;
    await executar("curso-novo", async () => {
      await criarCursoParceiro(painel.parceiroId, nome, String(form.get("descricao") || ""));
      evento.currentTarget.reset();
    });
  }

  async function novaDisciplina(evento: FormEvent<HTMLFormElement>, atual: CursoParceiro) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const titulo = String(form.get("titulo") || "").trim();
    if (!titulo) return;
    await executar(`disc-${atual.id}`, async () => {
      await criarDisciplinaCurso(atual.id, titulo, String(form.get("descricao") || ""), atual.disciplinas.length + 1);
      evento.currentTarget.reset();
    });
  }

  async function novoModulo(evento: FormEvent<HTMLFormElement>, disciplinaId: string, ordem: number) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const titulo = String(form.get("titulo") || "").trim();
    if (!titulo) return;
    await executar(`mod-${disciplinaId}`, async () => {
      await criarModuloCurso(painel.parceiroId, disciplinaId, titulo, String(form.get("descricao") || ""), ordem);
      evento.currentTarget.reset();
    });
  }

  async function novaAula(evento: FormEvent<HTMLFormElement>, moduloId: string, ordem: number) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const titulo = String(form.get("titulo") || "").trim();
    if (!titulo) return;
    await executar(`aula-${moduloId}`, async () => {
      await criarAulaCurso(
        moduloId,
        titulo,
        String(form.get("descricao") || ""),
        String(form.get("tipo") || "video") as "video" | "material" | "link" | "texto",
        String(form.get("url") || ""),
        Number(form.get("duracao") || 0),
        ordem,
      );
      evento.currentTarget.reset();
    });
  }

  async function alternarTurma(turmaId: string) {
    if (!curso) return;
    const novos = curso.turmaIds.includes(turmaId) ? curso.turmaIds.filter((id) => id !== turmaId) : [...curso.turmaIds, turmaId];
    await executar(`turma-${turmaId}`, () => definirTurmasCurso(curso.id, novos));
  }

  if (verificando) return <div className="pc-estado">Verificando perfil...</div>;
  if (!podeGerenciar) return <Navigate to="/" replace />;

  return <section className="pc-pagina">
    <header className="pc-hero">
      <div><span>CURSO DO PROFESSOR</span><h1>Conteúdo da mentoria</h1><p>Monte a estrutura Curso → Disciplina → Módulo → Aula/Material e escolha quais turmas recebem acesso.</p></div>
      <div className="pc-hero-acoes"><Link to="/parceiro">← Painel</Link><Link to="/parceiro/mentoria">Trilha da mentoria</Link></div>
    </header>

    {erro && <div className="pc-erro" role="alert">{erro}</div>}
    {carregando ? <div className="pc-estado">Carregando cursos...</div> : <div className="pc-layout">
      <aside className="pc-lateral">
        <h2>Cursos</h2>
        <div className="pc-cursos-lista">{painel.cursos.map((item) => <button type="button" key={item.id} className={cursoId === item.id ? "ativo" : ""} onClick={() => setCursoId(item.id)}><strong>{item.nome}</strong><small>{item.disciplinas.length} disciplinas · {contarAulas(item)} aulas</small></button>)}</div>
        <form className="pc-form" onSubmit={novoCurso}>
          <h3>Novo curso</h3>
          <input name="nome" required minLength={2} placeholder="Ex.: PMPE 2027" />
          <textarea name="descricao" placeholder="Descrição do curso" />
          <button disabled={processando === "curso-novo"}>{processando === "curso-novo" ? "Criando..." : "Criar curso"}</button>
        </form>
      </aside>

      <main className="pc-conteudo">
        {!curso ? <div className="pc-vazio"><h2>Crie o primeiro curso</h2><p>Depois você poderá adicionar disciplinas, módulos, aulas e liberar o conteúdo para as turmas.</p></div> : <>
          <section className="pc-topo-curso">
            <div><span>{curso.ativo ? "ATIVO" : "PAUSADO"}</span><h2>{curso.nome}</h2><p>{curso.descricao || "Sem descrição."}</p></div>
            <button type="button" className={curso.ativo ? "secundario" : "primario"} disabled={processando === `curso-${curso.id}`} onClick={() => executar(`curso-${curso.id}`, () => alternarAtivoCurso("curso", curso.id, !curso.ativo))}>{curso.ativo ? "Pausar curso" : "Ativar curso"}</button>
          </section>

          <section className="pc-resumo">
            <Resumo titulo="Disciplinas" valor={curso.disciplinas.length} />
            <Resumo titulo="Módulos" valor={curso.disciplinas.reduce((n, d) => n + d.modulos.length, 0)} />
            <Resumo titulo="Aulas/materiais" valor={contarAulas(curso)} />
            <Resumo titulo="Alunos liberados" valor={curso.progresso.length} />
          </section>

          <section className="pc-card">
            <div className="pc-card-cabecalho"><div><h3>Liberação por turma</h3><p>Somente alunos com licença ativa nas turmas selecionadas enxergam este curso.</p></div></div>
            <div className="pc-turmas">{painel.turmas.filter((t) => t.ativa).map((turma) => <label key={turma.id}><input type="checkbox" checked={curso.turmaIds.includes(turma.id)} disabled={processando.startsWith("turma-")} onChange={() => void alternarTurma(turma.id)} /><span>{turma.nome}</span></label>)}</div>
          </section>

          <section className="pc-card">
            <div className="pc-card-cabecalho"><div><h3>Estrutura do curso</h3><p>Organize o caminho recomendado. Itens pausados deixam de aparecer para o aluno.</p></div></div>
            <form className="pc-form-inline" onSubmit={(e) => novaDisciplina(e, curso)}><input name="titulo" required placeholder="Nova disciplina" /><input name="descricao" placeholder="Descrição (opcional)" /><button disabled={processando === `disc-${curso.id}`}>Adicionar disciplina</button></form>
            <div className="pc-estrutura">{curso.disciplinas.map((disciplina) => <article className={`pc-disciplina ${disciplina.ativo ? "" : "inativo"}`} key={disciplina.id}>
              <header><div><small>DISCIPLINA {disciplina.ordem}</small><h4>{disciplina.titulo}</h4><p>{disciplina.descricao}</p></div><button type="button" className="mini" onClick={() => executar(`ativo-disc-${disciplina.id}`, () => alternarAtivoCurso("disciplina", disciplina.id, !disciplina.ativo))}>{disciplina.ativo ? "Pausar" : "Ativar"}</button></header>
              <form className="pc-form-inline compacto" onSubmit={(e) => novoModulo(e, disciplina.id, disciplina.modulos.length + 1)}><input name="titulo" required placeholder="Novo módulo" /><input name="descricao" placeholder="Descrição" /><button>+ Módulo</button></form>
              <div className="pc-modulos">{disciplina.modulos.map((modulo) => <details open className={modulo.ativo ? "" : "inativo"} key={modulo.id}><summary><span><b>Módulo {modulo.ordem} · {modulo.titulo}</b><small>{modulo.aulas.length} itens</small></span><button type="button" className="mini" onClick={(e) => { e.preventDefault(); void executar(`ativo-mod-${modulo.id}`, () => alternarAtivoCurso("modulo", modulo.id, !modulo.ativo)); }}>{modulo.ativo ? "Pausar" : "Ativar"}</button></summary>
                <div className="pc-aulas">{modulo.aulas.map((aula) => <div className={`pc-aula ${aula.ativo ? "" : "inativo"}`} key={aula.id}><div><b>{aula.ordem}. {aula.titulo}</b><small>{rotuloTipo(aula.tipo)}{aula.duracaoMinutos ? ` · ${aula.duracaoMinutos} min` : ""}</small>{aula.descricao && <p>{aula.descricao}</p>}</div><div>{aula.url && <a href={aula.url} target="_blank" rel="noreferrer">Abrir</a>}<button type="button" className="mini" onClick={() => executar(`ativo-aula-${aula.id}`, () => alternarAtivoCurso("aula", aula.id, !aula.ativo))}>{aula.ativo ? "Pausar" : "Ativar"}</button></div></div>)}</div>
                <form className="pc-aula-form" onSubmit={(e) => novaAula(e, modulo.id, modulo.aulas.length + 1)}><input name="titulo" required placeholder="Título da aula/material" /><select name="tipo" defaultValue="video"><option value="video">Videoaula</option><option value="material">Material</option><option value="link">Link</option><option value="texto">Texto</option></select><input name="url" type="url" placeholder="URL (opcional)" /><input name="duracao" type="number" min="0" max="1000" placeholder="Min" /><input name="descricao" placeholder="Descrição" /><button>Adicionar</button></form>
              </details>)}</div>
            </article>)}</div>
          </section>

          <section className="pc-card">
            <div className="pc-card-cabecalho"><div><h3>Progresso dos alunos</h3><p>Acompanhamento das aulas concluídas dentro deste curso.</p></div><strong>{mediaProgresso(curso)}% média</strong></div>
            {curso.progresso.length === 0 ? <div className="pc-vazio pequeno">Nenhum aluno ativo nas turmas liberadas.</div> : <div className="pc-progresso-lista">{curso.progresso.map((aluno) => <Link to={`/parceiro/mentoria/aluno/${aluno.userId}`} key={aluno.userId}><div><strong>{aluno.nome}</strong><small>{aluno.turma} · {aluno.concluidas}/{aluno.totalAulas} concluídas</small></div><div className="pc-progresso-barra"><span style={{ width: `${Math.min(100, aluno.percentual)}%` }} /></div><b>{Math.round(aluno.percentual)}%</b></Link>)}</div>}
          </section>
        </>}
      </main>
    </div>}
  </section>;
}

function Resumo({ titulo, valor }: { titulo: string; valor: number }) { return <article><span>{titulo}</span><strong>{valor}</strong></article>; }
function contarAulas(curso: CursoParceiro) { return curso.disciplinas.reduce((t, d) => t + d.modulos.reduce((n, m) => n + m.aulas.length, 0), 0); }
function mediaProgresso(curso: CursoParceiro) { return curso.progresso.length ? Math.round(curso.progresso.reduce((n, a) => n + a.percentual, 0) / curso.progresso.length) : 0; }
function rotuloTipo(tipo: string) { return tipo === "video" ? "Videoaula" : tipo === "material" ? "Material" : tipo === "link" ? "Link" : "Texto"; }
