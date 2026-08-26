import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  NavLink,
  useLocation,
} from "react-router-dom";

import "./Sidebar.css";

import {
  useAdminStatus,
} from "../../hooks/useAdminStatus";

type GrupoId =
  | "planejamento"
  | "estudos"
  | "pratica"
  | "sistema";

type IconeMenu =
  | "home"
  | "calendar"
  | "book"
  | "target"
  | "sparkles"
  | "settings";

type GrupoMenuProps = {
  id: GrupoId;
  titulo: string;
  icone: IconeMenu;
  ativo: boolean;
  aberto: boolean;
  onToggle: (id: GrupoId) => void;
  children: ReactNode;
};

const ROTAS_GRUPOS: Record<GrupoId, string[]> = {
  planejamento: [
    "/meu-edital",
    "/cronograma-ia",
    "/plano",
    "/plano-estudos",
    "/calendario",
  ],
  estudos: [
    "/central-estudos",
    "/materiais",
    "/estudos",
    "/conteudos",
    "/revisoes",
    "/historico-sessoes",
    "/estatisticas-sessoes",
  ],
  pratica: [
    "/questoes",
    "/registrar-questoes",
    "/banco-questoes",
    "/simulados",
    "/resolver-simulado-ia",
    "/gerar-simulado-ia",
    "/estatisticas-simulado-ia",
    "/desempenho",
    "/historico",
    "/estatisticas",
  ],
  sistema: [
    "/conquistas",
    "/ranking",
    "/backup",
    "/configuracoes",
    "/admin",
  ],
};

function rotaPertenceAoGrupo(pathname: string, id: GrupoId) {
  return ROTAS_GRUPOS[id].some(
    (rota) =>
      pathname === rota ||
      pathname.startsWith(`${rota}/`)
  );
}

function obterGrupoDaRota(pathname: string): GrupoId | null {
  const grupos = Object.keys(ROTAS_GRUPOS) as GrupoId[];
  return grupos.find((id) => rotaPertenceAoGrupo(pathname, id)) ?? null;
}

