import { useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  enviarFeedbackBeta,
  type CategoriaFeedbackBeta,
} from "../../services/betaService";

import "./BetaFeedback.css";

export default function BetaFeedback() {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaFeedbackBeta>("bug");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const usuarioId = usuario?.id;

  if (!usuarioId) return null;

  async function enviar() {
    try {
      setEnviando(true);
      await enviarFeedbackBeta(usuarioId, categoria, mensagem);
      setMensagem("");
      setCategoria("bug");
      setAberto(false);
      showToast("Feedback enviado. Obrigado por testar o Study Pro.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Não foi possível enviar o feedback.",
        "error"
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="beta-feedback-gatilho"
        onClick={() => setAberto(true)}
        aria-label="Enviar feedback do beta"
      >
        <span>β</span>
        Feedback
      </button>

      {aberto && (
        <div className="beta-feedback-overlay" role="presentation" onMouseDown={() => setAberto(false)}>
          <section
            className="beta-feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="beta-feedback-titulo"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>BETA</span>
                <h2 id="beta-feedback-titulo">Reportar problema</h2>
                <p>A página e o tamanho da tela são enviados automaticamente.</p>
              </div>
              <button type="button" className="beta-feedback-fechar" onClick={() => setAberto(false)} aria-label="Fechar">
                ×
              </button>
            </header>

            <label>
              Tipo
              <select value={categoria} onChange={(event) => setCategoria(event.target.value as CategoriaFeedbackBeta)}>
                <option value="bug">Bug / algo não funciona</option>
                <option value="visual">Visual / alinhamento</option>
                <option value="ideia">Sugestão</option>
                <option value="outro">Outro</option>
              </select>
            </label>

            <label>
              O que aconteceu?
              <textarea
                value={mensagem}
                onChange={(event) => setMensagem(event.target.value)}
                placeholder="Ex.: o botão ficou cortado no meu celular quando abri a tela de Revisões..."
                maxLength={2000}
                rows={6}
              />
            </label>

            <div className="beta-feedback-contador">{mensagem.length}/2000</div>

            <footer>
              <button type="button" className="beta-feedback-cancelar" onClick={() => setAberto(false)} disabled={enviando}>
                Cancelar
              </button>
              <button type="button" className="beta-feedback-enviar" onClick={() => void enviar()} disabled={enviando || mensagem.trim().length < 3}>
                {enviando ? "Enviando..." : "Enviar feedback"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
