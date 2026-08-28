import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import "./EconomiaGamificacaoBridge.css";

import { useApp } from "../../context/AppContext";
import { calcularGamificacao } from "../../services/gamificacaoService";
import {
  aplicarRecompensasPendentes,
  chaveDataLocal,
  listarRecompensasConquistadas,
  obterEstadoEconomia,
  obterRecompensaLogin,
  resgatarRecompensaLogin,
  type ConfiguracoesComEconomia,
} from "../../services/economiaGamificacao";
import { migrarTitulosRetiradosDaLoja } from "../../services/migracaoTitulosLoja";

export default function EconomiaGamificacaoBridge() {
  const location = useLocation();
  const {
    sessoes,
    questoes,
    revisoes,
    simulados,
    missoesConcluidas,
    configuracoes,
    setConfiguracoes,
    statusNuvem,
  } = useApp();

  const [loginFechado, setLoginFechado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const ultimoLoteAvisado = useRef("");
  const reembolsoAvisado = useRef(false);

  const gamificacao = useMemo(
    () =>
      calcularGamificacao({
        sessoes,
        questoes,
        revisoes,
        simulados,
      }),
    [sessoes, questoes, revisoes, simulados]
  );

  const economia = useMemo(
    () => obterEstadoEconomia(configuracoes),
    [configuracoes]
  );

  const recompensasConquistadas = useMemo(
    () =>
      listarRecompensasConquistadas({
        sessoes,
        questoes,
        revisoes,
        simulados,
        missoesConcluidas,
        configuracoes,
        nivelAtual: gamificacao.nivel,
      }),
    [
      sessoes,
      questoes,
      revisoes,
      simulados,
      missoesConcluidas,
      configuracoes,
      gamificacao.nivel,
    ]
  );

  const pendentes = useMemo(() => {
    const recebidas = new Set(economia.recompensasRecebidas);
    return recompensasConquistadas.filter((item) => !recebidas.has(item.id));
  }, [economia.recompensasRecebidas, recompensasConquistadas]);

  useEffect(() => {
    if (statusNuvem === "carregando") return;

    const hoje = chaveDataLocal(new Date());
    const marcadorAcesso = `acesso:${hoje}`;
    const migracao = migrarTitulosRetiradosDaLoja(economia);
    const acessoRegistrado = migracao.estado.recompensasRecebidas.includes(marcadorAcesso);

    if (!migracao.mudou && acessoRegistrado) return;

    const estadoFinal = acessoRegistrado
      ? migracao.estado
      : {
          ...migracao.estado,
          recompensasRecebidas: [
            ...migracao.estado.recompensasRecebidas,
            marcadorAcesso,
          ],
          atualizadoEm: new Date().toISOString(),
        };

    setConfiguracoes((atuais) => ({
      ...atuais,
      economia: estadoFinal,
    }) as ConfiguracoesComEconomia);

    if (migracao.moedasReembolsadas > 0 && !reembolsoAvisado.current) {
      reembolsoAvisado.current = true;
      setAviso(`🪙 +${migracao.moedasReembolsadas} moedas reembolsadas por títulos retirados da Loja`);
    }
  }, [economia, setConfiguracoes, statusNuvem]);

  useEffect(() => {
    if (statusNuvem === "carregando" || pendentes.length === 0) return;

    const chaveLote = pendentes
      .map((item) => item.id)
      .sort()
      .join("|");
    const total = pendentes.reduce((soma, item) => soma + item.moedas, 0);

    setConfiguracoes((atuais) => {
      const estadoAtual = obterEstadoEconomia(atuais);
      const resultado = aplicarRecompensasPendentes(
        estadoAtual,
        recompensasConquistadas
      );

      if (resultado.novas.length === 0) return atuais;

      return {
        ...atuais,
        economia: resultado.estado,
      } as ConfiguracoesComEconomia;
    });

    if (chaveLote && ultimoLoteAvisado.current !== chaveLote) {
      ultimoLoteAvisado.current = chaveLote;
      setAviso(`🪙 +${total} moedas pelas suas conquistas`);
    }
  }, [
    pendentes,
    recompensasConquistadas,
    setConfiguracoes,
    statusNuvem,
  ]);

  useEffect(() => {
    if (!aviso) return;
    const timer = window.setTimeout(() => setAviso(null), 4200);
    return () => window.clearTimeout(timer);
  }, [aviso]);

  useEffect(() => {
    setLoginFechado(false);
  }, [location.pathname]);

  const recompensaLogin = useMemo(
    () => obterRecompensaLogin(economia),
    [economia]
  );

  const mostrarLogin =
    location.pathname === "/" &&
    statusNuvem !== "carregando" &&
    !loginFechado &&
    Boolean(recompensaLogin);

  function resgatarLogin() {
    if (!recompensaLogin) return;

    setConfiguracoes((atuais) => {
      const estadoAtual = obterEstadoEconomia(atuais);
      const resultado = resgatarRecompensaLogin(estadoAtual);
      if (!resultado.recompensa) return atuais;

      return {
        ...atuais,
        economia: resultado.estado,
      } as ConfiguracoesComEconomia;
    });

    setLoginFechado(true);
    setAviso(`🪙 +${recompensaLogin.moedas} moedas de login diário`);
  }

  return (
    <>
      {aviso && (
        <div className="economia-toast" role="status">
          {aviso}
        </div>
      )}

      {mostrarLogin && recompensaLogin && (
        <div className="economia-login-overlay" role="presentation">
          <section
            className="economia-login-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="economia-login-titulo"
          >
            <button
              type="button"
              className="economia-login-fechar"
              onClick={() => setLoginFechado(true)}
              aria-label="Fechar recompensa de login"
            >
              ×
            </button>

            <div className="economia-login-moeda">🪙</div>
            <span className="economia-login-kicker">
              RECOMPENSA DIÁRIA · DIA {recompensaLogin.diaCiclo}/7
            </span>
            <h2 id="economia-login-titulo">{recompensaLogin.titulo}</h2>
            <p>{recompensaLogin.detalhe}</p>

            <div className="economia-login-premio">
              <strong>+{recompensaLogin.moedas}</strong>
              <span>moedas</span>
            </div>

            <div className="economia-login-dias" aria-label="Progresso da sequência de login">
              {Array.from({ length: 7 }, (_, indice) => {
                const dia = indice + 1;
                return (
                  <span
                    key={dia}
                    className={dia <= recompensaLogin.diaCiclo ? "feito" : ""}
                    title={`Dia ${dia}`}
                  >
                    {dia === 7 ? "★" : dia}
                  </span>
                );
              })}
            </div>

            <button
              type="button"
              className="economia-login-resgatar"
              onClick={resgatarLogin}
            >
              Resgatar {recompensaLogin.moedas} moedas
            </button>

            <button
              type="button"
              className="economia-login-agora-nao"
              onClick={() => setLoginFechado(true)}
            >
              Agora não
            </button>
          </section>
        </div>
      )}
    </>
  );
}
