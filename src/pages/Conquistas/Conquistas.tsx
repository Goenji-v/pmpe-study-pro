import { useMemo, useState } from "react";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import {
  obterEstadoEconomia,
  type ConfiguracoesComEconomia,
} from "../../services/economiaGamificacao";
import {
  calcularTitulosConquista,
  type RaridadeConquista,
} from "../../services/conquistasTitulos";
import {
  calcularConquistasPermanentes,
  type CategoriaConquistaPermanente,
  type RaridadeConquistaPermanente,
} from "../../services/conquistasPermanentes";
import {
  alternarInsigniaPerfil,
  LIMITE_INSIGNIAS_PERFIL,
  normalizarInsigniasPerfil,
  obterInsigniasConfiguradas,
  type ConfiguracoesComPerfil,
} from "../../services/perfilInsignias";
import "./Conquistas.css";

type FiltroCategoria = "todas" | CategoriaConquistaPermanente;

const FILTROS: Array<{ id: FiltroCategoria; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "questoes", label: "Questões" },
  { id: "foco", label: "Foco" },
  { id: "constancia", label: "Constância" },
  { id: "revisao", label: "Revisões" },
  { id: "simulado", label: "Simulados" },
  { id: "missao", label: "Missões" },
  { id: "dominio", label: "Domínio" },
];

