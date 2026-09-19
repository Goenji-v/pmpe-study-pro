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
        <div className="header-brand">
          <img
            className="header-brand-mark"
            src="/assets/studio-pro-mark.svg"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <div className="header-brand-copy">
            <strong>STUDY <span>PRO</span></strong>
            <small>ESTUDO HOJE. CONQUISTA SEMPRE.</small>
          </div>
        </div>
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
