import { useState } from "react";
import {
  alterarStatusCursoParceiro,
  duplicarCursoParceiro,
  type CursoParceiro,
  type CursoStatusParceiro,
} from "../../services/cursoParceiroService";

export default function CursoFluxoPublicacao({
  curso,
  onAtualizado,
  onDuplicado,
}: {
  curso: CursoParceiro;
  onAtualizado: () => Promise<void>;
  onDuplicado: (cursoId: string) => Promise<void>;
}) {
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function mudarStatus(status: CursoStatusParceiro) {
    if (processando) return;
    if (status === "arquivado") {
      const confirmado = window.confirm(
        "Arquivar este curso?\n\nOs alunos deixarão de enxergá-lo, mas turmas, estrutura e todo o progresso já registrado serão preservados."
      );
      if (!confirmado) return;
    }
    if (status === "publicado") {
      const confirmado = window.confirm(
        "Publicar este curso para as turmas liberadas?\n\nA estrutura passa a ser usada pelos alunos. Exclusões destrutivas serão protegidas para não apagar progresso."
      );
      if (!confirmado) return;
    }

    try {
      setProcessando(`status-${status}`);
      setErro("");
      setMensagem("");
      await alterarStatusCursoParceiro(curso.id, status);
      setMensagem(status === "publicado" ? "Curso publicado." : status === "arquivado" ? "Curso arquivado sem perder progresso." : "Curso restaurado como rascunho.");
      await onAtualizado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar o status do curso.");
    } finally {
      setProcessando("");
    }
  }

  async function duplicar() {
    if (processando) return;
    const confirmado = window.confirm(
      `Duplicar “${curso.nome}”?\n\nA cópia terá toda a estrutura e os links, mas nascerá como rascunho, sem turmas e sem progresso de alunos.`
    );
    if (!confirmado) return;

    try {
      setProcessando("duplicar");
      setErro("");
      setMensagem("");
      const novoId = await duplicarCursoParceiro(curso.id);
      setMensagem("Cópia criada como rascunho.");
      await onDuplicado(novoId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível duplicar o curso.");
    } finally {
      setProcessando("");
    }
  }

  return (
    <section className="pc-fluxo-publicacao" aria-label="Fluxo de publicação do curso">
      <div className="pc-fluxo-linha">
        <div>
          <span className={`pc-status-curso status-${curso.status}`}>{rotuloStatus(curso.status)}</span>
          <small>{descricaoStatus(curso)}</small>
        </div>
        <div className="pc-fluxo-acoes">
          {curso.status === "rascunho" && (
            <button type="button" className="publicar" disabled={!!processando} onClick={() => void mudarStatus("publicado")}>
              {processando === "status-publicado" ? "Publicando..." : "Publicar curso"}
            </button>
          )}
          {curso.status === "publicado" && (
            <button type="button" className="arquivar" disabled={!!processando} onClick={() => void mudarStatus("arquivado")}>
              {processando === "status-arquivado" ? "Arquivando..." : "Arquivar curso"}
            </button>
          )}
          {curso.status === "arquivado" && (
            <button type="button" className="restaurar" disabled={!!processando} onClick={() => void mudarStatus("rascunho")}>
              {processando === "status-rascunho" ? "Restaurando..." : "Restaurar como rascunho"}
            </button>
          )}
          <button type="button" className="duplicar" disabled={!!processando} onClick={() => void duplicar()}>
            {processando === "duplicar" ? "Duplicando..." : "Duplicar curso"}
          </button>
        </div>
      </div>

      <div className={`pc-protecao-progresso ${curso.possuiProgresso ? "em-uso" : ""}`}>
        <strong>{curso.possuiProgresso ? "🔒 Progresso protegido" : "🛡️ Estrutura protegida"}</strong>
        <span>
          {curso.possuiProgresso
            ? "Este curso já possui atividade de alunos. Links e conteúdo podem ser atualizados, mas exclusões que apagariam progresso são bloqueadas no banco de dados."
            : curso.status === "publicado"
              ? "Enquanto estiver publicado, exclusões destrutivas ficam bloqueadas. Arquive o curso antes de uma reestruturação maior."
              : "A cópia e o rascunho podem ser revisados antes da publicação. Ao publicar, a proteção contra perda de progresso entra em ação."}
        </span>
      </div>

      {erro && <div className="pc-fluxo-erro" role="alert">{erro}</div>}
      {mensagem && <div className="pc-fluxo-sucesso" role="status">{mensagem}</div>}
    </section>
  );
}

function rotuloStatus(status: CursoStatusParceiro) {
  if (status === "publicado") return "PUBLICADO";
  if (status === "arquivado") return "ARQUIVADO";
  return "RASCUNHO";
}

function descricaoStatus(curso: CursoParceiro) {
  if (curso.status === "publicado") return "Visível para alunos das turmas liberadas.";
  if (curso.status === "arquivado") return "Oculto dos alunos; progresso e vínculos preservados.";
  return "Somente o parceiro vê; revise antes de publicar.";
}