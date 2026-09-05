import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { calcularGamificacao } from "../../services/gamificacaoService";
import {
  obterEstadoEconomia,
  type ConfiguracoesComEconomia,
} from "../../services/economiaGamificacao";
import {
  calcularTitulosConquista,
  obterTituloEquipadoValido,
} from "../../services/conquistasTitulos";
import { calcularConquistasPermanentes } from "../../services/conquistasPermanentes";
import {
  alternarInsigniaPerfil,
  LIMITE_INSIGNIAS_PERFIL,
  normalizarInsigniasPerfil,
  obterInsigniasConfiguradas,
  type ConfiguracoesComPerfil,
} from "../../services/perfilInsignias";
import "./Perfil.css";

export default function Perfil() {
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

  const economia = useMemo(
    () => obterEstadoEconomia(configuracoes),
    [configuracoes]
  );

  const gamificacao = useMemo(
    () => calcularGamificacao({ sessoes, questoes, revisoes, simulados }),
    [sessoes, questoes, revisoes, simulados]
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

  const insigniasEquipadas = idsEquipadas
    .map((id) => conquistas.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const tituloEquipado = obterTituloEquipadoValido(
    titulos,
    economia.tituloEquipado
  );

  const totalQuestoes = questoes.reduce(
    (total, item) => total + item.certas + item.erradas,
    0
  );
  const totalCertas = questoes.reduce((total, item) => total + item.certas, 0);
  const aproveitamento = totalQuestoes
    ? Math.round((totalCertas / totalQuestoes) * 100)
    : 0;
  const totalMinutos = sessoes.reduce(
    (total, item) => total + Math.max(0, item.minutos || 0),
    0
  );
  const revisoesConcluidas = revisoes.filter((item) => item.concluida).length;
  const desbloqueadas = conquistas.filter((item) => item.desbloqueada).length;
  const nome = configuracoes.nomeUsuario.trim() || "Estudante";
  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("") || "SP";

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
          `Você pode exibir até ${LIMITE_INSIGNIAS_PERFIL} insígnias no perfil.`,
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
        ? "Insígnia adicionada ao perfil."
        : "Insígnia removida do perfil."
    );
  }

  function usarTituloPadrao() {
    setConfiguracoes((atuais) => {
      const estado = obterEstadoEconomia(atuais);
      const proximo = { ...estado, atualizadoEm: new Date().toISOString() };
      delete proximo.tituloEquipado;
      return { ...atuais, economia: proximo } as ConfiguracoesComEconomia;
    });
    showToast("Título padrão do nível restaurado.", "info");
  }

  return (
    <section className="perfil-page">
      <header className="perfil-hero">
        <div className="perfil-avatar" aria-hidden="true">
          {iniciais}
        </div>
        <div className="perfil-identidade">
          <span className="perfil-kicker">PERFIL DO ESTUDANTE</span>
          <h1>{nome}</h1>
          <p>
            Nível {gamificacao.nivel} · {tituloEquipado?.nome || gamificacao.tituloNivel}
          </p>
          <div className="perfil-meta">
            <span>{gamificacao.xpTotal} XP acumulados</span>
            <span>🪙 {economia.moedas} moedas</span>
            <span>{desbloqueadas}/{conquistas.length} conquistas</span>
          </div>
        </div>
        <div className="perfil-acoes">
          <Link to="/conquistas">Ver conquistas</Link>
          {tituloEquipado && (
            <button type="button" onClick={usarTituloPadrao}>
              Usar título do nível
            </button>
          )}
        </div>
      </header>

      <section className="perfil-secao perfil-insignias-destaque">
        <div className="perfil-secao-cabecalho">
          <div>
            <span>INSÍGNIAS EM DESTAQUE</span>
            <h2>Escolha até {LIMITE_INSIGNIAS_PERFIL} para representar seu perfil</h2>
          </div>
          <strong>{insigniasEquipadas.length}/{LIMITE_INSIGNIAS_PERFIL}</strong>
        </div>

        <div className="perfil-insignias-slots">
          {Array.from({ length: LIMITE_INSIGNIAS_PERFIL }, (_, indice) => {
            const insignia = insigniasEquipadas[indice];
            return insignia ? (
              <article
                key={insignia.id}
                className={`perfil-insignia-slot raridade-${insignia.raridade}`}
              >
                <div className="perfil-insignia-icone">{insignia.icone}</div>
                <span>{nomeRaridade(insignia.raridade)}</span>
                <strong>{insignia.titulo}</strong>
                <small>{insignia.descricao}</small>
                <button type="button" onClick={() => alternarInsignia(insignia.id)}>
                  Remover
                </button>
              </article>
            ) : (
              <article key={`vazio-${indice}`} className="perfil-insignia-slot vazio">
                <div className="perfil-insignia-icone">＋</div>
                <strong>Espaço livre</strong>
                <small>Escolha uma conquista desbloqueada abaixo.</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="perfil-estatisticas" aria-label="Estatísticas do perfil">
        <Card titulo="Questões" valor={formatarNumero(totalQuestoes)} detalhe={`${formatarNumero(totalCertas)} certas`} />
        <Card titulo="Aproveitamento" valor={`${aproveitamento}%`} detalhe="Histórico registrado" />
        <Card titulo="Tempo estudado" valor={formatarTempo(totalMinutos)} detalhe={`${sessoes.length} sessões`} />
        <Card titulo="Revisões" valor={formatarNumero(revisoesConcluidas)} detalhe={`${simulados.length} simulados`} />
      </section>

      <section className="perfil-secao">
        <div className="perfil-secao-cabecalho">
          <div>
            <span>COLEÇÃO DE INSÍGNIAS</span>
            <h2>{desbloqueadas}/{conquistas.length} desbloqueadas</h2>
            <p>
              As conquistas são permanentes. As selecionadas aparecem no topo do seu perfil.
            </p>
          </div>
        </div>

        <div className="perfil-colecao">
          {conquistas.map((insignia) => {
            const equipada = idsEquipadas.includes(insignia.id);
            return (
              <article
                key={insignia.id}
                className={`perfil-colecao-card raridade-${insignia.raridade} ${insignia.desbloqueada ? "desbloqueada" : "bloqueada"} ${equipada ? "equipada" : ""}`}
              >
                <div className="perfil-colecao-topo">
                  <div className="perfil-insignia-icone">{insignia.icone}</div>
                  <span>{nomeRaridade(insignia.raridade)}</span>
                </div>
                <h3>{insignia.titulo}</h3>
                <p>{insignia.descricao}</p>
                <small>{insignia.atual}</small>
                <button
                  type="button"
                  disabled={!insignia.desbloqueada}
                  onClick={() => alternarInsignia(insignia.id)}
                >
                  {!insignia.desbloqueada
                    ? "Bloqueada"
                    : equipada
                      ? "✓ Exibindo no perfil"
                      : "Exibir no perfil"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function Card({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <article className="perfil-estatistica-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

function nomeRaridade(raridade: string) {
  if (raridade === "lendaria") return "Lendária";
  if (raridade === "ouro") return "Ouro";
  if (raridade === "prata") return "Prata";
  return "Bronze";
}

function formatarNumero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, valor));
}

function formatarTempo(minutos: number) {
  const horas = Math.floor(Math.max(0, minutos) / 60);
  const resto = Math.max(0, minutos) % 60;
  if (horas === 0) return `${resto}min`;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
}
