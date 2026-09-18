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
          className="header-logo-marca"
          src="/assets/studio-pro-mark.svg"
          alt=""
          aria-hidden="true"
        />
        <div className="header-marca-texto">
          <strong>STUDIO PRO</strong>
          <span>{configuracoes.concurso}</span>
        </div>
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
