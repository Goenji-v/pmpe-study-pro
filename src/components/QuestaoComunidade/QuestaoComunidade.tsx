import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../context/ToastContext";
import {
  denunciarQuestao,
  excluirMeuComentarioQuestao,
  listarComentariosQuestao,
  questaoDisponivelParaComunidade,
  salvarMeuComentarioQuestao,
  type ComentarioQuestao,
  type MotivoDenunciaQuestao,
} from "../../services/questaoComunidadeService";
import "./QuestaoComunidade.css";

type Props = {
  questaoId: string;
  onDenunciada?: () => void;
  compacto?: boolean;
};

const motivos: Array<{ valor: MotivoDenunciaQuestao; rotulo: string }> = [
  { valor: "desatualizada", rotulo: "Questão desatualizada" },
  { valor: "gabarito_incorreto", rotulo: "Gabarito incorreto" },
  { valor: "multiplos_gabaritos", rotulo: "Mais de um gabarito possível" },
  { valor: "sem_coerencia", rotulo: "Questão sem coerência" },
  { valor: "repetida", rotulo: "Questão repetida" },
  { valor: "outro", rotulo: "Outro problema" },
];

export default function QuestaoComunidade({ questaoId, onDenunciada, compacto = false }: Props) {
  const { showToast } = useToast();
  const [disponivel, setDisponivel] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [aba, setAba] = useState<"comentarios" | "denuncia" | null>(null);
  const [comentarios, setComentarios] = useState<ComentarioQuestao[]>([]);
  const [comentario, setComentario] = useState("");
  const [motivo, setMotivo] = useState<MotivoDenunciaQuestao>("desatualizada");
  const [detalhes, setDetalhes] = useState("");
  const [carregandoComentarios, setCarregandoComentarios] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);

  useEffect(() => {
    let ativo = true;
    setVerificando(true);
    setAba(null);
    setComentarios([]);
    setComentario("");
    setDetalhes("");

    void questaoDisponivelParaComunidade(questaoId).then((valor) => {
      if (ativo) {
        setDisponivel(valor);
        setVerificando(false);
      }
    });

    return () => { ativo = false; };
  }, [questaoId]);

  const meuComentario = useMemo(
    () => comentarios.find((item) => item.meu),
    [comentarios]
  );

  async function carregarComentarios() {
    try {
      setCarregandoComentarios(true);
      const lista = await listarComentariosQuestao(questaoId);
      setComentarios(lista);
      const meu = lista.find((item) => item.meu);
      setComentario(meu?.conteudo ?? "");
    } catch (erro) {
      showToast(erro instanceof Error ? erro.message : "Não foi possível carregar os comentários.", "warning");
    } finally {
      setCarregandoComentarios(false);
    }
  }

  async function alternarComentarios() {
    const abrir = aba !== "comentarios";
    setAba(abrir ? "comentarios" : null);
    if (abrir) await carregarComentarios();
  }

  async function salvarComentario() {
    try {
      setSalvando(true);
      await salvarMeuComentarioQuestao(questaoId, comentario);
      await carregarComentarios();
      showToast(meuComentario ? "Comentário atualizado." : "Comentário publicado para a comunidade.", "success");
    } catch (erro) {
      showToast(erro instanceof Error ? erro.message : "Não foi possível salvar o comentário.", "warning");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirComentario() {
    if (!meuComentario || !window.confirm("Excluir seu comentário desta questão?")) return;
    try {
      setSalvando(true);
      await excluirMeuComentarioQuestao(meuComentario.id);
      setComentario("");
      await carregarComentarios();
      showToast("Comentário excluído.", "info");
    } catch (erro) {
      showToast(erro instanceof Error ? erro.message : "Não foi possível excluir o comentário.", "warning");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarDenuncia() {
    const confirmar = window.confirm(
      "Ao denunciar, esta questão será retirada imediatamente dos próximos treinos até a análise do administrador. Deseja continuar?"
    );
    if (!confirmar) return;

    try {
      setEnviandoDenuncia(true);
      await denunciarQuestao(questaoId, motivo, detalhes);
      setDisponivel(false);
      setAba(null);
      showToast("Denúncia enviada. A questão entrou em quarentena e o administrador foi avisado.", "success");
      onDenunciada?.();
    } catch (erro) {
      showToast(erro instanceof Error ? erro.message : "Não foi possível enviar a denúncia.", "warning");
    } finally {
      setEnviandoDenuncia(false);
    }
  }

  if (verificando || !disponivel) return null;

  return (
    <section className={`questao-comunidade ${compacto ? "compacto" : ""}`} aria-label="Comunidade da questão">
      <div className="questao-comunidade-acoes">
        <button type="button" onClick={() => void alternarComentarios()} aria-expanded={aba === "comentarios"}>
          💬 Comentários
        </button>
        <button
          type="button"
          className="questao-comunidade-denunciar"
          onClick={() => setAba((atual) => atual === "denuncia" ? null : "denuncia")}
          aria-expanded={aba === "denuncia"}
        >
          ⚑ Denunciar questão
        </button>
      </div>

      {aba === "comentarios" && (
        <div className="questao-comunidade-painel">
          <div className="questao-comunidade-titulo">
            <div>
              <strong>Comentários da comunidade</strong>
              <span>Visíveis para outros alunos que estudarem esta questão.</span>
            </div>
            <b>{comentarios.length}</b>
          </div>

          {carregandoComentarios ? (
            <p>Carregando comentários...</p>
          ) : comentarios.length === 0 ? (
            <p className="questao-comunidade-vazio">Ainda não há comentários. Você pode ser o primeiro.</p>
          ) : (
            <div className="questao-comunidade-lista">
              {comentarios.map((item) => (
                <article key={item.id} className={item.meu ? "meu" : ""}>
                  <header>
                    <strong>{item.autorNome}{item.meu ? " · você" : ""}</strong>
                    <time>{formatarData(item.atualizadoEm)}</time>
                  </header>
                  <p>{item.conteudo}</p>
                </article>
              ))}
            </div>
          )}

          <label className="questao-comunidade-editor">
            {meuComentario ? "Editar meu comentário" : "Adicionar comentário"}
            <textarea
              value={comentario}
              onChange={(evento) => setComentario(evento.target.value)}
              maxLength={2000}
              placeholder="Explique uma regra, deixe um bizu ou complemente a resolução."
            />
            <small>{comentario.length}/2000</small>
          </label>
          <div className="questao-comunidade-editor-acoes">
            {meuComentario && (
              <button type="button" className="perigo" onClick={() => void excluirComentario()} disabled={salvando}>
                Excluir meu comentário
              </button>
            )}
            <button type="button" className="primario" onClick={() => void salvarComentario()} disabled={salvando || comentario.trim().length < 3}>
              {salvando ? "Salvando..." : meuComentario ? "Atualizar comentário" : "Publicar comentário"}
            </button>
          </div>
        </div>
      )}

      {aba === "denuncia" && (
        <div className="questao-comunidade-painel denuncia">
          <div className="questao-comunidade-titulo">
            <div>
              <strong>Denunciar problema</strong>
              <span>A questão sai de circulação imediatamente e vai para a fila do administrador.</span>
            </div>
          </div>

          <label>
            Motivo
            <select value={motivo} onChange={(evento) => setMotivo(evento.target.value as MotivoDenunciaQuestao)}>
              {motivos.map((item) => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
            </select>
          </label>
          <label>
            Detalhes opcionais
            <textarea
              value={detalhes}
              onChange={(evento) => setDetalhes(evento.target.value)}
              maxLength={1200}
              placeholder="Ex.: a lei mudou, há duas alternativas corretas, o comentário contradiz o gabarito..."
            />
            <small>{detalhes.length}/1200</small>
          </label>
          <button type="button" className="questao-comunidade-enviar-denuncia" onClick={() => void enviarDenuncia()} disabled={enviandoDenuncia}>
            {enviandoDenuncia ? "Enviando..." : "Enviar denúncia e retirar para análise"}
          </button>
        </div>
      )}
    </section>
  );
}

function formatarData(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? ""
    : data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
