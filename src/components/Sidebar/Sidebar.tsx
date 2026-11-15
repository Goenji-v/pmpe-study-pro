import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import {
  AccessIcon,
  AIIcon,
  BookIcon,
  CalendarIcon,
  CoursesIcon,
  DashboardIcon,
  EditalIcon,
  FocusIcon,
  IntelligenceIcon,
  LibraryIcon,
  MaterialsIcon,
  PerformanceIcon,
  PlanningIcon,
  PracticeIcon,
  QuestionsIcon,
  ReviewsIcon,
  SettingsIcon,
  SimuladosIcon,
  StudyPlanIcon,
} from "../StudyProIcons/StudyProIcons";

import "./Sidebar.css";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import { PARCERIAS_VISIVEIS } from "../../config/recursos";

type Icone = ComponentType<{ size?: number; strokeWidth?: number }>;
type GrupoId = "estudos" | "pratica" | "planejamento" | "progresso" | "conta";

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
  estudos: [
    "/central-estudos", "/cursos", "/curso-mentoria", "/materiais",
    "/estudos", "/conteudos", "/buscar", "/pesquisa", "/search", "/revisoes",
  ],
  pratica: [
    "/questoes", "/registrar-questoes", "/banco-questoes",
    "/simulados", "/simulados-oficiais", "/simulado-oficial",
    "/simulado-pdf", "/resolver-simulado-ia", "/caderno-questoes",
    "/gerar-simulado-ia", "/estatisticas-simulado-ia",
  ],
  planejamento: [
    "/meu-edital", "/plano", "/plano-estudos", "/calendario", "/cronograma-ia",
  ],
  progresso: [
    "/desempenho", "/estatisticas", "/resumo-semanal",
    "/inteligencia", "/historico", "/historico-sessoes", "/estatisticas-sessoes",
  ],
  conta: [
    "/perfil", "/ranking", "/conquistas", "/loja", "/backup", "/configuracoes",
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
  const navigate = useNavigate();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [grupoAberto, setGrupoAberto] = useState<GrupoId | null>(() =>
    obterGrupoDaRota(location.pathname)
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
    return () => document.body.classList.remove("menu-mobile-aberto");
  }, [menuMobileAberto]);

  useEffect(() => {
    if (!menuMobileAberto) return;

    function fecharComEscape(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      setMenuMobileAberto(false);
    }

    function fecharAoSairDoMobile(evento: MediaQueryListEvent) {
      if (evento.matches) {
        setMenuMobileAberto(false);
      }
    }

    const desktop = window.matchMedia("(min-width: 901px)");
    window.addEventListener("keydown", fecharComEscape);
    desktop.addEventListener("change", fecharAoSairDoMobile);

    return () => {
      window.removeEventListener("keydown", fecharComEscape);
      desktop.removeEventListener("change", fecharAoSairDoMobile);
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
        aria-controls="sidebar-principal"
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

      <aside
        id="sidebar-principal"
        className={`sidebar sidebar-jornada ${menuMobileAberto ? "sidebar-mobile-aberta" : ""}`}
      >
        <div className="sidebar-logo">
          <img
            className="sidebar-logo-oficial"
            src="/assets/study-pro-wordmark-v7.png"
            alt="Study Pro"
            draggable={false}
          />
        </div>

        <nav className="sidebar-menu sidebar-menu-v2" aria-label="Navegação principal">
          <div className="sidebar-inicio">
            <span className="sidebar-secao-label">SUA JORNADA</span>
            <ItemMenu
              to="/"
              texto="Início"
              icone={DashboardIcon}
              final
              onNavigate={() => setMenuMobileAberto(false)}
            />
          </div>

          <GrupoMenu
            id="estudos"
            titulo="Meus Estudos"
            icone={BookIcon}
            ativo={rotaPertenceAoGrupo(location.pathname, "estudos")}
            aberto={grupoAberto === "estudos"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/central-estudos" texto="Central de Estudos" icone={FocusIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/estudos" texto="Conteúdos" icone={LibraryIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/materiais" texto="Materiais" icone={MaterialsIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/revisoes" texto="Revisões" icone={ReviewsIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/cursos" texto="Meus Cursos" icone={CoursesIcon} onNavigate={() => setMenuMobileAberto(false)} />
            {PARCERIAS_VISIVEIS && contexto?.papel === "aluno" && (
              <ItemMenu to="/curso-mentoria" texto="Curso do Parceiro" icone={CoursesIcon} onNavigate={() => setMenuMobileAberto(false)} />
            )}
          </GrupoMenu>

          <GrupoMenu
            id="pratica"
            titulo="Praticar"
            icone={PracticeIcon}
            ativo={rotaPertenceAoGrupo(location.pathname, "pratica")}
            aberto={grupoAberto === "pratica"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/questoes" texto="Questões" icone={QuestionsIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/simulados" texto="Simulados" icone={SimuladosIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/gerar-simulado-ia" texto="Treino IA" icone={AIIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/resolver-simulado-ia" texto="Meus Simulados IA" icone={SimuladosIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/banco-questoes" texto="Banco de Questões" icone={QuestionsIcon} onNavigate={() => setMenuMobileAberto(false)} />
          </GrupoMenu>

          <GrupoMenu
            id="planejamento"
            titulo="Planejamento"
            icone={PlanningIcon}
            ativo={rotaPertenceAoGrupo(location.pathname, "planejamento")}
            aberto={grupoAberto === "planejamento"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/plano" texto="Plano Tático" icone={StudyPlanIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/calendario" texto="Calendário" icone={CalendarIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/meu-edital" texto="Meu Edital" icone={EditalIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/cronograma-ia" texto="Cronograma IA" icone={AIIcon} onNavigate={() => setMenuMobileAberto(false)} />
          </GrupoMenu>

          <GrupoMenu
            id="progresso"
            titulo="Meu Progresso"
            icone={PerformanceIcon}
            ativo={rotaPertenceAoGrupo(location.pathname, "progresso")}
            aberto={grupoAberto === "progresso"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/desempenho" texto="Desempenho" icone={PerformanceIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/inteligencia" texto="Inteligência e IA Coach" icone={IntelligenceIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/historico" texto="Histórico de Questões" icone={QuestionsIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/historico-sessoes" texto="Sessões de Estudo" icone={BookIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/resumo-semanal" texto="Resumo da Semana" icone={CalendarIcon} onNavigate={() => setMenuMobileAberto(false)} />
          </GrupoMenu>

          <div className="sidebar-menu-divisor"><span>OUTRAS ÁREAS</span></div>
          <GrupoMenu
            id="conta"
            titulo="Minha Conta"
            icone={AccessIcon}
            ativo={rotaPertenceAoGrupo(location.pathname, "conta")}
            aberto={grupoAberto === "conta"}
            onToggle={alternarGrupo}
          >
            <ItemMenu to="/perfil" texto="Perfil" icone={AccessIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/conquistas" texto="Conquistas" icone={StudyPlanIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/ranking" texto="Ranking" icone={PerformanceIcon} onNavigate={() => setMenuMobileAberto(false)} />
            <ItemMenu to="/loja" texto="Loja" icone={CoursesIcon} onNavigate={() => setMenuMobileAberto(false)} />
          </GrupoMenu>
        </nav>

        <div className="sidebar-rodape-acoes">
          {PARCERIAS_VISIVEIS && contexto?.papel === "aluno" && (
            <ItemMenu
              to="/meu-acesso"
              texto="Meu acesso"
              icone={AccessIcon}
              onNavigate={() => setMenuMobileAberto(false)}
            />
          )}
          <ItemMenu
            to="/configuracoes"
            texto="Configurações"
            icone={SettingsIcon}
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
