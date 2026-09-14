import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  carregarPainelCursosParceiro,
  type CursoParceiro,
} from "../../services/cursoParceiroService";
import "./ProgressoCursosAluno.css";

type LinhaProgresso = {
  aula_id: string;
  concluida: boolean;
  concluida_em: string | null;
  ultimo_acesso_em: string | null;
};

type AulaDetalhe = {
  id: string;
  titulo: string;
  disciplina: string;
  modulo: string;
  concluida: boolean;
  concluidaEm: string | null;
};

type DisciplinaDetalhe = {
  id: string;
  titulo: string;
  concluidas: number;
  total: number;
};

type CursoDetalhe = {
  id: string;
  nome: string;
  concluidas: number;
  total: number;
  percentual: number;
  ultimaConclusao: string | null;
  proximaAula: AulaDetalhe | null;
  concluidasRecentes: AulaDetalhe[];
  disciplinas: DisciplinaDetalhe[];
};

type Props = {
  userId: string;
  turmaId: string | null;
};

export default function ProgressoCursosAluno({ userId, turmaId }: Props) {
  const [cursos, setCursos] = useState<CursoDetalhe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!userId) return;
    try {
      setCarregando(true);
      setErro("");
      const painel = await carregarPainelCursosParceiro();
      const cursosDoAluno = painel.cursos.filter((curso) => {
        if (!curso.ativo) return false;
        if (turmaId && curso.turmaIds.includes(turmaId)) return true;
        return curso.progresso.some((item) => item.userId === userId);
      });

      if (cursosDoAluno.length === 0) {
        setCursos([]);
        return;
      }

      const { data, error } = await supabase
        .from("curso_parceiro_progresso")
        .select("aula_id, concluida, concluida_em, ultimo_acesso_em")
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Não foi possível carregar o progresso do curso: ${error.message}`);
      }

      const progresso = new Map(
        ((data ?? []) as LinhaProgresso[]).map((linha) => [linha.aula_id, linha])
      );

      setCursos(cursosDoAluno.map((curso) => montarCurso(curso, progresso)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o progresso dos cursos.");
    } finally {
      setCarregando(false);
    }
  }, [turmaId, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <section className="mentoria-aluno-card curso-aluno-bloco">
      <div className="mentoria-aluno-card-topo compacto">
        <div>
          <span>PROGRESSO NO CURSO</span>
          <h2>Aulas do parceiro</h2>
          <p>Mostra em tempo real as aulas concluídas pelo aluno no curso liberado para a turma.</p>
        </div>
        {!carregando && cursos.length > 0 && (
          <button type="button" className="curso-aluno-atualizar" onClick={() => void carregar()}>
            Atualizar
          </button>
        )}
      </div>

      {carregando ? (
        <p className="mentoria-aluno-vazio">Carregando progresso dos cursos...</p>
      ) : erro ? (
        <div className="curso-aluno-erro" role="alert">{erro}</div>
      ) : cursos.length === 0 ? (
        <p className="mentoria-aluno-vazio">Nenhum curso ativo está liberado para este aluno.</p>
      ) : (
        <div className="curso-aluno-lista">
          {cursos.map((curso) => (
            <article className="curso-aluno-item" key={curso.id}>
              <header>
                <div>
                  <strong>{curso.nome}</strong>
                  <small>{curso.concluidas} de {curso.total} aulas concluídas</small>
                </div>
                <b>{curso.percentual}%</b>
              </header>

              <div className="curso-aluno-barra" aria-label={`${curso.percentual}% concluído`}>
                <span style={{ width: `${Math.min(100, curso.percentual)}%` }} />
              </div>

              <div className="curso-aluno-resumo">
                <div>
                  <span>Concluídas</span>
                  <strong>{curso.concluidas}/{curso.total}</strong>
                </div>
                <div>
                  <span>Última conclusão</span>
                  <strong>{curso.ultimaConclusao ? formatarData(curso.ultimaConclusao) : "—"}</strong>
                </div>
                <div>
                  <span>Próximo conteúdo</span>
                  <strong>{curso.proximaAula?.titulo || "Curso concluído"}</strong>
                </div>
              </div>

              <div className="curso-aluno-disciplinas">
                {curso.disciplinas.map((disciplina) => (
                  <div key={disciplina.id}>
                    <span>{disciplina.titulo}</span>
                    <strong>{disciplina.concluidas}/{disciplina.total}</strong>
                  </div>
                ))}
              </div>

              {curso.concluidasRecentes.length > 0 && (
                <div className="curso-aluno-recentes">
                  <h3>Últimos conteúdos concluídos</h3>
                  {curso.concluidasRecentes.map((aula) => (
                    <div key={aula.id}>
                      <span className="curso-aluno-check">✓</span>
                      <div>
                        <strong>{aula.titulo}</strong>
                        <small>{aula.disciplina} · {aula.modulo}{aula.concluidaEm ? ` · ${formatarData(aula.concluidaEm)}` : ""}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function montarCurso(curso: CursoParceiro, progresso: Map<string, LinhaProgresso>): CursoDetalhe {
  const aulas: AulaDetalhe[] = [];
  const disciplinas: DisciplinaDetalhe[] = [];

  const disciplinasAtivas = curso.disciplinas
    .filter((disciplina) => disciplina.ativo)
    .sort((a, b) => a.ordem - b.ordem);

  for (const disciplina of disciplinasAtivas) {
    let totalDisciplina = 0;
    let concluidasDisciplina = 0;
    const modulos = disciplina.modulos
      .filter((modulo) => modulo.ativo)
      .sort((a, b) => a.ordem - b.ordem);

    for (const modulo of modulos) {
      const aulasAtivas = modulo.aulas
        .filter((aula) => aula.ativo)
        .sort((a, b) => a.ordem - b.ordem);

      for (const aula of aulasAtivas) {
        const linha = progresso.get(aula.id);
        const concluida = linha?.concluida === true;
        totalDisciplina += 1;
        if (concluida) concluidasDisciplina += 1;
        aulas.push({
          id: aula.id,
          titulo: aula.titulo,
          disciplina: disciplina.titulo,
          modulo: modulo.titulo,
          concluida,
          concluidaEm: concluida ? linha?.concluida_em ?? null : null,
        });
      }
    }

    if (totalDisciplina > 0) {
      disciplinas.push({
        id: disciplina.id,
        titulo: disciplina.titulo,
        concluidas: concluidasDisciplina,
        total: totalDisciplina,
      });
    }
  }

  const concluidas = aulas.filter((aula) => aula.concluida);
  const concluidasRecentes = [...concluidas]
    .sort((a, b) => tempo(b.concluidaEm) - tempo(a.concluidaEm))
    .slice(0, 5);
  const total = aulas.length;

  return {
    id: curso.id,
    nome: curso.nome,
    concluidas: concluidas.length,
    total,
    percentual: total ? Math.round((concluidas.length / total) * 100) : 0,
    ultimaConclusao: concluidasRecentes[0]?.concluidaEm ?? null,
    proximaAula: aulas.find((aula) => !aula.concluida) ?? null,
    concluidasRecentes,
    disciplinas,
  };
}

function tempo(valor: string | null) {
  if (!valor) return 0;
  const data = new Date(valor).getTime();
  return Number.isFinite(data) ? data : 0;
}

function formatarData(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}
