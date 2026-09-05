import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { calcularGamificacao } from "../../services/gamificacaoService";
import { obterEstadoEconomia } from "../../services/economiaGamificacao";
import {
  calcularTitulosConquista,
  obterTituloEquipadoValido,
} from "../../services/conquistasTitulos";
import { calcularConquistasPermanentes } from "../../services/conquistasPermanentes";
import {
  normalizarInsigniasPerfil,
  obterInsigniaDestaque,
  obterInsigniasConfiguradas,
} from "../../services/perfilInsignias";
import "./UserProfileMenu.css";

export default function UserProfileMenu() {
  const {
    questoes,
    sessoes,
    revisoes,
    simulados,
    materias,
    missoesConcluidas,
    configuracoes,
  } = useApp();
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const raizRef = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);

  const gamificacao = useMemo(
    () => calcularGamificacao({ sessoes, questoes, revisoes, simulados }),
    [sessoes, questoes, revisoes, simulados]
  );

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

  const tituloEquipado = obterTituloEquipadoValido(
    titulos,
    economia.tituloEquipado
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

  const insigniaDestaque = useMemo(
    () => obterInsigniaDestaque(idsEquipadas, conquistas),
    [idsEquipadas, conquistas]
  );

  const nome =
    configuracoes.nomeUsuario.trim() ||
    String(usuario?.user_metadata?.nome || "").trim() ||
    usuario?.email?.split("@")[0] ||
    "Estudante";
  const inicial = nome.charAt(0).toUpperCase() || "S";
  const titulo = tituloEquipado?.nome || gamificacao.tituloNivel;

  useEffect(() => {
    setAberto(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!aberto) return;

    function fecharFora(evento: PointerEvent) {
      if (!raizRef.current?.contains(evento.target as Node)) {
        setAberto(false);
      }
    }

    function fecharEsc(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEsc);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEsc);
    };
  }, [aberto]);

  async function fazerLogout() {
    if (saindo) return;
    try {
      setSaindo(true);
      await sair();
      navigate("/login", { replace: true });
    } catch (erro) {
      window.alert(
        erro instanceof Error ? erro.message : "Não foi possível sair."
      );
    } finally {
      setSaindo(false);
    }
  }

  return (
    <div className="user-profile-menu" ref={raizRef}>
      <button
        type="button"
        className="user-profile-trigger"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((valor) => !valor)}
      >
        <span className="user-profile-avatar" aria-hidden="true">
          {inicial}
        </span>
        <span className="user-profile-copy">
          <strong>{nome}</strong>
          <small>Nível {gamificacao.nivel} · {titulo}</small>
        </span>
        {insigniaDestaque && (
          <span
            className={`user-profile-badge raridade-${insigniaDestaque.raridade}`}
            title={insigniaDestaque.titulo}
            aria-label={`Insígnia em destaque: ${insigniaDestaque.titulo}`}
          >
            {insigniaDestaque.icone}
          </span>
        )}
        <span className={`user-profile-chevron ${aberto ? "aberto" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {aberto && (
        <div className="user-profile-dropdown" role="menu">
          <div className="user-profile-dropdown-head">
            <span className="user-profile-avatar grande" aria-hidden="true">
              {inicial}
            </span>
            <div>
              <strong>{nome}</strong>
              <span>Nível {gamificacao.nivel} · {titulo}</span>
              {insigniaDestaque && (
                <small>
                  {insigniaDestaque.icone} {insigniaDestaque.titulo}
                </small>
              )}
            </div>
          </div>

          <div className="user-profile-links">
            <Link to="/perfil" role="menuitem">Meu Perfil</Link>
            <Link to="/conquistas" role="menuitem">Conquistas</Link>
            <Link to="/ranking" role="menuitem">Ranking</Link>
            <Link to="/configuracoes" role="menuitem">Configurações</Link>
          </div>

          <button
            type="button"
            className="user-profile-logout"
            role="menuitem"
            onClick={fazerLogout}
            disabled={saindo}
          >
            {saindo ? "Saindo..." : "Sair"}
          </button>
        </div>
      )}
    </div>
  );
}
