import { useState } from "react";

import "./Configuracoes.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";

import type {
  ConfiguracoesApp,
  Tema,
} from "../../types/index";

export default function Configuracoes() {
  const {
    configuracoes,
    setConfiguracoes,
  } = useApp();

  const { showToast } = useToast();

  const [formulario, setFormulario] =
    useState<ConfiguracoesApp>({
      ...configuracoes,
    });

  function atualizarCampo<K extends keyof ConfiguracoesApp>(
    campo: K,
    valor: ConfiguracoesApp[K]
  ) {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function salvarConfiguracoes() {
    const nomeLimpo =
      formulario.nomeUsuario.trim();

    const concursoLimpo =
      formulario.concurso.trim();

    if (!nomeLimpo) {
      showToast(
        "Informe o nome do usuário.",
        "warning"
      );
      return;
    }

    if (!concursoLimpo) {
      showToast(
        "Informe o concurso.",
        "warning"
      );
      return;
    }

    if (
      formulario.metaQuestoesDiaria < 0 ||
      formulario.metaMinutosDiaria < 0 ||
      formulario.metaRevisoesDiaria < 0
    ) {
      showToast(
        "As metas não podem ser negativas.",
        "error"
      );
      return;
    }

    const dadosAtualizados: ConfiguracoesApp = {
      ...formulario,
      nomeUsuario: nomeLimpo,
      concurso: concursoLimpo,
    };

    setConfiguracoes(dadosAtualizados);

    showToast(
      "Configurações salvas com sucesso.",
      "success"
    );
  }

  function restaurarPadrao() {
    const confirmar = window.confirm(
      "Deseja restaurar as configurações padrão?"
    );

    if (!confirmar) return;

    const padrao: ConfiguracoesApp = {
      nomeUsuario: "Leandro",
      concurso: "PMPE",
      bancaPadrao: "AOCP",
      metaQuestoesDiaria: 100,
      metaMinutosDiaria: 120,
      metaRevisoesDiaria: 5,
      tema: "escuro",
    };

    setFormulario(padrao);
    setConfiguracoes(padrao);

    showToast(
      "Configurações padrão restauradas.",
      "info"
    );
  }

  return (
    <section className="configuracoes-container">
      <h1 className="configuracoes-title">
        ⚙ Configurações
      </h1>

      <p className="configuracoes-subtitle">
        Personalize o aplicativo e defina suas
        metas de estudo.
      </p>

      <div className="configuracoes-grid">
        <div className="configuracoes-card">
          <h2>Perfil</h2>

          <div className="configuracoes-form-group">
            <label htmlFor="nomeUsuario">
              Nome do usuário
            </label>

            <input
              id="nomeUsuario"
              value={formulario.nomeUsuario}
              onChange={(evento) =>
                atualizarCampo(
                  "nomeUsuario",
                  evento.target.value
                )
              }
            />
          </div>

          <div className="configuracoes-form-group">
            <label htmlFor="concurso">
              Concurso
            </label>

            <input
              id="concurso"
              value={formulario.concurso}
              onChange={(evento) =>
                atualizarCampo(
                  "concurso",
                  evento.target.value
                )
              }
              placeholder="Exemplo: PMPE"
            />
          </div>

          <div className="configuracoes-form-group">
            <label htmlFor="bancaPadrao">
              Banca padrão
            </label>

            <select
              id="bancaPadrao"
              value={formulario.bancaPadrao}
              onChange={(evento) =>
                atualizarCampo(
                  "bancaPadrao",
                  evento.target.value
                )
              }
            >
              <option value="AOCP">AOCP</option>
              <option value="CEBRASPE">
                CEBRASPE
              </option>
              <option value="FGV">FGV</option>
              <option value="FCC">FCC</option>
              <option value="VUNESP">
                VUNESP
              </option>
              <option value="IBFC">IBFC</option>
              <option value="IDECAN">
                IDECAN
              </option>
              <option value="Outra">
                Outra
              </option>
            </select>
          </div>
        </div>

        <div className="configuracoes-card">
          <h2>Metas diárias</h2>

          <div className="configuracoes-form-group">
            <label htmlFor="metaQuestoes">
              Questões por dia
            </label>

            <input
              id="metaQuestoes"
              type="number"
              min={0}
              value={
                formulario.metaQuestoesDiaria
              }
              onChange={(evento) =>
                atualizarCampo(
                  "metaQuestoesDiaria",
                  Math.max(
                    0,
                    Number(evento.target.value)
                  )
                )
              }
            />
          </div>

          <div className="configuracoes-form-group">
            <label htmlFor="metaMinutos">
              Minutos de estudo por dia
            </label>

            <input
              id="metaMinutos"
              type="number"
              min={0}
              value={
                formulario.metaMinutosDiaria
              }
              onChange={(evento) =>
                atualizarCampo(
                  "metaMinutosDiaria",
                  Math.max(
                    0,
                    Number(evento.target.value)
                  )
                )
              }
            />
          </div>

          <div className="configuracoes-form-group">
            <label htmlFor="metaRevisoes">
              Revisões por dia
            </label>

            <input
              id="metaRevisoes"
              type="number"
              min={0}
              value={
                formulario.metaRevisoesDiaria
              }
              onChange={(evento) =>
                atualizarCampo(
                  "metaRevisoesDiaria",
                  Math.max(
                    0,
                    Number(evento.target.value)
                  )
                )
              }
            />
          </div>
        </div>

        <div className="configuracoes-card">
          <h2>Aparência</h2>

          <div className="configuracoes-form-group">
            <label htmlFor="tema">
              Tema
            </label>

            <select
              id="tema"
              value={formulario.tema}
              onChange={(evento) =>
                atualizarCampo(
                  "tema",
                  evento.target.value as Tema
                )
              }
            >
              <option value="escuro">
                Escuro
              </option>

              <option value="claro">
                Claro
              </option>
            </select>
          </div>

          <div className="configuracoes-preview">
            <span>Pré-visualização</span>

            <div
              className={`configuracoes-tema-preview tema-${formulario.tema}`}
            >
              <strong>
                {formulario.concurso ||
                  "Concurso"}
              </strong>

              <p>
                Tema {formulario.tema}
              </p>
            </div>
          </div>
        </div>

        <div className="configuracoes-card">
          <h2>Resumo</h2>

          <div className="configuracoes-resumo-item">
            <span>Usuário</span>
            <strong>
              {formulario.nomeUsuario}
            </strong>
          </div>

          <div className="configuracoes-resumo-item">
            <span>Concurso</span>
            <strong>
              {formulario.concurso}
            </strong>
          </div>

          <div className="configuracoes-resumo-item">
            <span>Meta de questões</span>
            <strong>
              {
                formulario.metaQuestoesDiaria
              }
            </strong>
          </div>

          <div className="configuracoes-resumo-item">
            <span>Meta de tempo</span>
            <strong>
              {Math.floor(
                formulario.metaMinutosDiaria /
                  60
              )}
              h{" "}
              {
                formulario.metaMinutosDiaria %
                60
              }
              min
            </strong>
          </div>

          <div className="configuracoes-resumo-item">
            <span>Meta de revisões</span>
            <strong>
              {
                formulario.metaRevisoesDiaria
              }
            </strong>
          </div>
        </div>
      </div>

      <div className="configuracoes-acoes">
        <button
          className="configuracoes-salvar"
          onClick={salvarConfiguracoes}
        >
          Salvar configurações
        </button>

        <button
          className="configuracoes-restaurar"
          onClick={restaurarPadrao}
        >
          Restaurar padrão
        </button>
      </div>
    </section>
  );
}