export default function Conquistas() {
  const {
    questoes,
    sessoes,
    revisoes,
    simulados,
    materias,
    missoesConcluidas,
    configuracoes,
    setConfiguracoes,
  } = useApp();
  const { showToast } = useToast();
  const [filtro, setFiltro] = useState<FiltroCategoria>("todas");

  const economia = useMemo(
    () => obterEstadoEconomia(configuracoes),
    [configuracoes]
  );

  const titulos = useMemo(
    () =>
      calcularTitulosConquista({
        questoes,
        sessoes,
        revisoes,
        simulados,
        missoesConcluidas,
        configuracoes,
        economia,
      }),
    [
      questoes,
      sessoes,
      revisoes,
      simulados,
      missoesConcluidas,
      configuracoes,
      economia,
    ]
  );

  const conquistas = useMemo(
    () =>
      calcularConquistasPermanentes({
        questoes,
        sessoes,
        revisoes,
        simulados,
        materias,
        missoesConcluidas,
        configuracoes,
        recompensasRecebidas: economia.recompensasRecebidas,
      }),
    [
      questoes,
      sessoes,
      revisoes,
      simulados,
      materias,
      missoesConcluidas,
      configuracoes,
      economia.recompensasRecebidas,
    ]
  );

  const idsEquipadas = useMemo(
    () =>
      normalizarInsigniasPerfil(
        obterInsigniasConfiguradas(configuracoes),
        conquistas
      ),
    [configuracoes, conquistas]
  );

  const conquistasFiltradas = useMemo(
    () =>
      filtro === "todas"
        ? conquistas
        : conquistas.filter((item) => item.categoria === filtro),
    [conquistas, filtro]
  );

  const desbloqueadas = conquistas.filter((item) => item.desbloqueada).length;
  const titulosDesbloqueados = titulos.filter((titulo) => titulo.desbloqueada).length;
  const moedasConquistadas = conquistas
    .filter((item) => item.desbloqueada)
    .reduce((total, item) => total + item.moedas, 0);

  function equiparTitulo(id: string, nome: string) {
    const titulo = titulos.find((item) => item.id === id);
    if (!titulo?.desbloqueada) {
      showToast("Esse título ainda não foi conquistado.", "warning");
      return;
    }

    setConfiguracoes((atuais) => {
      const atual = obterEstadoEconomia(atuais);
      const proximo = {
        ...atual,
        tituloEquipado: id,
        atualizadoEm: new Date().toISOString(),
      };
      return { ...atuais, economia: proximo } as ConfiguracoesComEconomia;
    });
    showToast(`${nome} agora é o seu título ativo.`);
  }

  function usarTituloPadrao() {
    setConfiguracoes((atuais) => {
      const atual = obterEstadoEconomia(atuais);
      const proximo = { ...atual, atualizadoEm: new Date().toISOString() };
      delete proximo.tituloEquipado;
      return { ...atuais, economia: proximo } as ConfiguracoesComEconomia;
    });
    showToast("Título padrão do nível restaurado.", "info");
  }

  function alternarInsignia(insigniaId: string) {
    const resultado = alternarInsigniaPerfil({
      atuais: idsEquipadas,
      insigniaId,
      conquistas,
    });

    if (!resultado.alterou) {
      if (resultado.motivo === "bloqueada") {
        showToast("Essa insígnia ainda não foi conquistada.", "warning");
      } else if (resultado.motivo === "limite") {
        showToast(
          `O perfil exibe no máximo ${LIMITE_INSIGNIAS_PERFIL} insígnias. Remova uma antes de adicionar outra.`,
          "warning"
        );
      }
      return;
    }

    setConfiguracoes((atuais) => ({
      ...atuais,
      perfil: {
        ...((atuais as ConfiguracoesComPerfil).perfil ?? {}),
        insigniasEquipadas: resultado.ids,
      },
    }) as ConfiguracoesComPerfil);

    showToast(
      resultado.motivo === "adicionada"
        ? "Insígnia adicionada ao seu perfil."
        : "Insígnia removida do seu perfil."
    );
  }

  return (
    <section className="conquistas-page">
      <header className="conquistas-hero">
        <div>
          <span>PROGRESSO</span>
          <h1>Conquistas</h1>
          <p>
            Marcos permanentes, recompensas e títulos desbloqueados pelo seu desempenho real.
          </p>
        </div>
        <div className="conquistas-resumo">
          <div className="conquistas-contador">
            <strong>{desbloqueadas + titulosDesbloqueados}</strong>
            <span>desbloqueadas</span>
          </div>
          <div className="conquistas-contador conquistas-contador-moedas">
            <strong>{moedasConquistadas}</strong>
            <span>moedas em marcos</span>
          </div>
        </div>
      </header>

      <section className="conquistas-titulos-cabecalho">
        <div>
          <span>TÍTULOS DE MÉRITO</span>
          <h2>Não se compram. Se conquistam.</h2>
          <p>
            Os títulos substituem o nome padrão do nível no Dashboard enquanto seus requisitos estiverem válidos.
          </p>
        </div>
        {economia.tituloEquipado && (
          <button type="button" onClick={usarTituloPadrao}>
            Usar título padrão
          </button>
        )}
      </section>

      <div className="conquistas-grid conquistas-grid-titulos">
        {titulos.map((titulo) => {
          const equipado =
            economia.tituloEquipado === titulo.id && titulo.desbloqueada;
          return (
            <article
              key={titulo.id}
              className={`conquista-card conquista-titulo raridade-${titulo.raridade} ${titulo.desbloqueada ? "ativa" : "bloqueada"} ${equipado ? "equipada" : ""}`}
            >
              <div className="conquista-icone">{titulo.icone}</div>
              <div className="conquista-info">
                <div className="conquista-titulo-topo">
                  <span>
                    {titulo.desbloqueada ? "TÍTULO DESBLOQUEADO" : "EM PROGRESSO"}
                  </span>
                  <em className={`conquista-raridade raridade-${titulo.raridade}`}>
                    {nomeRaridade(titulo.raridade)}
                  </em>
                </div>
                <h2>{titulo.nome}</h2>
                <p>{titulo.descricao}</p>
                <div className="conquista-barra">
                  <div style={{ width: `${titulo.progresso}%` }} />
                </div>
                <small>{titulo.atual}</small>
                {titulo.detalheValidade && (
                  <small className="conquista-validade">
                    {titulo.detalheValidade}
                  </small>
                )}
                {titulo.desbloqueada && (
                  <button
                    type="button"
                    className="conquista-equipar"
                    disabled={equipado}
                    onClick={() => equiparTitulo(titulo.id, titulo.nome)}
                  >
                    {equipado ? "✓ Título em uso" : "Usar este título"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="conquistas-titulos-cabecalho conquistas-marcos-cabecalho">
        <div>
          <span>MARCOS PERMANENTES</span>
          <h2>{desbloqueadas}/{conquistas.length} conquistas</h2>
          <p>
            Uma vez desbloqueado, o marco fica no seu histórico. Cada conquista também entrega moedas uma única vez e pode virar uma insígnia do perfil.
          </p>
        </div>
        <div className="conquistas-perfil-resumo">
          {idsEquipadas.length}/{LIMITE_INSIGNIAS_PERFIL} no perfil
        </div>
      </section>

      <nav className="conquistas-filtros" aria-label="Filtrar conquistas">
        {FILTROS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filtro === item.id ? "ativo" : ""}
            onClick={() => setFiltro(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="conquistas-grid">
        {conquistasFiltradas.map((conquista) => {
          const exibindoNoPerfil = idsEquipadas.includes(conquista.id);
          return (
            <article
              key={conquista.id}
              className={`conquista-card conquista-marco raridade-marco-${conquista.raridade} ${conquista.desbloqueada ? "ativa" : "bloqueada"} ${exibindoNoPerfil ? "insignia-equipada" : ""}`}
            >
              <div className="conquista-icone">{conquista.icone}</div>
              <div className="conquista-info">
                <div className="conquista-titulo-topo">
                  <span>
                    {conquista.desbloqueada ? "DESBLOQUEADA" : "EM PROGRESSO"}
                  </span>
                  <em
                    className={`conquista-raridade raridade-marco-${conquista.raridade}`}
                  >
                    {nomeRaridadeMarco(conquista.raridade)}
                  </em>
                </div>
                <h2>{conquista.titulo}</h2>
                <p>{conquista.descricao}</p>
                <div className="conquista-barra">
                  <div style={{ width: `${conquista.progresso}%` }} />
                </div>
                <div className="conquista-rodape">
                  <small>{conquista.atual}</small>
                  <strong>🪙 +{conquista.moedas}</strong>
                </div>
                {conquista.desbloqueada && (
                  <button
                    type="button"
                    className="conquista-perfil-botao"
                    onClick={() => alternarInsignia(conquista.id)}
                  >
                    {exibindoNoPerfil ? "✓ Exibindo no perfil" : "Exibir como insígnia"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function nomeRaridade(raridade: RaridadeConquista) {
  if (raridade === "lendario") return "Lendária";
  if (raridade === "epico") return "Épica";
  if (raridade === "raro") return "Rara";
  return "Comum";
}

function nomeRaridadeMarco(raridade: RaridadeConquistaPermanente) {
  if (raridade === "lendaria") return "Lendária";
  if (raridade === "ouro") return "Ouro";
  if (raridade === "prata") return "Prata";
  return "Bronze";
}
