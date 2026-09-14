import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCronometro } from "../../context/CronometroContext";
import { registrarAulaMentoriaAtiva } from "../../services/aulaMentoriaAtiva";
import {
  carregarMeusCursosMentoria,
  type AulaCursoParceiro,
  type CursoMentoriaAluno,
  type DisciplinaCursoParceiro,
  type ModuloCursoParceiro,
} from "../../services/cursoParceiroService";
import { limparTarefaMentoriaAtiva } from "../../services/tarefaMentoriaAtiva";
import "./CursoMentoria.css";

export default function CursoMentoria() {
  const navigate = useNavigate();
  const { cronometroAtivo, sessaoAtiva, iniciar } = useCronometro();
  const [cursos, setCursos] = useState<CursoMentoriaAluno[]>([]);
  const [cursoId, setCursoId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      setErro("");
      const dados = await carregarMeusCursosMentoria();
      setCursos(dados);
      setCursoId((atual) =>
        atual && dados.some((curso) => curso.id === atual)
          ? atual
          : dados[0]?.id ?? ""
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o curso.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    function atualizarCurso() {
      void carregar();
    }

    window.addEventListener("pmpe-curso-mentoria-atualizado", atualizarCurso);
    return () => window.removeEventListener("pmpe-curso-mentoria-atualizado", atualizarCurso);
  }, [carregar]);

  const curso = useMemo(
    () => cursos.find((item) => item.id === cursoId) ?? null,
    [cursos, cursoId]
  );

  const totais = useMemo(() => {
    if (!curso) return { total: 0, concluidas: 0, percentual: 0 };
    const aulas = curso.disciplinas.flatMap((disciplina) =>
      disciplina.modulos.flatMap((modulo) => modulo.aulas)
    );
    const concluidas = aulas.filter((aula) => aula.concluida).length;
    return {
      total: aulas.length,
      concluidas,
      percentual: aulas.length ? Math.round((concluidas / aulas.length) * 100) : 0,
    };
  }, [curso]);

  function aulaEmAndamento(
    disciplina: DisciplinaCursoParceiro,
    modulo: ModuloCursoParceiro,
    aula: AulaCursoParceiro
  ) {
    return Boolean(
      cronometroAtivo &&
      mesmoTexto(sessaoAtiva.materia, disciplina.titulo) &&
      mesmoTexto(sessaoAtiva.modulo ?? "", modulo.titulo) &&
      mesmoTexto(sessaoAtiva.assunto, aula.titulo)
    );
  }

  function iniciarEstudo(
    cursoAtual: CursoMentoriaAluno,
    disciplina: DisciplinaCursoParceiro,
    modulo: ModuloCursoParceiro,
    aula: AulaCursoParceiro
  ) {
    if (aulaEmAndamento(disciplina, modulo, aula)) {
      if (aula.url) abrirConteudo(aula.url);
      navigate("/central-estudos", { state: { origem: "curso-mentoria" } });
      return;
    }

    const iniciou = iniciar({
      materia: disciplina.titulo,
      modulo: modulo.titulo,
      assunto: aula.titulo,
      tipo: tipoSessao(aula.tipo),
      objetivo: `Concluir ${aula.titulo} no curso ${cursoAtual.nome}`,
      urlAula: aula.url || undefined,
    });

    if (!iniciou) return;

    // Se outra tarefa da mentoria estava vinculada ao cronômetro substituído,
    // ela não pode ser concluída junto com esta aula.
    limparTarefaMentoriaAtiva();
    registrarAulaMentoriaAtiva({
      aulaId: aula.id,
      cursoId: cursoAtual.id,
      disciplinaId: disciplina.id,
      moduloId: modulo.id,
      curso: cursoAtual.nome,
      disciplina: disciplina.titulo,
      modulo: modulo.titulo,
      titulo: aula.titulo,
      iniciadaEm: new Date().toISOString(),
    });

    if (aula.url) abrirConteudo(aula.url);
    navigate("/central-estudos", { state: { origem: "curso-mentoria" } });
  }

  if (carregando) return <div className="cm-estado">Carregando seu curso...</div>;

  return (
    <section className="cm-pagina">
      <header className="cm-hero">
        <div>
          <span>CURSO DA MENTORIA</span>
          <h1>{curso?.nome || "Seu conteúdo"}</h1>
          <p>
            {curso?.descricao || "Acompanhe as aulas e materiais liberados pelo seu professor."}
          </p>
        </div>
        {curso && (
          <div className="cm-progresso">
            <strong>{totais.percentual}%</strong>
            <span>{totais.concluidas} de {totais.total} concluídos</span>
            <div><i style={{ width: `${totais.percentual}%` }} /></div>
          </div>
        )}
      </header>

      <div className="cm-fluxo-aviso">
        <strong>Estudo conectado ao seu progresso</strong>
        <span>
          Inicie a aula por aqui. Quando você voltar e finalizar a sessão no cronômetro,
          o tempo será salvo, a aula será concluída automaticamente e a primeira revisão será agendada.
        </span>
      </div>

      {erro && <div className="cm-erro" role="alert">{erro}</div>}

      {cursos.length > 1 && (
        <nav className="cm-cursos">
          {cursos.map((item) => (
            <button
              type="button"
              className={cursoId === item.id ? "ativo" : ""}
              key={item.id}
              onClick={() => setCursoId(item.id)}
            >
              {item.nome}
            </button>
          ))}
        </nav>
      )}

      {!curso ? (
        <div className="cm-vazio">
          <h2>Nenhum curso liberado</h2>
          <p>Quando sua turma receber um curso da mentoria, ele aparecerá aqui automaticamente.</p>
        </div>
      ) : (
        <div className="cm-disciplinas">
          {curso.disciplinas.map((disciplina) => {
            const aulasDisciplina = disciplina.modulos.flatMap((modulo) => modulo.aulas);
            const feitas = aulasDisciplina.filter((aula) => aula.concluida).length;

            return (
              <section className="cm-disciplina" key={disciplina.id}>
                <header>
                  <div>
                    <small>DISCIPLINA {disciplina.ordem}</small>
                    <h2>{disciplina.titulo}</h2>
                    <p>{disciplina.descricao}</p>
                  </div>
                  <b>{feitas}/{aulasDisciplina.length}</b>
                </header>

                <div className="cm-modulos">
                  {disciplina.modulos.map((modulo) => (
                    <details open key={modulo.id}>
                      <summary>
                        <span>
                          <strong>Módulo {modulo.ordem} · {modulo.titulo}</strong>
                          <small>{modulo.descricao}</small>
                        </span>
                        <b>{modulo.aulas.filter((aula) => aula.concluida).length}/{modulo.aulas.length}</b>
                      </summary>

                      <div className="cm-aulas">
                        {modulo.aulas.map((aula) => {
                          const emAndamento = aulaEmAndamento(disciplina, modulo, aula);
                          return (
                            <article
                              className={`${aula.concluida ? "concluida" : ""} ${emAndamento ? "em-andamento" : ""}`.trim()}
                              key={aula.id}
                            >
                              <span className="cm-status-aula" aria-hidden="true">
                                {aula.concluida ? "✓" : emAndamento ? "▶" : ""}
                              </span>

                              <div className="cm-aula-info">
                                <strong>{aula.ordem}. {aula.titulo}</strong>
                                <small>
                                  {tipo(aula.tipo)}
                                  {aula.duracaoMinutos ? ` · ${aula.duracaoMinutos} min` : ""}
                                  {emAndamento ? " · sessão em andamento" : ""}
                                </small>
                                {aula.descricao && <p>{aula.descricao}</p>}
                              </div>

                              <div className="cm-aula-acoes">
                                {aula.concluida ? (
                                  <span className="cm-concluida">Concluída</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="cm-iniciar"
                                    onClick={() => iniciarEstudo(curso, disciplina, modulo, aula)}
                                  >
                                    {emAndamento ? "Ir para sessão" : "▶ Iniciar estudo"}
                                  </button>
                                )}
                                {aula.concluida && aula.url && (
                                  <a href={aula.url} target="_blank" rel="noreferrer">Reabrir conteúdo</a>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function abrirConteudo(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function tipoSessao(tipoAula: AulaCursoParceiro["tipo"]) {
  if (tipoAula === "video") return "videoaula" as const;
  if (tipoAula === "material" || tipoAula === "texto") return "leitura" as const;
  return "estudo" as const;
}

function tipo(valor: string) {
  return valor === "video"
    ? "Videoaula"
    : valor === "material"
      ? "Material"
      : valor === "link"
        ? "Link"
        : "Texto";
}

function mesmoTexto(a: string, b: string) {
  return normalizar(a) === normalizar(b);
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
