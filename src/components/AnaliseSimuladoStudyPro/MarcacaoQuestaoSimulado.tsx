import type { MarcacaoQuestaoSimulado } from "../../utils/analiseSimuladoStudyPro";
import "./AnaliseSimuladoStudyPro.css";

export default function MarcacaoQuestaoSimulado({
  valor = "normal",
  disabled = false,
  onChange,
}: {
  valor?: MarcacaoQuestaoSimulado;
  disabled?: boolean;
  onChange: (valor: MarcacaoQuestaoSimulado) => void;
}) {
  function alternar(proximo: MarcacaoQuestaoSimulado) {
    if (disabled) return;
    onChange(valor === proximo ? "normal" : proximo);
  }

  return (
    <div className="simulado-marcacoes" aria-label="Como você respondeu esta questão?">
      <span>Marcar questão</span>
      <div>
        <button
          type="button"
          className={valor === "nao_sei" ? "ativo" : ""}
          aria-pressed={valor === "nao_sei"}
          disabled={disabled}
          onClick={() => alternar("nao_sei")}
        >
          Não sei
        </button>
        <button
          type="button"
          className={valor === "nao_estudado" ? "ativo" : ""}
          aria-pressed={valor === "nao_estudado"}
          disabled={disabled}
          onClick={() => alternar("nao_estudado")}
        >
          Não estudei ainda
        </button>
        <button
          type="button"
          className={valor === "chutei" ? "ativo" : ""}
          aria-pressed={valor === "chutei"}
          disabled={disabled}
          onClick={() => alternar("chutei")}
        >
          Chutei
        </button>
      </div>
      {valor === "nao_estudado" && (
        <small>
          Este conteúdo ficará separado do diagnóstico de domínio e continuará no cronograma normal.
        </small>
      )}
    </div>
  );
}
