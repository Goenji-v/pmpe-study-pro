import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  atualizarTurmaMeuParceiro,
  criarTurmaMeuParceiro,
  duplicarTurmaMeuParceiro,
  listarTurmasMeuParceiro,
  type EntradaTurmaParceiro,
  type TurmaGestaoParceiro,
} from "../../services/turmasParceiroService";

type Props = {
  onChanged?: () => Promise<void> | void;
};

type FormTurma = EntradaTurmaParceiro & {
  id: string;
};

const FORM_VAZIO: FormTurma = {
  id: "",
  nome: "",
  codigo: "",
  iniciaEm: "",
  encerraEm: "",
};

export default function GerenciarTurmasParceiro({ onChanged }: Props) {
  const [turmas, setTurmas] = useState<TurmaGestaoParceiro[]>([]);
  const [form, setForm] = useState<FormTurma>(FORM_VAZIO);
  const [editorAberto, setEditorAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      setTurmas(await listarTurmasMeuParceiro());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as turmas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function novaTurma() {
    setForm(FORM_VAZIO);
    setErro("");
    setMensagem("");
    setEditorAberto(true);
  }

  function editarTurma(turma: TurmaGestaoParceiro) {
    setForm({
      id: turma.id,
      nome: turma.nome,
      codigo: turma.codigo || "",
      iniciaEm: turma.iniciaEm || "",
      encerraEm: turma.encerraEm || "",
    });
    setErro("");
    setMensagem("");
    setEditorAberto(true);
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const chave = form.id ? `editar-${form.id}` : "criar";

    try {
      setProcessando(chave);
      setErro("");
      setMensagem("");

      if (form.id) {
        const turmaAtual = turmas.find((turma) => turma.id === form.id);
        if (!turmaAtual) throw new Error("Turma não encontrada.");
        await atualizarTurmaMeuParceiro(form.id, form, turmaAtual.ativa);
        setMensagem("Turma atualizada.");
      } else {
        await criarTurmaMeuParceiro(form);
        setMensagem("Turma criada. Agora você já pode liberar curso, cronograma e convites para ela.");
      }

      setEditorAberto(false);
      setForm(FORM_VAZIO);
      await carregar();
      await onChanged?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a turma.");
    } finally {
      setProcessando("");
    }
  }

  async function alternarArquivo(turma: TurmaGestaoParceiro) {
    const acao = turma.ativa ? "arquivar" : "reativar";
    const aviso = turma.ativa
      ? `Arquivar “${turma.nome}”?\n\nA turma deixa de aparecer nas seleções novas, mas os alunos e o histórico não são apagados.`
      : `Reativar “${turma.nome}”?`;
    if (!window.confirm(aviso)) return;

    try {
      setProcessando(`${acao}-${turma.id}`);
      setErro("");
      setMensagem("");
      await atualizarTurmaMeuParceiro(
        turma.id,
        {
          nome: turma.nome,
          codigo: turma.codigo || "",
          iniciaEm: turma.iniciaEm || "",
          encerraEm: turma.encerraEm || "",
        },
        !turma.ativa,
      );
      setMensagem(turma.ativa ? "Turma arquivada sem apagar o histórico." : "Turma reativada.");
      await carregar();
      await onChanged?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : `Não foi possível ${acao} a turma.`);
    } finally {
      setProcessando("");
    }
  }

  async function duplicar(turma: TurmaGestaoParceiro) {
    const nome = window.prompt(
      "Nome da nova turma",
      `${turma.nome} — cópia`,
    );
    if (nome === null || !nome.trim()) return;

    try {
      setProcessando(`duplicar-${turma.id}`);
      setErro("");
      setMensagem("");
      await duplicarTurmaMeuParceiro(turma.id, nome);
      setMensagem(
        "Turma duplicada. O cronograma e os cursos liberados foram copiados; alunos, convites e progresso individual não foram copiados.",
      );
      await carregar();
      await onChanged?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível duplicar a turma.");
    } finally {
      setProcessando("");
    }
  }

  return (
    <section className="parceiro-turmas-gestao">
      <div className="parceiro-turmas-topo">
        <div>
          <span>GESTÃO DAS TURMAS</span>
          <h2>Organize suas turmas</h2>
          <p>Crie, edite, arquive ou duplique turmas sem depender do administrador do Study Pro.</p>
        </div>
        <button type="button" onClick={novaTurma}>+ Nova turma</button>
      </div>

      {erro && <div className="parceiro-turmas-aviso erro" role="alert">{erro}</div>}
      {mensagem && <div className="parceiro-turmas-aviso sucesso" role="status">{mensagem}</div>}

      {editorAberto && (
        <form className="parceiro-turmas-form" onSubmit={salvar}>
          <div className="parceiro-turmas-form-topo">
            <div>
              <strong>{form.id ? "Editar turma" : "Nova turma"}</strong>
              <small>O código é opcional e deve ser único dentro da parceria.</small>
            </div>
            <button type="button" className="secundario" onClick={() => setEditorAberto(false)}>Fechar</button>
          </div>

          <div className="parceiro-turmas-campos">
            <label>
              Nome da turma
              <input
                required
                minLength={2}
                maxLength={160}
                value={form.nome}
                onChange={(e) => setForm((atual) => ({ ...atual, nome: e.target.value }))}
                placeholder="Ex.: PMPE 2027 · Turma A"
              />
            </label>
            <label>
              Código interno
              <input
                maxLength={80}
                value={form.codigo || ""}
                onChange={(e) => setForm((atual) => ({ ...atual, codigo: e.target.value }))}
                placeholder="Ex.: PMPE-A"
              />
            </label>
            <label>
              Início
              <input
                type="date"
                value={form.iniciaEm || ""}
                onChange={(e) => setForm((atual) => ({ ...atual, iniciaEm: e.target.value }))}
              />
            </label>
            <label>
              Encerramento
              <input
                type="date"
                value={form.encerraEm || ""}
                onChange={(e) => setForm((atual) => ({ ...atual, encerraEm: e.target.value }))}
              />
            </label>
          </div>

          <footer>
            <small>Arquivar uma turma não apaga alunos, dados ou histórico.</small>
            <button disabled={!!processando}>
              {processando ? "Salvando..." : form.id ? "Salvar alterações" : "Criar turma"}
            </button>
          </footer>
        </form>
      )}

      {carregando ? (
        <div className="parceiro-turmas-vazio">Carregando turmas...</div>
      ) : turmas.length === 0 ? (
        <div className="parceiro-turmas-vazio">Nenhuma turma cadastrada. Crie a primeira turma para começar.</div>
      ) : (
        <div className="parceiro-turmas-grade">
          {turmas.map((turma) => (
            <article key={turma.id} className={!turma.ativa ? "arquivada" : ""}>
              <header>
                <div>
                  <b className={turma.ativa ? "ativa" : "arquivada"}>{turma.ativa ? "Ativa" : "Arquivada"}</b>
                  <h3>{turma.nome}</h3>
                </div>
                <strong>{turma.alunosAtivos} aluno{turma.alunosAtivos === 1 ? "" : "s"}</strong>
              </header>

              <dl>
                <div><dt>Código</dt><dd>{turma.codigo || "—"}</dd></div>
                <div><dt>Início</dt><dd>{formatarData(turma.iniciaEm)}</dd></div>
                <div><dt>Encerramento</dt><dd>{formatarData(turma.encerraEm)}</dd></div>
              </dl>

              <footer>
                <button type="button" disabled={!!processando} onClick={() => editarTurma(turma)}>Editar</button>
                <button type="button" disabled={!!processando} onClick={() => void duplicar(turma)}>Duplicar</button>
                <button
                  type="button"
                  className={turma.ativa ? "perigo" : "reativar"}
                  disabled={!!processando}
                  onClick={() => void alternarArquivo(turma)}
                >
                  {turma.ativa ? "Arquivar" : "Reativar"}
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      <p className="parceiro-turmas-regra">
        Ao duplicar, o Study Pro copia a trilha de estudos e as liberações de cursos da turma original. Alunos, convites, resultados e progresso individual continuam exclusivos da turma de origem.
      </p>
    </section>
  );
}

function formatarData(valor: string | null) {
  if (!valor) return "Sem data";
  const [ano, mes, dia] = valor.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
}
