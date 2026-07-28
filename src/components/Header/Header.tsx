import "./Header.css";

import {
  useApp,
} from "../../context/AppContext";

import CloudStatus from "../CloudStatus/CloudStatus";
import LogoutButton from "../LogoutButton/LogoutButton";

export default function Header() {
  const {
    configuracoes,
  } = useApp();

  return (
    <header className="header">
      <div className="header-identidade">
        <strong>
          PMPE STUDY PRO
        </strong>

        <span>
          {configuracoes.concurso}
        </span>
      </div>

      <div className="header-acoes">
        <CloudStatus />

        <LogoutButton />
      </div>
    </header>
  );
}