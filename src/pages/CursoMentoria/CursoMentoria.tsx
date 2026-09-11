import { useCallback, useEffect, useMemo, useState } from "react";
import { carregarMeusCursosMentoria, marcarAulaMentoria, type CursoMentoriaAluno } from "../../services/cursoParceiroService";
import "./CursoMentoria.css";

export default function CursoMentoria() {
  const [cursos, setCursos] = useState<CursoMentoriaAluno[]>([]);
  const [cursoId, setCursoId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      setErro("");
      const dados = await carregarMeusCursosMentoria();
      setCursos(dados);
      setCursoId((atual) => atual && dados.some((c) => c.id === atual) ? atual : dados[0]?.id ?? "");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar o curso."); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  const curso = useMemo(() => cursos.find((c) => c.id === cursoId) ?? null, [cursos, cursoId]);
  const totais = useMemo(() => {
    if (!curso) return { total: 0, concluidas: 0, percentual: 0 };
    const aulas = curso.disciplinas.flatMap((d) => d.modulos.flatMap((m) => m.aulas));
    const concluidas = aulas.filter((a) => a.concluida).length;
    return { total: aulas.length, concluidas, percentual: aulas.length ? Math.round(concluidas / aulas.length * 100) : 0 };
  }, [curso]);

  async function alternarAula(aulaId: string, concluida: boolean) {
    try { setProcessando(aulaId); setErro(""); await marcarAulaMentoria(aulaId, concluida); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível atualizar o progresso."); }
    finally { setProcessando(""); }
  }

  if (carregando) return <div className="cm-estado">Carregando seu curso...</div>;
  return <section className="cm-pagina">
    <header className="cm-hero">
      <div><span>CURSO DA MENTORIA</span><h1>{curso?.nome || "Seu conteúdo"}</h1><p>{curso?.descricao || "Acompanhe as aulas e materiais liberados pelo seu professor."}</p></div>
      {curso && <div className="cm-progresso"><strong>{totais.percentual}%</strong><span>{totais.concluidas} de {totais.total} concluídos</span><div><i style={{ width: `${totais.percentual}%` }} /></div></div>}
    </header>
    {erro && <div className="cm-erro" role="alert">{erro}</div>}
    {cursos.length > 1 && <nav className="cm-cursos">{cursos.map((item) => <button type="button" className={cursoId === item.id ? "ativo" : ""} key={item.id} onClick={() => setCursoId(item.id)}>{item.nome}</button>)}</nav>}
    {!curso ? <div className="cm-vazio"><h2>Nenhum curso liberado</h2><p>Quando sua turma receber um curso da mentoria, ele aparecerá aqui automaticamente.</p></div> : <div className="cm-disciplinas">{curso.disciplinas.map((disciplina) => {
      const aulasDisciplina = disciplina.modulos.flatMap((m) => m.aulas);
      const feitas = aulasDisciplina.filter((a) => a.concluida).length;
      return <section className="cm-disciplina" key={disciplina.id}><header><div><small>DISCIPLINA {disciplina.ordem}</small><h2>{disciplina.titulo}</h2><p>{disciplina.descricao}</p></div><b>{feitas}/{aulasDisciplina.length}</b></header><div className="cm-modulos">{disciplina.modulos.map((modulo) => <details open key={modulo.id}><summary><span><strong>Módulo {modulo.ordem} · {modulo.titulo}</strong><small>{modulo.descricao}</small></span><b>{modulo.aulas.filter((a) => a.concluida).length}/{modulo.aulas.length}</b></summary><div className="cm-aulas">{modulo.aulas.map((aula) => <article className={aula.concluida ? "concluida" : ""} key={aula.id}><button type="button" className="cm-check" disabled={processando === aula.id} onClick={() => void alternarAula(aula.id, !aula.concluida)} aria-label={aula.concluida ? `Marcar ${aula.titulo} como pendente` : `Marcar ${aula.titulo} como concluída`}>{aula.concluida ? "✓" : ""}</button><div className="cm-aula-info"><strong>{aula.ordem}. {aula.titulo}</strong><small>{tipo(aula.tipo)}{aula.duracaoMinutos ? ` · ${aula.duracaoMinutos} min` : ""}</small>{aula.descricao && <p>{aula.descricao}</p>}</div>{aula.url && <a href={aula.url} target="_blank" rel="noreferrer">Abrir conteúdo</a>}</article>)}</div></details>)}</div></section>;
    })}</div>}
  </section>;
}

function tipo(valor: string) { return valor === "video" ? "Videoaula" : valor === "material" ? "Material" : valor === "link" ? "Link" : "Texto"; }
