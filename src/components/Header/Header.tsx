import { Bell, CalendarDays, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import "./Header.css";

import CloudStatus from "../CloudStatus/CloudStatus";
import UserProfileMenu from "../UserProfileMenu/UserProfileMenu";

export default function Header() {
  const navigate = useNavigate();
  const hoje = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <header className="header studio-premium-header">
      <button
        type="button"
        className="studio-header-search"
        onClick={() => navigate("/buscar", { state: { focoBusca: true } })}
      >
        <Search size={18} strokeWidth={1.9} />
        <span>Buscar conteúdos, aulas, questões...</span>
        <kbd>Ctrl + K</kbd>
      </button>

      <div className="header-acoes studio-header-actions">
        <CloudStatus />

        <button
          type="button"
          className="studio-header-icon"
          aria-label="Notificações"
        >
          <Bell size={18} />
          <i />
        </button>

        <div className="studio-header-date">
          <CalendarDays size={16} />
          <span>{hoje}</span>
        </div>

        <UserProfileMenu />
      </div>
    </header>
  );
}
