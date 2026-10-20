import { gerarPlanoEdital, preservarIdsPlanoAnterior } from "../../utils/planoEdital";
import { useState } from "react";
import { Link } from "react-router-dom";

import "./Configuracoes.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { obterEstadoEconomia } from "../../services/economiaGamificacao";
import { encontrarItemLoja } from "../../services/lojaGamificacao";
import {
  DIAS_SEMANA,
  type ConfiguracoesComEdital,
  type DiaSemanaId,
} from "../../types/editalInteligente";

type TemaBasico = "azul" | "escuro" | "claro";
type ConfiguracoesFormulario = Pick<ConfiguracoesComEdital,
  | "nomeUsuario" | "concurso" | "bancaPadrao" | "tema"
  | "metaQuestoesDiaria" | "metaMinutosDiaria" | "metaRevisoesDiaria"
  | "materiasPorDia" | "missoesPorDia" | "materiasPorDiaSemana"
  | "salvarMarcacoesPdf" | "diasEstudo" | "diaRedacaoSemanal" | "diaSimuladoSemanal"
> & {
  temaBasico?: TemaBasico;
};

// Não transportar economia, progresso ou metadados na cópia editável do formulário.
function camposEditaveis(config: ConfiguracoesFormulario): ConfiguracoesFormulario {
  return {
    nomeUsuario: config.nomeUsuario,
    concurso: config.concurso,
    bancaPadrao: config.bancaPadrao,
    tema: config.tema,
    temaBasico: config.temaBasico,
    metaQuestoesDiaria: config.metaQuestoesDiaria,
    metaMinutosDiaria: config.metaMinutosDiaria,
    metaRevisoesDiaria: config.metaRevisoesDiaria,
    materiasPorDia: config.materiasPorDia,
    missoesPorDia: config.missoesPorDia,
    materiasPorDiaSemana: config.materiasPorDiaSemana,
    salvarMarcacoesPdf: config.salvarMarcacoesPdf,
    diasEstudo: config.diasEstudo,
    diaRedacaoSemanal: config.diaRedacaoSemanal,
    diaSimuladoSemanal: config.diaSimuladoSemanal,
  };
}

