import { useEffect, useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Home,
  Menu,
  RotateCcw,
  Route,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";

import "./Sidebar.css";
import { useContextoComercial } from "../../hooks/useContextoComercial";

type Icone = ComponentType<{ size?: number; strokeWidth?: number }>;

type Item = {
  to: string;
  texto: string;
  icone: Icone;
  final?: boolean;
};

const itensPrincipais: Item[] = [
  { to: "/", texto: "Dashboard", icone: Home, final: true },
  { to: "/plano", texto: "Meu Plano", icone: Trophy },
  { to: "/meu-edital", texto: "Meu Edital", icone: FileText },
  { to: "/central-estudos", texto: "Estudos", icone: BookOpen },
  { to: "/cursos", texto: "Meus Cursos", icone: GraduationCap },
  { to: "/questoes", texto: "Questões", icone: ClipboardCheck },
  { to: "/revisoes", texto: "Revisões", icone: RotateCcw },
  { to: "/simulados", texto: "Simulados", icone: Target },
  { to: "/desempenho", texto: "Desempenho", icone: BarChart3 },
  { to: "/materiais", texto: "Materiais", icone: ShieldCheck },
  { to: "/cronograma-ia", texto: "Cronograma", icone: CalendarDays },
  { to: "/inteligencia", texto: "Inteligência", icone: Sparkles },
];

export default function Sidebar() {
  const { contexto } = useContextoComercial();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  useEffect(() => {
    if (!menuMobileAberto) {
      document.body.classList.remove("menu-mobile-aberto");
      return;
    }

    document.body.classList.add("menu-mobile-aberto");
    return () => document.body.classList.remove("menu-mobile-aberto");
  }, [menuMobileAberto]);

  const rotaMentoria = contexto?.papel === "aluno" ? "/curso-mentoria" : "/parceiro/mentoria";
  const podeVerMentoria = Boolean(
    contexto?.papel === "aluno" ||
      contexto?.papel === "proprietario" ||
      contexto?.papel === "gestor" ||
      contexto?.papel === "professor"
  );

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

      <aside className={`sidebar studio-premium-sidebar ${menuMobileAberto ? "sidebar-mobile-aberta" : ""}`}>
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

        <nav className="sidebar-menu studio-premium-nav" aria-label="Navegação principal">
          {itensPrincipais.map((item) => (
            <ItemMenu key={item.to} {...item} onNavigate={() => setMenuMobileAberto(false)} />
          ))}

          {podeVerMentoria && (
            <ItemMenu
              to={rotaMentoria}
              texto="Mentoria"
              icone={UsersRound}
              onNavigate={() => setMenuMobileAberto(false)}
            />
          )}

          {(contexto?.papel === "proprietario" || contexto?.papel === "gestor" || contexto?.papel === "professor") && (
            <ItemMenu
              to="/parceiro"
              texto="Painel do parceiro"
              icone={Route}
              onNavigate={() => setMenuMobileAberto(false)}
            />
          )}
        </nav>

        <div className="studio-sidebar-bottom">
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
          <div className="studio-sidebar-quote">
            <span>DISCIPLINA TRANSFORMA<br />PLANOS EM REALIDADE.</span>
            <i />
          </div>
        </div>
      </aside>
    </>
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
        `sidebar-link studio-premium-link ${isActive ? "sidebar-link-ativo" : ""}`
      }
    >
      <span className="sidebar-link-icone" aria-hidden="true">
        <Icone size={19} strokeWidth={1.9} />
      </span>
      <span className="sidebar-link-texto">{texto}</span>
    </NavLink>
  );
}
