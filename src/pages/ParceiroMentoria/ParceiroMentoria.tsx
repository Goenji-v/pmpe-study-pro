import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import { carregarGestaoParceiro, type TurmaParceiro } from "../../services/parceriasService";
import {
  listarTrilhasMentoriaDoParceiro,
  salvarTrilhaMentoria,
  type TrilhaMentoria,
} from "../../services/mentoriaService";
import ProgressoMentoriaTurma from "./ProgressoMentoriaTurma";
import "./ParceiroMentoria.css";

type ItemForm = {
  id?: string;
  materia: string;
  assunto: string;
};

type FormTrilha = {
  turmaId: string;
  nome: string;
  minutosPadrao: number;
  materiasPorDia: number;
  questoesPorSessao: number;
  revisoesPorDia: number;
  itens: ItemForm[];
};

const FORM_INICIAL: FormTrilha = {
  turmaId: "",
  nome: "Trilha principal",
  minutosPadrao: 60,
  materiasPorDia: 1,
  questoesPorSessao: 20,
  revisoesPorDia: 10,
  itens: [{ materia: "", assunto: "" }],
};

export default function ParceiroMentoria() {
  const { contexto, carregando: verificando } = useContextoComercial();
  const [turmas, setTurmas] = useState<TurmaParceiro[]>([]);
  const [trilhas, setTrilhas] = useState<TrilhaMentoria[]>([]);
  const [form, setForm] = useState<FormTrilha>(FORM_INICIAL);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const podeGerenciar =
    contexto?.papel === "proprietario" ||
    contexto?.papel === "gestor" ||
    contexto?.papel === "professor";

  const trilhaDaTurma = useMemo(
    () => trilhas.find((item) => item.turmaId === form.turmaId) ?? null,
    [trilhas, form.turmaId]
  );

  useEffect(() => {
    if (!podeGerenciar) {
      setCarregando(false);
      return;
    }
    void carregar();
  }, [podeGerenciar]);

  useEffect(() => {
    if (!form.turmaId) return;

    const existente = trilhas.find((item) => item.turmaId === form.turmaId);
    if (!existente) {
      setForm((anterior) => ({
        ...FORM_INICIAL,
        turmaId: anterior.turmaId,
        nome: anterior.nome || "Trilha principal",
      }));
      return;
    }

    setForm({
      turmaId: existente.turmaId,
      nome: existente.nome,
      minutosPadrao: existente.minutosPadrao,
      materiasPorDia: existente.materiasPorDia,
      questoesPorSessao: existente.questoesPorSessao,
      revisoesPorDia: existente.revisoesPorDia,
      itens: existente.itens.length
        ? existente.itens.map((item) => ({
            id: item.id,
            materia: item.materia,
            assunto: item.assunto,
          }))
        : [{ materia: "", assunto: "" }],
    });
  }, [form.turmaId, trilhas]);

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const [gestao, trilhasAtuais] = await Promise.all([
        carregarGestaoParceiro(),
        listarTrilhasMentoriaDoParceiro(),
      ]);
      setTurmas(gestao.turmas.filter((turma) => turma.ativa));
      setTrilhas(trilhasAtuais);
      setForm((anterior) => ({
        ...anterior,
        turmaId:
          anterior.turmaId || gestao.turmas.find((turma) => turma.ativa)?.id || "",
      }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a mentoria.");
    } finally {
      setCarregando(false);
    }
  }

  function atualizarItem(indice: number, campo: keyof ItemForm, valor: string) {
    setForm((anterior) => ({
      ...anterior,
      itens: anterior.itens.map((item, atual) =>
        atual === indice ? { ...item, [campo]: valor } : item
      ),
    }));
  }

  function adicionarItem() {
    setForm((anterior) => ({
      ...anterior,
      itens: [...anterior.itens, { materia: "", assunto: "" }],
    }));
  }

  function removerItem(indice: number) {
    setForm((anterior) => ({
      ...anterior,
      itens:
        anterior.itens.length === 1
          ? [{ materia: "", assunto: "" }]
          : anterior.itens.filter((_, atual) => atual !== indice),
    }));
  }

  function moverItem(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= form.itens.length) return;

    setForm((anterior) => {
      const itens = [...anterior.itens];
      [itens[indice], itens[destino]] = [itens[destino], itens[indice]];
      return { ...anterior, itens };
    });
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!contexto?.parceiroId) return;

    try {
      setSalvando(true);
      setErro("");
      setMensagem("");

      await salvarTrilhaMentoria({
        parceiroId: contexto.parceiroId,
        turmaId: form.turmaId,
        nome: form.nome,
        minutosPadrao: form.minutosPadrao,
        materiasPorDia: form.materiasPorDia,
        questoesPorSessao: form.questoesPorSessao,
        revisoesPorDia: form.revisoesPorDia,
        itens: form.itens,
      });

      setMensagem(
        "Trilha salva. O progresso individual foi preservado nos assuntos que continuam iguais."
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a trilha.");
    } finally {
      setSalvando(false);
    }
  }

  if (verificando) {
    return <div className="mentoria-estado">Verificando perfil do professor...</div>;
  }

  if (!podeGerenciar) return <Navigate to="/" replace />;

  return (
    <section className="mentoria-pagina">
      <header className="mentoria-cabecalho">
        <div>
          <span>MENTORIA</span>
          <h1>Trilha de estudos da turma</h1>
          <p>
            Você define o que precisa ser estudado e em qual ordem. Cada aluno avança
            individualmente conforme conclui os conteúdos no Study Pro.
          </p>
        </div>
        <Link to="/parceiro">Voltar à área do professor</Link>
      </header>

      {erro && <div className="mentoria-alerta erro">{erro}</div>}
      {mensagem && <div className="mentoria-alerta sucesso">{mensagem}</div>}

      {carregando ? (
        <div className="mentoria-estado">Carregando trilhas...</div>
      ) : turmas.length === 0 ? (
        <div className="mentoria-estado">
          Crie uma turma antes de configurar a trilha da mentoria.
        </div>
      ) : (
        <>
          <div className="mentoria-grid">
            <form className="mentoria-card" onSubmit={salvar}>
              <div className="mentoria-card-topo">
                <div>
                  <span>CONFIGURAÇÃO DA TURMA</span>
                  <h2>{trilhaDaTurma ? "Editar trilha" : "Nova trilha"}</h2>
                </div>
                <b>{trilhaDaTurma ? "Ativa" : "Nova"}</b>
              </div>

              <div className="mentoria-campos">
                <label>
                  Turma
                  <select
                    value={form.turmaId}
                    onChange={(e) =>
                      setForm((anterior) => ({ ...anterior, turmaId: e.target.value }))
                    }
                    required
                  >
                    {turmas.map((turma) => (
                      <option key={turma.id} value={turma.id}>{turma.nome}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Nome da trilha
                  <input
                    value={form.nome}
                    onChange={(e) =>
                      setForm((anterior) => ({ ...anterior, nome: e.target.value }))
                    }
                    placeholder="Ex.: Rota PMPE 2027"
                    required
                  />
                </label>

                <label>
                  Tempo de referência por dia
                  <input
                    type="number"
                    min={20}
                    max={600}
                    value={form.minutosPadrao}
                    onChange={(e) =>
                      setForm((anterior) => ({
                        ...anterior,
                        minutosPadrao: Number(e.target.value),
                      }))
                    }
                  />
                  <small>É uma referência. A disponibilidade real do aluno continua prevalecendo.</small>
                </label>

                <label>
                  Matérias principais por dia
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={form.materiasPorDia}
                    onChange={(e) =>
                      setForm((anterior) => ({
                        ...anterior,
                        materiasPorDia: Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label>
                  Questões por sessão
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.questoesPorSessao}
                    onChange={(e) =>
                      setForm((anterior) => ({
                        ...anterior,
                        questoesPorSessao: Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label>
                  Revisões por dia
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={form.revisoesPorDia}
                    onChange={(e) =>
                      setForm((anterior) => ({
                        ...anterior,
                        revisoesPorDia: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <div className="mentoria-assuntos-topo">
                <div>
                  <span>ORDEM DE ESTUDO</span>
                  <h3>Matérias e assuntos</h3>
                  <p>A ordem abaixo vira a trilha-base usada pelo cronograma automático.</p>
                </div>
                <button type="button" onClick={adicionarItem}>+ Adicionar assunto</button>
              </div>

              <div className="mentoria-itens">
                {form.itens.map((item, indice) => (
                  <div className="mentoria-item" key={item.id || `${indice}-${item.materia}-${item.assunto}`}>
                    <span className="mentoria-ordem">{indice + 1}</span>
                    <input
                      value={item.materia}
                      onChange={(e) => atualizarItem(indice, "materia", e.target.value)}
                      placeholder="Matéria — ex.: Português"
                      aria-label={`Matéria ${indice + 1}`}
                    />
                    <input
                      value={item.assunto}
                      onChange={(e) => atualizarItem(indice, "assunto", e.target.value)}
                      placeholder="Assunto — ex.: Morfologia"
                      aria-label={`Assunto ${indice + 1}`}
                    />
                    <div className="mentoria-item-acoes">
                      <button type="button" onClick={() => moverItem(indice, -1)} disabled={indice === 0} aria-label="Mover para cima">↑</button>
                      <button type="button" onClick={() => moverItem(indice, 1)} disabled={indice === form.itens.length - 1} aria-label="Mover para baixo">↓</button>
                      <button type="button" className="perigo" onClick={() => removerItem(indice)} aria-label="Remover assunto">×</button>
                    </div>
                  </div>
                ))}
              </div>

              <footer className="mentoria-rodape">
                <div>
                  <strong>{form.itens.filter((item) => item.materia.trim() && item.assunto.trim()).length} assuntos configurados</strong>
                  <small>Reordenar mantém o progresso. Alterar o conteúdo de um assunto cria uma nova etapa para os alunos.</small>
                </div>
                <button className="principal" disabled={salvando}>
                  {salvando ? "Salvando..." : trilhaDaTurma ? "Salvar alterações" : "Criar trilha"}
                </button>
              </footer>
            </form>

            <aside className="mentoria-resumo">
              <span>COMO FUNCIONA</span>
              <h2>Mentor define. Cada aluno avança.</h2>
              <div>
                <b>1</b>
                <p><strong>Você define o conteúdo.</strong> Matéria, assunto e ordem de estudo.</p>
              </div>
              <div>
                <b>2</b>
                <p><strong>O aluno conclui no Study Pro.</strong> O avanço é sincronizado automaticamente.</p>
              </div>
              <div>
                <b>3</b>
                <p><strong>O Cronograma IA segue em frente.</strong> Assuntos concluídos saem da fila e o próximo entra no plano.</p>
              </div>
              <div>
                <b>4</b>
                <p><strong>Você pode reforçar.</strong> Um assunto antigo volta ao cronograma somente daquele aluno.</p>
              </div>
            </aside>
          </div>

          <ProgressoMentoriaTurma
            parceiroId={contexto?.parceiroId || ""}
            turmaId={form.turmaId}
            trilha={trilhaDaTurma}
          />
        </>
      )}
    </section>
  );
}