export default function Sidebar() {
  const { administrador } = useAdminStatus();
  const location = useLocation();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [grupoAberto, setGrupoAberto] = useState<GrupoId | null>(() =>
    obterGrupoDaRota(location.pathname)
  );

  useEffect(() => {
    setMenuMobileAberto(false);
    setGrupoAberto(obterGrupoDaRota(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    if (!menuMobileAberto) {
      document.body.classList.remove("menu-mobile-aberto");
      return;
    }

    document.body.classList.add("menu-mobile-aberto");

    return () => {
      document.body.classList.remove("menu-mobile-aberto");
    };
  }, [menuMobileAberto]);

  function alternarGrupo(id: GrupoId) {
    setGrupoAberto((atual) => (atual === id ? null : id));
  }

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        aria-label={menuMobileAberto ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuMobileAberto}
        onClick={() => setMenuMobileAberto((aberto) => !aberto)}
      >
        {menuMobileAberto ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {menuMobileAberto && (
        <button
          type="button"
          className="sidebar-mobile-overlay"
          aria-label="Fechar menu"
          onClick={() => setMenuMobileAberto(false)}
        />
      )}

      <aside className={`sidebar ${menuMobileAberto ? "sidebar-mobile-aberta" : ""}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icone">PM</div>

          <div>
            <strong>PMPE</strong>
            <span>Study Pro</span>
          </div>
        </div>

        <nav className="sidebar-menu" aria-label="Navegação principal">
          <div className="sidebar-inicio">
            <span className="sidebar-secao-label">VISÃO GERAL</span>
            <ItemMenu
              to="/"
              icone="home"
              texto="Dashboard"
              final
            />
          </div>

          <GrupoMenu
            id="planejamento"
            titulo="Planejamento"
            icone="calendar"
            ativo={rotaPertenceAoGrupo(location.pathname, "planejamento")}
            aberto={grupoAberto === "planejamento"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/meu-edital" texto="Meu Edital" />
            <ItemMenu to="/plano" texto="Plano de Estudos" />
            <ItemMenu to="/calendario" texto="Calendário" />
            <ItemMenu to="/cronograma-ia" texto="Cronograma IA" />
          </GrupoMenu>

          <GrupoMenu
            id="estudos"
            titulo="Estudos"
            icone="book"
            ativo={rotaPertenceAoGrupo(location.pathname, "estudos")}
            aberto={grupoAberto === "estudos"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/central-estudos" texto="Central de Estudos" />
            <ItemMenu to="/estudos" texto="Conteúdos" />
            <ItemMenu to="/materiais" texto="Materiais" />
            <ItemMenu to="/revisoes" texto="Revisões" />
          </GrupoMenu>

          <GrupoMenu
            id="pratica"
            titulo="Prática"
            icone="target"
            ativo={rotaPertenceAoGrupo(location.pathname, "pratica")}
            aberto={grupoAberto === "pratica"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/questoes" texto="Questões" />
            <ItemMenu to="/simulados" texto="Simulados" />
            <ItemMenu to="/desempenho" texto="Desempenho" />
            <ItemMenu to="/estatisticas" texto="Estatísticas" />
          </GrupoMenu>

          <ItemMenu
            to="/inteligencia"
            icone="sparkles"
            texto="Inteligência"
          />

          <GrupoMenu
            id="sistema"
            titulo="Sistema"
            icone="settings"
            ativo={rotaPertenceAoGrupo(location.pathname, "sistema")}
            aberto={grupoAberto === "sistema"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/ranking" texto="Ranking" />
            <ItemMenu to="/conquistas" texto="Conquistas" />
            <ItemMenu to="/backup" texto="Backup e Segurança" />
            <ItemMenu to="/configuracoes" texto="Configurações" />

            {administrador && (
              <ItemMenu to="/admin" texto="Administração" />
            )}
          </GrupoMenu>
        </nav>

        <div className="sidebar-rodape">
          <span>Foco atual</span>
          <strong>PMPE</strong>
          <small>Planejamento tático</small>
        </div>
      </aside>
    </>
  );
}

function GrupoMenu({
  id,
  titulo,
  icone,
  ativo,
  aberto,
  onToggle,
  children,
}: GrupoMenuProps) {
  return (
    <div
      className={`sidebar-grupo ${
        ativo ? "sidebar-grupo-ativo" : ""
      } ${aberto ? "sidebar-grupo-aberto" : ""}`}
    >
      <button
        type="button"
        className="sidebar-grupo-botao"
        aria-expanded={aberto}
        onClick={() => onToggle(id)}
      >
        <span className="sidebar-grupo-identidade">
          <span className="sidebar-grupo-icone" aria-hidden="true">
            <MenuIcon nome={icone} />
          </span>
          <span>{titulo}</span>
        </span>

        <span
          className={`sidebar-seta ${
            aberto ? "sidebar-seta-aberta" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {aberto && (
        <div className="sidebar-submenu">
          {children}
        </div>
      )}
    </div>
  );
}

type ItemMenuProps = {
  to: string;
  icone?: IconeMenu;
  texto: string;
  final?: boolean;
};

function ItemMenu({
  to,
  icone,
  texto,
  final = false,
}: ItemMenuProps) {
  return (
    <NavLink
      to={to}
      end={final}
      className={({ isActive }) =>
        `sidebar-link ${
          isActive ? "sidebar-link-ativo" : ""
        } ${icone ? "sidebar-link-com-icone" : "sidebar-link-subitem"}`
      }
    >
      {icone && (
        <span className="sidebar-link-icone" aria-hidden="true">
          <MenuIcon nome={icone} />
        </span>
      )}

      <span className="sidebar-link-texto">
        {texto}
      </span>
    </NavLink>
  );
}

function MenuIcon({ nome }: { nome: IconeMenu }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    focusable: false,
    "aria-hidden": true,
  };

  if (nome === "home") {
    return (
      <svg {...props}>
        <path d="M3.5 10.5L12 3.8l8.5 6.7" />
        <path d="M5.5 9.3V20h13V9.3" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    );
  }

  if (nome === "calendar") {
    return (
      <svg {...props}>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M7.5 3.5V7M16.5 3.5V7M3.5 9h17" />
        <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
      </svg>
    );
  }

  if (nome === "book") {
    return (
      <svg {...props}>
        <path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H11v16H6.2A2.2 2.2 0 0 0 4 21.2z" />
        <path d="M20 5.2A2.2 2.2 0 0 0 17.8 3H13v16h4.8a2.2 2.2 0 0 1 2.2 2.2z" />
      </svg>
    );
  }

  if (nome === "target") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1.2" />
      </svg>
    );
  }

  if (nome === "sparkles") {
    return (
      <svg {...props}>
        <path d="M12 3.5l1.2 3.3L16.5 8l-3.3 1.2L12 12.5l-1.2-3.3L7.5 8l3.3-1.2z" />
        <path d="M18 13.5l.8 2.1 2.2.9-2.2.8L18 19.5l-.8-2.2-2.2-.8 2.2-.9z" />
        <path d="M5.5 13l.6 1.6 1.7.7-1.7.6-.6 1.7-.7-1.7-1.6-.6 1.6-.7z" />
      </svg>
    );
  }

  return (
    <svg {...props}>
      <path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h9M17 18h3" />
      <circle cx="13" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="18" r="2" />
    </svg>
  );
}
