import "./Header.css";
import { Bell } from "lucide-react";

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
          <span
            className="header-brand-mark-shell"
            aria-hidden="true"
          >
            <img
              className="header-brand-mark"
              src="/assets/study-pro-logo-official.jpg?v=1"
              alt=""
              draggable={false}
            />
          </span>
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
          <Bell size={18} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <UserProfileMenu />
      </div>
    </header>
  );
}
