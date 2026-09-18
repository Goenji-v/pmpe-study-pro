import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FolderOpen,
  GraduationCap,
  Home,
  Library,
  Menu,
  RotateCcw,
  Route,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";

import "./Sidebar.css";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import { PARCERIAS_VISIVEIS } from "../../config/recursos";

type Icone = ComponentType<{ size?: number; strokeWidth?: number }>;

type GrupoId =
  | "planejamento"
  | "estudos"
  | "pratica"
  | "parceiro";

type GrupoMenuProps = {
  id: GrupoId;
  titulo: string;
  icone: Icone;
  ativo: boolean;
  aberto: boolean;
  onToggle: (id: GrupoId) => void;
  children: ReactNode;
};

type ItemMenuProps = {
  to: string;
  icone?: Icone;
  texto: string;
  final?: boolean;
  onNavigate: () => void;
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
    "/cursos",
    "/curso-mentoria",
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
  ],
  parceiro: [
    "/parceiro",
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
  const { contexto } = useContextoComercial();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [grupoAberto, setGrupoAberto] = useState<GrupoId | null>(() =>
    obterGrupoDaRota(location.pathname)
  );

  const temAreaParceiro =
    PARCERIAS_VISIVEIS &&
    (
      contexto?.papel === "proprietario" ||
      contexto?.papel === "gestor" ||
      contexto?.papel === "professor"
    );

  useEffect(() => {
    if (location.pathname === "/estatisticas") {
      navigate("/desempenho", { replace: true });
      return;
    }

    setMenuMobileAberto(false);
    setGrupoAberto(obterGrupoDaRota(location.pathname));
  }, [location.pathname, navigate]);

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

  function fecharMenuMobile() {
    setMenuMobileAberto(false);
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
        {menuMobileAberto ? <X size={21} /> : <Menu size={21} />}
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
          <img
            className="sidebar-logo-imagem sidebar-logo-completa"
            src="/assets/studio-pro-logo.svg"
            alt="Studio Pro"
          />
        </div>

        <nav className="sidebar-menu" aria-label="Navegação principal">
          <div className="sidebar-inicio">
            <span className="sidebar-secao-label">VISÃO GERAL</span>
            <ItemMenu
              to="/"
              icone={Home}
              texto="Dashboard"
              final
              onNavigate={fecharMenuMobile}
            />
          </div>

          <GrupoMenu
            id="planejamento"
            titulo="Planejamento"
            icone={CalendarDays}
            ativo={rotaPertenceAoGrupo(location.pathname, "planejamento")}
            aberto={grupoAberto === "planejamento"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/meu-edital" texto="Meu Edital" icone={FileText} onNavigate={fecharMenuMobile} />
            <ItemMenu to="/plano" texto="Plano de Estudos" icone={Route} onNavigate={fecharMenuMobile} />
            <ItemMenu to="/calendario" texto="Calendário" icone={CalendarDays} onNavigate={fecharMenuMobile} />
            <ItemMenu to="/cronograma-ia" texto="Cronograma IA" icone={Sparkles} onNavigate={fecharMenuMobile} />
          </GrupoMenu>

          <GrupoMenu
            id="estudos"
            titulo="Estudos"
            icone={BookOpen}
            ativo={rotaPertenceAoGrupo(location.pathname, "estudos")}
            aberto={grupoAberto === "estudos"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/central-estudos" texto="Central de Estudos" icone={BookOpen} onNavigate={fecharMenuMobile} />
            {PARCERIAS_VISIVEIS && contexto?.papel === "aluno" && (
              <ItemMenu to="/curso-mentoria" texto="Curso do Parceiro" icone={UsersRound} onNavigate={fecharMenuMobile} />
            )}
            <ItemMenu to="/cursos" texto="Meus Cursos" icone={GraduationCap} onNavigate={fecharMenuMobile} />
            <ItemMenu to="/estudos" texto="Conteúdos" icone={Library} onNavigate={fecharMenuMobile} />
            <ItemMenu to="/materiais" texto="Materiais" icone={FolderOpen} onNavigate={fecharMenuMobile} />
            <ItemMenu to="/revisoes" texto="Revisões" icone={RotateCcw} onNavigate={fecharMenuMobile} />
          </GrupoMenu>

          <GrupoMenu
            id="pratica"
            titulo="Prática"
            icone={Target}
            ativo={rotaPertenceAoGrupo(location.pathname, "pratica")}
            aberto={grupoAberto === "pratica"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/questoes" texto="Questões" icone={ClipboardCheck} onNavigate={fecharMenuMobile} />
            <ItemMenu to="/simulados" texto="Simulados" icone={Target} onNavigate={fecharMenuMobile} />
            <ItemMenu to="/desempenho" texto="Desempenho" icone={TrendingUp} onNavigate={fecharMenuMobile} />
          </GrupoMenu>

          <ItemMenu
            to="/inteligencia"
            icone={Sparkles}
            texto="Inteligência"
            onNavigate={fecharMenuMobile}
          />

          {temAreaParceiro && (
            <GrupoMenu
              id="parceiro"
              titulo="Área do Parceiro"
              icone={UsersRound}
              ativo={rotaPertenceAoGrupo(location.pathname, "parceiro")}
              aberto={grupoAberto === "parceiro"}
              onToggle={alternarGrupo}
            >
              <ItemMenu to="/parceiro" texto="Resumo das turmas" icone={UsersRound} final onNavigate={fecharMenuMobile} />
              <ItemMenu to="/parceiro/cursos" texto="Meu curso" icone={GraduationCap} onNavigate={fecharMenuMobile} />
              <ItemMenu to="/parceiro/simulados" texto="Simulados" icone={Target} onNavigate={fecharMenuMobile} />
            </GrupoMenu>
          )}

          {PARCERIAS_VISIVEIS && contexto?.papel === "aluno" && (
            <ItemMenu
              to="/meu-acesso"
              icone={UsersRound}
              texto="Meu acesso"
              onNavigate={fecharMenuMobile}
            />
          )}
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
  icone: Icone,
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
            <Icone size={17} strokeWidth={1.8} />
          </span>
          <span>{titulo}</span>
        </span>

        <ChevronRight
          className="sidebar-chevron"
          size={15}
          strokeWidth={1.8}
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

function ItemMenu({
  to,
  icone: Icone,
  texto,
  final = false,
  onNavigate,
}: ItemMenuProps) {
  return (
    <NavLink
      to={to}
      end={final}
      onClick={onNavigate}
      className={({ isActive }) =>
        `sidebar-link ${
          isActive ? "sidebar-link-ativo" : ""
        } ${Icone ? "sidebar-link-com-icone" : "sidebar-link-subitem"}`
      }
    >
      {Icone && (
        <span className="sidebar-link-icone" aria-hidden="true">
          <Icone size={17} strokeWidth={1.8} />
        </span>
      )}

      <span className="sidebar-link-texto">
        {texto}
      </span>
    </NavLink>
  );
}
