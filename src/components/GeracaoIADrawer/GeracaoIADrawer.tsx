import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./GeracaoIADrawer.css";

import {
  calcularProgressoAtividadeGeracaoIA,
  carregarAtividadeGeracaoIA,
  EVENTO_ATIVIDADE_GERACAO_IA,
  salvarAtividadeGeracaoIA,
  type AtividadeGeracaoIA,
} from "../../services/geracaoIAAtividadeService";

export default function GeracaoIADrawer() {
  const navigate = useNavigate();
  const [atividade, setAtividade] = useState<AtividadeGeracaoIA | null>(
    carregarAtividadeGeracaoIA
  );
  const [aberto, setAberto] = useState(false);
  const ultimoId = useRef<string | null>(atividade?.id ?? null);

  useEffect(() => {
    const atualizar = () => {
      const proxima = carregarAtividadeGeracaoIA();
      setAtividade(proxima);

      if (proxima && proxima.id !== ultimoId.current) {
        setAberto(true);
      }

      ultimoId.current = proxima?.id ?? null;
    };

    window.addEventListener(EVENTO_ATIVIDADE_GERACAO_IA, atualizar);
    window.addEventListener("storage", atualizar);

    return () => {
      window.removeEventListener(EVENTO_ATIVIDADE_GERACAO_IA, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  const progresso = useMemo(
    () =>
      atividade
        ? calcularProgressoAtividadeGeracaoIA(atividade)
        : 0,
    [atividade]
  );

  if (!atividade) return null;

  const ativa =
    atividade.etapa !== "concluida" &&
    atividade.etapa !== "erro";
  const rotulo = obterRotuloEtapa(atividade);
  const icone =
    atividade.etapa === "concluida"
      ? "✓"
      : atividade.etapa === "erro"
        ? "!"
        : "✦";

  function abrirResultado() {
    if (!atividade) return;
    setAberto(false);
    navigate("/resolver-simulado-ia");
  }

  function voltarGerador() {
    setAberto(false);
    navigate("/gerar-simulado-ia");
  }

  function dispensar() {
    salvarAtividadeGeracaoIA(null);
    setAtividade(null);
    setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        className={`geracao-ia-dock ${ativa ? "ativa" : atividade.etapa}`}
        onClick={() => setAberto(true)}
        aria-label="Abrir Central de Gerações"
      >
        <span className="geracao-ia-dock-icone" aria-hidden="true">
          {icone}
        </span>
        <span className="geracao-ia-dock-texto">
          <strong>
            {ativa ? "1 geração em andamento" : rotulo}
          </strong>
          <small>{atividade.titulo}</small>
        </span>
        {ativa && <span className="geracao-ia-dock-progresso">{progresso}%</span>}
      </button>

      {aberto && (
        <div
          className="geracao-ia-overlay"
          onClick={() => setAberto(false)}
          role="presentation"
        >
          <aside
            className="geracao-ia-painel"
            role="dialog"
            aria-modal="false"
            aria-label="Central de Gerações"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="geracao-ia-painel-topo">
              <div>
                <span className="geracao-ia-sobretitulo">
                  Central de Gerações
                </span>
                <h2>{ativa ? "Em geração" : rotulo}</h2>
              </div>
              <button
                type="button"
                className="geracao-ia-fechar"
                onClick={() => setAberto(false)}
                aria-label="Minimizar Central de Gerações"
              >
                —
              </button>
            </div>

            {ativa && (
              <p className="geracao-ia-explicacao">
                Você pode continuar usando o Study Pro. A geração permanece
                acompanhável por esta central.
              </p>
            )}

            <article className={`geracao-ia-card-global ${atividade.etapa}`}>
              <div className="geracao-ia-card-linha">
                <span className="geracao-ia-card-icone" aria-hidden="true">
                  {icone}
                </span>
                <div className="geracao-ia-card-conteudo">
                  <div className="geracao-ia-card-titulo">
                    <strong>{atividade.titulo}</strong>
                    <span>{rotulo}</span>
                  </div>
                  <p>
                    {atividade.quantidade} questão
                    {atividade.quantidade === 1 ? "" : "ões"} ·{" "}
                    {atividade.descricao}
                  </p>
                </div>
              </div>

              {ativa && (
                <>
                  <div className="geracao-ia-etapa-atual">
                    <span>{obterTextoEtapa(atividade)}</span>
                    <strong>{progresso}%</strong>
                  </div>
                  <div
                    className="geracao-ia-barra"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progresso}
                  >
                    <span style={{ width: `${progresso}%` }} />
                  </div>
                  <div className="geracao-ia-passos" aria-label="Etapas da geração">
                    <span className={passoAtivo(atividade, "gerando") ? "ativo" : ""}>
                      Gerar
                    </span>
                    <span className={passoAtivo(atividade, "revisando") ? "ativo" : ""}>
                      Revisar
                    </span>
                    <span className={passoAtivo(atividade, "salvando") ? "ativo" : ""}>
                      Salvar
                    </span>
                  </div>
                </>
              )}

              {atividade.etapa === "erro" && atividade.erro && (
                <p className="geracao-ia-erro-texto">{atividade.erro}</p>
              )}

              <div className="geracao-ia-painel-acoes">
                {atividade.etapa === "concluida" && (
                  <button type="button" className="primario" onClick={abrirResultado}>
                    Resolver agora
                  </button>
                )}
                {atividade.etapa === "erro" && (
                  <button type="button" className="primario" onClick={voltarGerador}>
                    Voltar para geração
                  </button>
                )}
                {!ativa && (
                  <button type="button" className="secundario" onClick={dispensar}>
                    Fechar
                  </button>
                )}
                {ativa && (
                  <button
                    type="button"
                    className="secundario"
                    onClick={() => setAberto(false)}
                  >
                    Continuar navegando
                  </button>
                )}
              </div>
            </article>
          </aside>
        </div>
      )}
    </>
  );
}

function obterRotuloEtapa(atividade: AtividadeGeracaoIA) {
  switch (atividade.etapa) {
    case "preparando":
      return "Preparando";
    case "gerando":
      return "Gerando";
    case "revisando":
      return "Revisando qualidade";
    case "corrigindo":
      return "Corrigindo revisão";
    case "salvando":
      return "Finalizando";
    case "concluida":
      return "Geração concluída";
    case "erro":
      return "A geração precisa de atenção";
  }
}

function obterTextoEtapa(atividade: AtividadeGeracaoIA) {
  const bloco =
    atividade.blocosTotal > 1
      ? ` · bloco ${atividade.blocoAtual}/${atividade.blocosTotal}`
      : "";

  switch (atividade.etapa) {
    case "preparando":
      return "Preparando o pedido";
    case "gerando":
      return `A IA está criando as questões${bloco}`;
    case "revisando":
      return `Revisão independente de qualidade${bloco}`;
    case "corrigindo":
      return `Corrigindo uma revisão rejeitada${bloco}`;
    case "salvando":
      return "Organizando e salvando o caderno";
    default:
      return obterRotuloEtapa(atividade);
  }
}

function passoAtivo(
  atividade: AtividadeGeracaoIA,
  passo: "gerando" | "revisando" | "salvando"
) {
  const ordem = {
    preparando: 0,
    gerando: 1,
    revisando: 2,
    corrigindo: 2,
    salvando: 3,
    concluida: 4,
    erro: 0,
  } as const;

  const minimo = passo === "gerando" ? 1 : passo === "revisando" ? 2 : 3;
  return ordem[atividade.etapa] >= minimo;
}
