import {
  useEffect,
  useState,
} from "react";

import {
  NavLink,
  useLocation,
} from "react-router-dom";

import "./Sidebar.css";

import {
  useAdminStatus,
} from "../../hooks/useAdminStatus";

type GrupoMenuProps = {
  titulo: string;
  icone: string;
  rotas: string[];
  children: React.ReactNode;
};

export default function Sidebar() {
  const { administrador } = useAdminStatus();
  const location = useLocation();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  useEffect(() => {
    setMenuMobileAberto(false);
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

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        aria-label={menuMobileAberto ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuMobileAberto}
        onClick={() => setMenuMobileAberto((aberto) => !aberto)}
      >
        <span aria-hidden="true">{menuMobileAberto ? "✕" : "☰"}</span>
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
              icone="⌂"
              texto="Dashboard"
              final
            />
          </div>

          <GrupoMenu
            titulo="Planejamento"
            icone="▦"
            rotas={[
              "/cronograma-ia",
              "/plano",
              "/plano-estudos",
              "/calendario",
            ]}
          >
            <ItemMenu to="/plano" texto="Plano de Estudos" />
            <ItemMenu to="/calendario" texto="Calendário" />
            <ItemMenu to="/cronograma-ia" texto="Cronograma IA" />
          </GrupoMenu>

          <GrupoMenu
            titulo="Estudos"
            icone="▤"
            rotas={[
              "/central-estudos",
              "/materiais",
              "/estudos",
              "/conteudos",
              "/revisoes",
            ]}
          >
            <ItemMenu to="/central-estudos" texto="Central de Estudos" />
            <ItemMenu to="/estudos" texto="Conteúdos" />
            <ItemMenu to="/materiais" texto="Materiais" />
            <ItemMenu to="/revisoes" texto="Revisões" />
          </GrupoMenu>

          <GrupoMenu
            titulo="Prática"
            icone="◎"
            rotas={[
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
            ]}
          >
            <ItemMenu to="/questoes" texto="Questões" />
            <ItemMenu to="/simulados" texto="Simulados" />
            <ItemMenu to="/desempenho" texto="Desempenho" />
          </GrupoMenu>

          <GrupoMenu
            titulo="Inteligência"
            icone="✦"
            rotas={[
              "/inteligencia",
              "/relatorio-inteligente",
              "/ia-coach",
            ]}
          >
            <ItemMenu to="/inteligencia" texto="Central de Inteligência" />
            <ItemMenu to="/relatorio-inteligente" texto="Relatório Inteligente" />
            <ItemMenu to="/ia-coach" texto="IA Coach" />
          </GrupoMenu>

          <GrupoMenu
            titulo="Sistema"
            icone="⚙"
            rotas={[
              "/conquistas",
              "/ranking",
              "/backup",
              "/configuracoes",
              "/admin",
            ]}
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
  titulo,
  icone,
  rotas,
  children,
}: GrupoMenuProps) {
  const location = useLocation();

  const possuiRotaAtiva = rotas.some(
    (rota) =>
      location.pathname === rota ||
      location.pathname.startsWith(`${rota}/`)
  );

  const [aberto, setAberto] = useState(possuiRotaAtiva);

  useEffect(() => {
    setAberto(possuiRotaAtiva);
  }, [location.pathname, possuiRotaAtiva]);

  return (
    <div
      className={`sidebar-grupo ${
        possuiRotaAtiva ? "sidebar-grupo-ativo" : ""
      }`}
    >
      <button
        type="button"
        className="sidebar-grupo-botao"
        aria-expanded={aberto}
        onClick={() => setAberto((valor) => !valor)}
      >
        <span className="sidebar-grupo-identidade">
          <span className="sidebar-grupo-icone" aria-hidden="true">
            {icone}
          </span>
          <span>{titulo}</span>
        </span>

        <span
          className={`sidebar-seta ${
            aberto ? "sidebar-seta-aberta" : ""
          }`}
          aria-hidden="true"
        >
          ›
        </span>
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
  icone?: string;
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
          {icone}
        </span>
      )}

      <span className="sidebar-link-texto">
        {texto}
      </span>
    </NavLink>
  );
}
