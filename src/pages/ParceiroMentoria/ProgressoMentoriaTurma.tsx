import { useEffect, useMemo, useState } from "react";
import { listarAlunosDoParceiro, type AlunoParceiro } from "../../services/parceriasService";
import {
  cancelarReforcoMentoria,
  criarReforcoMentoria,
  listarProgressoMentoria,
  listarReforcosMentoria,
  type ProgressoMentoriaAluno,
  type ReforcoMentoria,
  type TrilhaMentoria,
} from "../../services/mentoriaService";

type Props = {
  parceiroId: string;
  turmaId: string;
  trilha: TrilhaMentoria | null;
};

export default function ProgressoMentoriaTurma({ parceiroId, turmaId, trilha }: Props) {
  const [alunos, setAlunos] = useState<AlunoParceiro[]>([]);
  const [progresso, setProgresso] = useState<ProgressoMentoriaAluno[]>([]);
  const [reforcos, setReforcos] = useState<ReforcoMentoria[]>([]);
  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(false);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function carregar() {
    if (!trilha) {
      setAlunos([]);
      setProgresso([]);
      setReforcos([]);
      return;
    }

    try {
      setCarregando(true);
      setErro("");
      const [todosAlunos, novoProgresso, novosReforcos] = await Promise.all([
        listarAlunosDoParceiro(),
        listarProgressoMentoria(trilha.id),
        listarReforcosMentoria(trilha.id),
      ]);

      setAlunos(
        todosAlunos.filter(
          (aluno) => aluno.turmaId === turmaId && aluno.status === "ativa"
        )
      );
      setProgresso(novoProgresso);
      setReforcos(novosReforcos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o progresso da turma.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, [trilha?.id, turmaId]);

  const progressoPorAluno = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    progresso.forEach((item) => {
      const atual = mapa.get(item.userId) ?? new Set<string>();
      atual.add(item.itemId);
      mapa.set(item.userId, atual);
    });
    return mapa;
  }, [progresso]);

  function proximoItem(userId: string) {
    const concluidos = progressoPorAluno.get(userId) ?? new Set<string>();
    return trilha?.itens.find((item) => !concluidos.has(item.id)) ?? null;
  }

  function reforcosPendentes(userId: string) {
    return reforcos.filter((item) => item.userId === userId && item.status === "pendente");
  }

  async function reforcar(aluno: AlunoParceiro) {
    if (!trilha) return;
    const itemId = selecoes[aluno.userId] || proximoItem(aluno.userId)?.id || trilha.itens[0]?.id;
    const item = trilha.itens.find((atual) => atual.id === itemId);
    if (!item) return;

    const duplicado = reforcosPendentes(aluno.userId).some(
      (reforco) => reforco.itemId === item.id
    );
    if (duplicado) {
      setErro(`${aluno.nome} já possui reforço pendente para ${item.assunto}.`);
      return;
    }

    try {
      setProcessando(aluno.userId);
      setErro("");
      setMensagem("");
      await criarReforcoMentoria({
        parceiroId,
        turmaId,
        trilhaId: trilha.id,
        userId: aluno.userId,
        item,
      });
      setMensagem(`Reforço de ${item.materia} — ${item.assunto} enviado para ${aluno.nome}.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o reforço.");
    } finally {
      setProcessando("");
    }
  }

  async function cancelar(id: string) {
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

  if (!trilha) return null;

  return (
    <section className="mentoria-progresso-card">
      <div className="mentoria-progresso-topo">
        <div>
          <span>ACOMPANHAMENTO INDIVIDUAL</span>
          <h2>Progresso dos alunos</h2>
          <p>
            O avanço vem dos conteúdos concluídos no próprio Study Pro. O próximo assunto
            é calculado individualmente, sem obrigar toda a turma a andar no mesmo ritmo.
          </p>
        </div>
        <strong>{alunos.length} aluno{alunos.length === 1 ? "" : "s"}</strong>
      </div>

      {erro && <div className="mentoria-alerta erro">{erro}</div>}
      {mensagem && <div className="mentoria-alerta sucesso">{mensagem}</div>}

      {carregando ? (
        <div className="mentoria-estado">Carregando progresso...</div>
      ) : alunos.length === 0 ? (
        <div className="mentoria-estado">Nenhum aluno ativo nesta turma.</div>
      ) : (
        <div className="mentoria-alunos-lista">
          {alunos.map((aluno) => {
            const concluidos = progressoPorAluno.get(aluno.userId) ?? new Set<string>();
            const proximo = proximoItem(aluno.userId);
            const pendentes = reforcosPendentes(aluno.userId);
            const percentual = trilha.itens.length
              ? Math.round((concluidos.size / trilha.itens.length) * 100)
              : 0;
            const valorSelecionado =
              selecoes[aluno.userId] || proximo?.id || trilha.itens[0]?.id || "";

            return (
              <article className="mentoria-aluno" key={aluno.userId}>
                <div className="mentoria-aluno-identidade">
                  <strong>{aluno.nome}</strong>
                  <small>{aluno.email || "E-mail não informado"}</small>
                </div>

                <div className="mentoria-aluno-progresso">
                  <div>
                    <strong>{concluidos.size}/{trilha.itens.length}</strong>
                    <span>{percentual}% concluído</span>
                  </div>
                  <div className="mentoria-barra">
                    <span style={{ width: `${Math.min(100, percentual)}%` }} />
                  </div>
                  <small>
                    {proximo
                      ? `Próximo: ${proximo.materia} — ${proximo.assunto}`
                      : "Trilha-base concluída"}
                  </small>
                </div>

                <div className="mentoria-reforco-controle">
                  <select
                    value={valorSelecionado}
                    onChange={(e) =>
                      setSelecoes((atual) => ({ ...atual, [aluno.userId]: e.target.value }))
                    }
                    aria-label={`Assunto para reforçar para ${aluno.nome}`}
                  >
                    {trilha.itens.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.materia} — {item.assunto}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void reforcar(aluno)}
                    disabled={processando === aluno.userId || !valorSelecionado}
                  >
                    {processando === aluno.userId ? "Enviando..." : "Reforçar assunto"}
                  </button>
                </div>

                <div className="mentoria-reforcos-pendentes">
                  {pendentes.length === 0 ? (
                    <small>Sem reforço pendente</small>
                  ) : (
                    pendentes.map((reforco) => (
                      <div key={reforco.id}>
                        <span>Reforço: {reforco.materia} — {reforco.assunto}</span>
                        <button
                          type="button"
                          onClick={() => void cancelar(reforco.id)}
                          disabled={processando === reforco.id}
                        >
                          Cancelar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