export default function Configuracoes() {
  const { configuracoes, setConfiguracoes, materias } = useApp();
  const { showToast } = useToast();
  const configInicial = configuracoes as ConfiguracoesComEdital & { temaBasico?: TemaBasico };
  const economia = obterEstadoEconomia(configuracoes);
  const temaLojaEquipado = encontrarItemLoja(economia.temaEquipado);
  const ritmoInicial = Math.max(
    1,
    Math.min(4, configInicial.materiasPorDia ?? configInicial.missoesPorDia ?? 1)
  );
  const temaBasicoInicial: TemaBasico =
    configInicial.temaBasico ?? (configInicial.tema === "claro" ? "claro" : "azul");

  const [formulario, setFormulario] = useState<ConfiguracoesFormulario>({
    ...camposEditaveis(configInicial),
    temaBasico: temaBasicoInicial,
    diasEstudo:
      configInicial.diasEstudo?.length
        ? configInicial.diasEstudo
        : ["seg", "ter", "qua", "qui", "sex", "sab"],
    materiasPorDia: ritmoInicial,
    missoesPorDia: ritmoInicial,
    diaRedacaoSemanal: configInicial.diaRedacaoSemanal ?? "dom",
    diaSimuladoSemanal: configInicial.diaSimuladoSemanal ?? "dom",
  });

  function atualizarCampo<K extends keyof ConfiguracoesFormulario>(
    campo: K,
    valor: ConfiguracoesFormulario[K]
  ) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function alterarPersistenciaPdf(salvar: boolean) {
    atualizarCampo('salvarMarcacoesPdf', salvar);
    setConfiguracoes(anterior => ({ ...anterior, salvarMarcacoesPdf: salvar }));
    showToast('Preferência de marcações salva.', 'success');
  }

  function atualizarRitmoDiario(valor: number) {
    const ritmo = Math.max(1, Math.min(4, valor));
    setFormulario((anterior) => ({
      ...anterior,
      materiasPorDia: ritmo,
      missoesPorDia: ritmo,
    }));
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
    const ritmoDiario = Math.max(
      1,
      Math.min(4, formulario.materiasPorDia ?? formulario.missoesPorDia ?? 1)
    );
    const temaBasico = formulario.temaBasico ?? "azul";

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
      formulario.metaRevisoesDiaria < 0
    ) {
      showToast("Confira as metas e a quantidade de matérias por dia.", "error");
      return;
    }

    const dadosAtualizados: ConfiguracoesFormulario = {
      ...formulario,
      nomeUsuario: nomeLimpo,
      concurso: concursoLimpo,
      materiasPorDia: ritmoDiario,
      missoesPorDia: ritmoDiario,
      temaBasico,
      tema: temaBasico === "claro" ? "claro" : "escuro",
    };

    setConfiguracoes(anterior => aplicarPreferencias(anterior, dadosAtualizados));
    showToast("Configurações salvas com sucesso.", "success");
  }

  function aplicarPreferencias(anterior: ConfiguracoesComEdital, preferencias: ConfiguracoesFormulario) {
    const atualizadas = { ...anterior, ...camposEditaveis(preferencias) };
    const ativo = anterior.editalAtivo;
    if (ativo?.plano) {
      atualizadas.editalAtivo = {
        ...ativo,
        plano: preservarIdsPlanoAnterior(gerarPlanoEdital(ativo.analise, atualizadas, materias), ativo.plano),
      };
    }
    return atualizadas;
  }

  function restaurarPadrao() {
    if (!window.confirm("Deseja restaurar as configurações padrão?")) return;

    const padrao: ConfiguracoesFormulario = {
      ...formulario,
      metaQuestoesDiaria: 30,
      metaMinutosDiaria: 120,
      metaRevisoesDiaria: 5,
      missoesPorDia: 1,
      materiasPorDia: 1,
      materiasPorDiaSemana: undefined,
      salvarMarcacoesPdf: false,
      diasEstudo: ["seg", "ter", "qua", "qui", "sex", "sab"],
      diaRedacaoSemanal: "dom",
      diaSimuladoSemanal: "dom",
      tema: "escuro",
      temaBasico: "azul",
    };

    setFormulario(padrao);
    setConfiguracoes(anterior => aplicarPreferencias(anterior, padrao));
    showToast("Configurações padrão restauradas.", "info");
  }

  const diasSelecionados = formulario.diasEstudo ?? [];
  const temaBasico = formulario.temaBasico ?? "azul";

  return (
    <section className="configuracoes-container">
      <h1 className="configuracoes-title">⚙ Configurações</h1>
      <p className="configuracoes-subtitle">
        Defina seu perfil, disponibilidade e metas. O Edital Inteligente usa essas regras para montar o plano.
      </p>

      <nav className="configuracoes-nav" aria-label="Seções das configurações">{[['identidade','Meu perfil'],['rotina','Rotina semanal'],['atividades','Redação e simulado'],['metas','Metas'],['aparencia','Aparência'],['leitura','Leitura de PDFs']].map(([id,nome]) => <a key={id} href={`#config-${id}`}>{nome}</a>)}</nav>
      <div className="configuracoes-grid">
        <div className="configuracoes-card">
          <h2 id="config-identidade">Perfil</h2>

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
          <h2 id="config-rotina">Disponibilidade semanal</h2>
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
              onChange={(evento) => atualizarRitmoDiario(Number(evento.target.value))}
            >
              {[1, 2, 3, 4].map((quantidade) => (
                <option value={quantidade} key={quantidade}>
                  {quantidade} {quantidade === 1 ? "matéria" : "matérias"}
                </option>
              ))}
            </select>
            <small>
Este é o padrão. Abaixo você pode escolher uma quantidade diferente para cada dia. Salve e altere novamente quando precisar.
            </small>
          </div>
          <div className="configuracoes-ritmo-semana">{DIAS_SEMANA.map(dia => <label key={dia.id}><span>{dia.nome}</span><select aria-label={`Matérias na ${dia.nome}`} value={formulario.materiasPorDiaSemana?.[dia.id] ?? formulario.materiasPorDia ?? 1} onChange={e => atualizarCampo('materiasPorDiaSemana', {...formulario.materiasPorDiaSemana,[dia.id]:Number(e.target.value)})}>{[1,2,3,4].map(n => <option key={n} value={n}>{n} {n===1?'matéria':'matérias'}</option>)}</select></label>)}</div>
          <button type="button" onClick={() => atualizarCampo('materiasPorDiaSemana', undefined)}>Usar o padrão em todos os dias</button>
        </div>

        <div className="configuracoes-card configuracoes-agenda-semanal">
          <h2 id="config-atividades">Redação e simulado semanal</h2>
          <p className="configuracoes-ajuda">
            O padrão do Study Pro é Redação + Simulado no domingo. Se preferir, você pode mudar cada atividade para outro dia.
          </p>

          <div className="configuracoes-form-group">
            <label htmlFor="diaRedacaoSemanal">Dia da redação</label>
            <select
              id="diaRedacaoSemanal"
              value={formulario.diaRedacaoSemanal ?? "dom"}
              onChange={(evento) =>
                atualizarCampo("diaRedacaoSemanal", evento.target.value as DiaSemanaId)
              }
            >
              {DIAS_SEMANA.map((dia) => (
                <option key={dia.id} value={dia.id}>{dia.nome}</option>
              ))}
            </select>
          </div>

          <div className="configuracoes-form-group">
            <label htmlFor="diaSimuladoSemanal">Dia do simulado</label>
            <select
              id="diaSimuladoSemanal"
              value={formulario.diaSimuladoSemanal ?? "dom"}
              onChange={(evento) =>
                atualizarCampo("diaSimuladoSemanal", evento.target.value as DiaSemanaId)
              }
            >
              {DIAS_SEMANA.map((dia) => (
                <option key={dia.id} value={dia.id}>{dia.nome}</option>
              ))}
            </select>
          </div>

          <small className="configuracoes-agenda-aviso">
            Mudar o dia não altera o restante do cronograma: apenas reposiciona essas duas atividades semanais.
          </small>
        </div>

        <div className="configuracoes-card">
          <h2 id="config-metas">Metas diárias</h2>

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
        </div>

        <section className="configuracoes-card"><h2 id="config-leitura">Leitura de PDFs</h2><label className="configuracoes-checkbox"><input type="checkbox" checked={formulario.salvarMarcacoesPdf === true} onChange={e => alterarPersistenciaPdf(e.target.checked)}/><span>Salvar minhas marcações nos PDFs dos materiais</span></label><p className="configuracoes-ajuda">Esta opção é salva automaticamente. Ativado: caneta e marca-texto ficam salvos neste aparelho para sua conta. Desativado: as marcações desta leitura são descartadas ao fechar. Os rascunhos de simulados mantêm seu funcionamento próprio.</p></section>
        <div className="configuracoes-card">
          <h2 id="config-aparencia">Aparência</h2>
          <div className="configuracoes-form-group">
            <label htmlFor="temaBasico">Tema básico gratuito</label>
            <select
              id="temaBasico"
              value={temaBasico}
              onChange={(evento) => atualizarCampo("temaBasico", evento.target.value as TemaBasico)}
            >
              <option value="azul">Azul padrão</option>
              <option value="claro">Claro / branco</option>
              <option value="escuro">Escuro / preto</option>
            </select>
            <small>
              Azul, branco e preto são gratuitos. Temas especiais ficam disponíveis na Loja por moedas.
            </small>
          </div>

          {temaLojaEquipado?.tipo === "tema" && (
            <div className="configuracoes-tema-loja-aviso">
              <strong>{temaLojaEquipado.icone} {temaLojaEquipado.nome} está equipado pela Loja.</strong>
              <span>Ele tem prioridade visual. Para voltar ao tema básico, desequipe o tema no Inventário.</span>
            </div>
          )}

          <div className="configuracoes-preview">
            <span>Pré-visualização do tema básico</span>
            <div className={`configuracoes-tema-preview tema-${temaBasico}`}>
              <strong>{formulario.concurso || "Concurso"}</strong>
              <p>{nomeTemaBasico(temaBasico)}</p>
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
            <span>Redação semanal</span>
            <strong>{DIAS_SEMANA.find((dia) => dia.id === (formulario.diaRedacaoSemanal ?? "dom"))?.nome ?? "Domingo"}</strong>
          </div>
          <div className="configuracoes-resumo-item">
            <span>Simulado semanal</span>
            <strong>{DIAS_SEMANA.find((dia) => dia.id === (formulario.diaSimuladoSemanal ?? "dom"))?.nome ?? "Domingo"}</strong>
          </div>
          <div className="configuracoes-resumo-item">
            <span>Tema básico</span><strong>{nomeTemaBasico(temaBasico)}</strong>
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
            <strong>{configInicial.editalAtivo?.confirmadoEm ? "Configurado" : "Não configurado"}</strong>
          </div>
        </div>

        <div className="configuracoes-card configuracoes-legal-card">
          <h2>Privacidade e documentos</h2>
          <p>
            Consulte as regras de uso do Study Pro e como os dados da sua conta e dos seus estudos são tratados.
          </p>
          <div className="configuracoes-legal-links">
            <Link to="/termos">Termos de Uso</Link>
            <Link to="/privacidade">Política de Privacidade</Link>
          </div>
          <small>
            Informações comerciais e canal exclusivo de atendimento serão publicados antes da abertura de cobranças ao público.
          </small>
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

function nomeTemaBasico(tema: TemaBasico) {
  if (tema === "claro") return "Claro / branco";
  if (tema === "escuro") return "Escuro / preto";
  return "Azul padrão";
}
