import { useState } from "react";

import "./Configuracoes.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import type { Tema } from "../../types/index";
import {
  DIAS_SEMANA,
  type ConfiguracoesComEdital,
  type DiaSemanaId,
} from "../../types/editalInteligente";

export default function Configuracoes() {
  const { configuracoes, setConfiguracoes } = useApp();
  const { showToast } = useToast();
  const configInicial = configuracoes as ConfiguracoesComEdital;

  const [formulario, setFormulario] = useState<ConfiguracoesComEdital>({
    ...configInicial,
    diasEstudo:
      configInicial.diasEstudo?.length
        ? configInicial.diasEstudo
        : ["seg", "ter", "qua", "qui", "sex", "sab"],
    materiasPorDia:
      configInicial.materiasPorDia ?? configInicial.missoesPorDia ?? 1,
  });

  function atualizarCampo<K extends keyof ConfiguracoesComEdital>(
    campo: K,
    valor: ConfiguracoesComEdital[K]
  ) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function alternarDia(dia: DiaSemanaId) {
    setFormulario((anterior) => {
      const atuais = anterior.diasEstudo ?? [];
      const diasEstudo = atuais.includes(dia)
        ? atuais.filter((item) => item !== dia)
        : DIAS_SEMANA.map((item) => item.id).filter(
            (item) => [...atuais, dia].includes(item)
          );
      return { ...anterior, diasEstudo };
    });
  }

  function salvarConfiguracoes() {
    const nomeLimpo = formulario.nomeUsuario.trim();
    const concursoLimpo = formulario.concurso.trim();

    if (!nomeLimpo) {
      showToast("Informe o nome do usuário.", "warning");
      return;
    }
    if (!concursoLimpo) {
      showToast("Informe o concurso.", "warning");
      return;
    }
    if ((formulario.diasEstudo?.length ?? 0) === 0) {
      showToast("Escolha pelo menos um dia da semana para estudar.", "warning");
      return;
    }
    if (
      formulario.metaQuestoesDiaria < 0 ||
      formulario.metaMinutosDiaria < 0 ||
      formulario.metaRevisoesDiaria < 0 ||
      (formulario.missoesPorDia ?? 1) < 1 ||
      (formulario.missoesPorDia ?? 1) > 6 ||
      (formulario.materiasPorDia ?? 1) < 1 ||
      (formulario.materiasPorDia ?? 1) > 4
    ) {
      showToast("Confira as metas e a quantidade de matérias por dia.", "error");
      return;
    }

    const dadosAtualizados: ConfiguracoesComEdital = {
      ...formulario,
      nomeUsuario: nomeLimpo,
      concurso: concursoLimpo,
    };

    setConfiguracoes(dadosAtualizados);
    showToast("Configurações salvas com sucesso.", "success");
  }

  function restaurarPadrao() {
    if (!window.confirm("Deseja restaurar as configurações padrão?")) return;

    const padrao: ConfiguracoesComEdital = {
      nomeUsuario: "Leandro",
      concurso: "PMPE",
      bancaPadrao: "AOCP",
      metaQuestoesDiaria: 100,
      metaMinutosDiaria: 120,
      metaRevisoesDiaria: 5,
      missoesPorDia: 1,
      materiasPorDia: 1,
      diasEstudo: ["seg", "ter", "qua", "qui", "sex", "sab"],
      tema: "escuro",
      editalOnboardingVisto: formulario.editalOnboardingVisto,
      editalAtivo: formulario.editalAtivo,
    };

    setFormulario(padrao);
    setConfiguracoes(padrao);
    showToast("Configurações padrão restauradas.", "info");
  }

  const diasSelecionados = formulario.diasEstudo ?? [];

  return (
    <section className="configuracoes-container">
      <h1 className="configuracoes-title">⚙ Configurações</h1>
      <p className="configuracoes-subtitle">
        Defina seu perfil, disponibilidade e metas. O Edital Inteligente usa essas regras para montar o plano.
      </p>

      <div className="configuracoes-grid">
        <div className="configuracoes-card">
          <h2>Perfil</h2>

          <div className="configuracoes-form-group">
            <label htmlFor="nomeUsuario">Nome do usuário</label>
            <input
              id="nomeUsuario"
              value={formulario.nomeUsuario}
              onChange={(evento) => atualizarCampo("nomeUsuario", evento.target.value)}
            />
          </div>

          <div className="configuracoes-form-group">
            <label htmlFor="concurso">Concurso</label>
            <input
              id="concurso"
              value={formulario.concurso}
              onChange={(evento) => atualizarCampo("concurso", evento.target.value)}
              placeholder="Exemplo: PMPE"
            />
          </div>

          <div className="configuracoes-form-group">
            <label htmlFor="bancaPadrao">Banca padrão</label>
            <select
              id="bancaPadrao"
              value={formulario.bancaPadrao}
              onChange={(evento) => atualizarCampo("bancaPadrao", evento.target.value)}
            >
              <option value="AOCP">AOCP</option>
              <option value="CEBRASPE">CEBRASPE</option>
              <option value="FGV">FGV</option>
              <option value="FCC">FCC</option>
              <option value="VUNESP">VUNESP</option>
              <option value="IBFC">IBFC</option>
              <option value="IDECAN">IDECAN</option>
              <option value="Outra">Outra</option>
            </select>
          </div>
        </div>

        <div className="configuracoes-card configuracoes-disponibilidade-card">
          <h2>Disponibilidade semanal</h2>
          <p className="configuracoes-ajuda">
            Marque somente os dias em que você realmente consegue estudar.
          </p>

          <div className="configuracoes-dias" role="group" aria-label="Dias disponíveis para estudo">
            {DIAS_SEMANA.map((dia) => {
              const ativo = diasSelecionados.includes(dia.id);
              return (
                <button
                  key={dia.id}
                  type="button"
                  className={ativo ? "ativo" : ""}
                  aria-pressed={ativo}
                  title={dia.nome}
                  onClick={() => alternarDia(dia.id)}
                >
                  <span>{ativo ? "✓" : ""}</span>
                  <small>{dia.curto}</small>
                </button>
              );
            })}
          </div>

          <div className="configuracoes-form-group">
            <label htmlFor="materiasPorDia">Matérias por dia</label>
            <select
              id="materiasPorDia"
              value={formulario.materiasPorDia ?? 1}
              onChange={(evento) =>
                atualizarCampo(
                  "materiasPorDia",
                  Math.max(1, Math.min(4, Number(evento.target.value)))
                )
              }
            >
              {[1, 2, 3, 4].map((quantidade) => (
                <option value={quantidade} key={quantidade}>
                  {quantidade} {quantidade === 1 ? "matéria" : "matérias"}
                </option>
              ))}
            </select>
            <small>
              O plano do edital divide o tempo diário entre essa quantidade de matérias.
            </small>
          </div>
        </div>

        <div className="configuracoes-card">
          <h2>Metas diárias</h2>

          <div className="configuracoes-form-group">
            <label htmlFor="metaQuestoes">Questões por dia</label>
            <input
              id="metaQuestoes"
              type="number"
              min={0}
              value={formulario.metaQuestoesDiaria}
              onChange={(evento) =>
                atualizarCampo("metaQuestoesDiaria", Math.max(0, Number(evento.target.value)))
              }
            />
          </div>

          <div className="configuracoes-form-group">
            <label htmlFor="metaMinutos">Minutos de estudo por dia</label>
            <input
              id="metaMinutos"
              type="number"
              min={0}
              value={formulario.metaMinutosDiaria}
              onChange={(evento) =>
                atualizarCampo("metaMinutosDiaria", Math.max(0, Number(evento.target.value)))
              }
            />
          </div>

          <div className="configuracoes-form-group">
            <label htmlFor="metaRevisoes">Revisões por dia</label>
            <input
              id="metaRevisoes"
              type="number"
              min={0}
              value={formulario.metaRevisoesDiaria}
              onChange={(evento) =>
                atualizarCampo("metaRevisoesDiaria", Math.max(0, Number(evento.target.value)))
              }
            />
            <small>A mesma meta continua sendo usada para reorganizar a fila de revisões.</small>
          </div>

          <div className="configuracoes-form-group configuracoes-ritmo">
            <label htmlFor="missoesPorDia">Missões por dia no plano anterior</label>
            <select
              id="missoesPorDia"
              value={formulario.missoesPorDia ?? 1}
              onChange={(evento) =>
                atualizarCampo(
                  "missoesPorDia",
                  Math.max(1, Math.min(6, Number(evento.target.value)))
                )
              }
            >
              {[1, 2, 3, 4, 5, 6].map((quantidade) => (
                <option key={quantidade} value={quantidade}>
                  {quantidade} {quantidade === 1 ? "missão" : "missões"}
                </option>
              ))}
            </select>
            <small>Essa opção é mantida para compatibilidade com o plano antigo.</small>
          </div>
        </div>

        <div className="configuracoes-card">
          <h2>Aparência</h2>
          <div className="configuracoes-form-group">
            <label htmlFor="tema">Tema</label>
            <select
              id="tema"
              value={formulario.tema}
              onChange={(evento) => atualizarCampo("tema", evento.target.value as Tema)}
            >
              <option value="escuro">Escuro</option>
              <option value="claro">Claro</option>
            </select>
          </div>

          <div className="configuracoes-preview">
            <span>Pré-visualização</span>
            <div className={`configuracoes-tema-preview tema-${formulario.tema}`}>
              <strong>{formulario.concurso || "Concurso"}</strong>
              <p>Tema {formulario.tema}</p>
            </div>
          </div>
        </div>

        <div className="configuracoes-card">
          <h2>Resumo do perfil</h2>
          <div className="configuracoes-resumo-item">
            <span>Usuário</span><strong>{formulario.nomeUsuario}</strong>
          </div>
          <div className="configuracoes-resumo-item">
            <span>Concurso</span><strong>{formulario.concurso}</strong>
          </div>
          <div className="configuracoes-resumo-item">
            <span>Dias de estudo</span><strong>{diasSelecionados.length}/7</strong>
          </div>
          <div className="configuracoes-resumo-item">
            <span>Matérias por dia</span><strong>{formulario.materiasPorDia ?? 1}</strong>
          </div>
          <div className="configuracoes-resumo-item">
            <span>Tempo</span>
            <strong>
              {Math.floor(formulario.metaMinutosDiaria / 60)}h {formulario.metaMinutosDiaria % 60}min
            </strong>
          </div>
          <div className="configuracoes-resumo-item">
            <span>Questões</span><strong>{formulario.metaQuestoesDiaria}/dia</strong>
          </div>
          <div className="configuracoes-resumo-item">
            <span>Revisões</span><strong>{formulario.metaRevisoesDiaria}/dia</strong>
          </div>
          <div className="configuracoes-resumo-item">
            <span>Edital</span>
            <strong>{formulario.editalAtivo?.confirmadoEm ? "Configurado" : "Não configurado"}</strong>
          </div>
        </div>
      </div>

      <div className="configuracoes-acoes">
        <button className="configuracoes-salvar" onClick={salvarConfiguracoes}>
          Salvar configurações
        </button>
        <button className="configuracoes-restaurar" onClick={restaurarPadrao}>
          Restaurar padrão
        </button>
      </div>
    </section>
  );
}
