import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
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
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";

import "./Sidebar.css";
import { useContextoComercial } from "../../hooks/useContextoComercial";

type Icone = ComponentType<{ size?: number; strokeWidth?: number }>;
type GrupoId = "planejamento" | "estudos" | "pratica";

type Item = {
  to: string;
  texto: string;
  icone?: Icone;
  final?: boolean;
};

type GrupoMenuProps = {
  id: GrupoId;
  titulo: string;
  icone: Icone;
  ativo: boolean;
  aberto: boolean;
  onToggle: (id: GrupoId) => void;
  children: ReactNode;
};

const ROTAS_GRUPOS: Record<GrupoId, string[]> = {
  planejamento: [
    "/meu-edital",
    "/plano",
    "/plano-estudos",
    "/calendario",
    "/cronograma-ia",
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
    "/estatisticas",
  ],
};

function rotaPertenceAoGrupo(pathname: string, id: GrupoId) {
  return ROTAS_GRUPOS[id].some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  );
}

function obterGrupoDaRota(pathname: string): GrupoId | null {
  const grupos = Object.keys(ROTAS_GRUPOS) as GrupoId[];
  return grupos.find((id) => rotaPertenceAoGrupo(pathname, id)) ?? null;
}

export default function Sidebar() {
  const { contexto } = useContextoComercial();
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
    return () => document.body.classList.remove("menu-mobile-aberto");
  }, [menuMobileAberto]);

  function alternarGrupo(id: GrupoId) {
    setGrupoAberto((atual) => (atual === id ? null : id));
  }

  const podeVerParceiro =
    contexto?.papel === "proprietario" ||
    contexto?.papel === "gestor" ||
    contexto?.papel === "professor";

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        aria-label={menuMobileAberto ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuMobileAberto}
        onClick={() => setMenuMobileAberto((aberto) => !aberto)}
      >
        {menuMobileAberto ? <X size={22} /> : <Menu size={22} />}
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
        <div className="sidebar-logo studio-premium-brand">
          <div className="studio-brand-shield" aria-hidden="true">
            <svg viewBox="0 0 72 82">
              <defs>
                <linearGradient id="studioSidebarGold" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#fff0a7" />
                  <stop offset="0.28" stopColor="#f8c54d" />
                  <stop offset="0.62" stopColor="#a96808" />
                  <stop offset="1" stopColor="#f8d77b" />
                </linearGradient>
              </defs>
              <path d="M36 3 66 14v23c0 20-12 33-30 42C18 70 6 57 6 37V14L36 3Z" fill="#07172b" stroke="url(#studioSidebarGold)" strokeWidth="3" />
              <path d="M36 10 59 18v18c0 15-8 26-23 34-15-8-23-19-23-34V18l23-8Z" fill="none" stroke="url(#studioSidebarGold)" strokeWidth="1.6" opacity=".9" />
              <text x="36" y="50" textAnchor="middle" fontSize="34" fontWeight="800" fill="url(#studioSidebarGold)" fontFamily="Georgia, serif">S</text>
            </svg>
          </div>
          <div className="studio-brand-copy">
            <strong>STUDIO <span>PRO</span></strong>
            <small>ESTUDO HOJE. CONQUISTA SEMPRE.</small>
          </div>
        </div>

        <nav className="sidebar-menu" aria-label="Navegação principal">
          <div className="sidebar-inicio">
            <span className="sidebar-secao-label">VISÃO GERAL</span>
            <ItemMenu
              to="/"
              texto="Dashboard"
              icone={Home}
              final
              onNavigate={() => setMenuMobileAberto(false)}
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
            <ItemMenu to="/meu-edital" texto="Meu Edital" icone={FileText} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/plano" texto="Plano de Estudos" icone={Route} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/calendario" texto="Calendário" icone={CalendarDays} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/cronograma-ia" texto="Cronograma IA" icone={Sparkles} onNavigate={() => setMenuMobileAberto(false)} />
          </GrupoMenu>

          <GrupoMenu
            id="estudos"
            titulo="Estudos"
            icone={BookOpen}
            ativo={rotaPertenceAoGrupo(location.pathname, "estudos")}
            aberto={grupoAberto === "estudos"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/central-estudos" texto="Central de Estudos" icone={BookOpen} onNavigate={() => setMenuMobileAberto(false)} />
            {contexto?.papel === "aluno" && (
              <ItemMenu to="/curso-mentoria" texto="Curso da Mentoria" icone={UsersRound} onNavigate={() => setMenuMobileAberto(false)} />
            )}
            <ItemMenu to="/cursos" texto="Meus Cursos" icone={GraduationCap} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/estudos" texto="Conteúdos" icone={Library} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/materiais" texto="Materiais" icone={FolderOpen} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/revisoes" texto="Revisões" icone={RotateCcw} onNavigate={() => setMenuMobileAberto(false)} />
          </GrupoMenu>

          <GrupoMenu
            id="pratica"
            titulo="Prática"
            icone={Target}
            ativo={rotaPertenceAoGrupo(location.pathname, "pratica")}
            aberto={grupoAberto === "pratica"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/questoes" texto="Questões" icone={ClipboardCheck} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/simulados" texto="Simulados" icone={Target} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/desempenho" texto="Desempenho" icone={TrendingUp} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/estatisticas" texto="Estatísticas" icone={BarChart3} onNavigate={() => setMenuMobileAberto(false)} />
          </GrupoMenu>

          <ItemMenu
            to="/inteligencia"
            texto="Inteligência"
            icone={Sparkles}
            onNavigate={() => setMenuMobileAberto(false)}
          />

          {podeVerParceiro && (
            <div className="sidebar-partner-links">
              <ItemMenu to="/parceiro" texto="Painel do parceiro" icone={UsersRound} onNavigate={() => setMenuMobileAberto(false)} />
              <ItemMenu to="/parceiro/mentoria" texto="Trilha da mentoria" icone={Route} onNavigate={() => setMenuMobileAberto(false)} />
              <ItemMenu to="/parceiro/cursos" texto="Curso do professor" icone={GraduationCap} onNavigate={() => setMenuMobileAberto(false)} />
              <ItemMenu to="/parceiro/simulados" texto="Simulados do professor" icone={Target} onNavigate={() => setMenuMobileAberto(false)} />
            </div>
          )}
        </nav>

        <div className="sidebar-rodape-acoes">
          {contexto?.papel === "aluno" && (
            <ItemMenu
              to="/meu-acesso"
              texto="Meu acesso"
              icone={ShieldCheck}
              onNavigate={() => setMenuMobileAberto(false)}
            />
          )}
          <ItemMenu
            to="/configuracoes"
            texto="Configurações"
            icone={Settings}
            onNavigate={() => setMenuMobileAberto(false)}
          />
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
    <div className={`sidebar-grupo ${ativo ? "sidebar-grupo-ativo" : ""} ${aberto ? "sidebar-grupo-aberto" : ""}`}>
      <button
        type="button"
        className="sidebar-grupo-botao"
        aria-expanded={aberto}
        onClick={() => onToggle(id)}
      >
        <span className="sidebar-grupo-identidade">
          <span className="sidebar-grupo-icone" aria-hidden="true">
            <Icone size={18} strokeWidth={1.8} />
          </span>
          <span>{titulo}</span>
        </span>
        <ChevronRight className="sidebar-chevron" size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>

      {aberto && <div className="sidebar-submenu">{children}</div>}
    </div>
  );
}

function ItemMenu({
  to,
  texto,
  icone: Icone,
  final = false,
  onNavigate,
}: Item & { onNavigate: () => void }) {
  return (
    <NavLink
      to={to}
      end={final}
      onClick={onNavigate}
      className={({ isActive }) =>
        `sidebar-link ${isActive ? "sidebar-link-ativo" : ""} ${Icone ? "sidebar-link-com-icone" : "sidebar-link-subitem"}`
      }
    >
      {Icone && (
        <span className="sidebar-link-icone" aria-hidden="true">
          <Icone size={18} strokeWidth={1.8} />
        </span>
      )}
      <span className="sidebar-link-texto">{texto}</span>
    </NavLink>
  );
}
