import "./Header.css";

import {
  useApp,
} from "../../context/AppContext";

import CloudStatus from "../CloudStatus/CloudStatus";
import UserProfileMenu from "../UserProfileMenu/UserProfileMenu";

export default function Header() {
  const {
    configuracoes,
  } = useApp();

  function abrirNotificacoes() {
    window.dispatchEvent(new Event("pmpe:notificacoes:abrir"));
  }

  return (
    <header className="header">
      <div className="header-identidade">
        <img
          className="header-logo-marca header-logo-completa"
          src="/assets/studio-pro-logo.svg"
          alt="Studio Pro"
        />
        <span className="header-concurso">{configuracoes.concurso}</span>
      </div>

      <div className="header-acoes">
        <CloudStatus />
        <button
          type="button"
          className="header-notification-button"
          aria-label="Notificações"
          onClick={abrirNotificacoes}
        >
          🔔
        </button>
        <UserProfileMenu />
      </div>
    </header>
  );
}
