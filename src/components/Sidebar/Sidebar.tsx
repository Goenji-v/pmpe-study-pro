import {
  useState,
} from "react";

import {
  NavLink,
  useLocation,
} from "react-router-dom";

import "./Sidebar.css";

type GrupoMenuProps = {
  titulo: string;
  icone: string;
  rotas: string[];
  abertoInicialmente?: boolean;
  children: React.ReactNode;
};

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icone">
          PM
        </div>

        <div>
          <strong>PMPE</strong>
          <span>Study Pro</span>
        </div>
      </div>

      <nav className="sidebar-menu">
        <div className="sidebar-principal">
          <ItemMenu
            to="/"
            icone="🏠"
            texto="Dashboard"
            final
          />

<ItemMenu
  to="/cronograma-ia"
  icone="🧠"
  texto="Cronograma IA"
/>

          <ItemMenu
            to="/plano"
            icone="📅"
            texto="Plano de Estudos"
          />

          <ItemMenu
            to="/calendario"
            icone="🗓️"
            texto="Calendário"
          />
        </div>

        <GrupoMenu
          titulo="Estudos"
          icone="📚"
          rotas={[
            "/central-estudos",
            "/estudos",
            "/materiais",
            "/revisoes",
          ]}
          abertoInicialmente
        >
          <ItemMenu
            to="/central-estudos"
            icone="⏱"
            texto="Central de Estudos"
          />

          <ItemMenu
            to="/materiais"
            icone="📚"
            texto="Centro de Materiais"
          />

          <ItemMenu
            to="/estudos"
            icone="📖"
            texto="Conteúdos"
          />

          <ItemMenu
            to="/revisoes"
            icone="🔁"
            texto="Revisões"
          />
        </GrupoMenu>

        <GrupoMenu
          titulo="Questões"
          icone="📝"
          rotas={[
            "/questoes",
            "/historico",
            "/banco-questoes",
          ]}
        >
          <ItemMenu
            to="/questoes"
            icone="✍️"
            texto="Registrar Questões"
          />

          <ItemMenu
            to="/historico"
            icone="🕘"
            texto="Histórico"
          />

          <ItemMenu
            to="/banco-questoes"
            icone="🧠"
            texto="Banco de Questões"
          />
        </GrupoMenu>

        <GrupoMenu
          titulo="Desempenho"
          icone="📊"
          rotas={[
            "/estatisticas",
            "/historico-sessoes",
            "/estatisticas-sessoes",
            "/estatisticas-simulado-ia",
          ]}
        >
          <ItemMenu
            to="/estatisticas"
            icone="📈"
            texto="Estatísticas"
          />

          <ItemMenu
            to="/historico-sessoes"
            icone="📅"
            texto="Histórico de Sessões"
          />

          <ItemMenu
            to="/estatisticas-sessoes"
            icone="⏱"
            texto="Estatísticas de Sessões"
          />

          <ItemMenu
            to="/estatisticas-simulado-ia"
            icone="🤖"
            texto="Estatísticas IA"
          />
        </GrupoMenu>

        <GrupoMenu
          titulo="Simulados"
          icone="🎯"
          rotas={[
            "/simulados",
            "/gerar-simulado-ia",
            "/resolver-simulado-ia",
          ]}
        >
          <ItemMenu
            to="/simulados"
            icone="📄"
            texto="Simulados"
          />

          <ItemMenu
            to="/gerar-simulado-ia"
            icone="✨"
            texto="Gerar Simulado IA"
          />

          <ItemMenu
            to="/resolver-simulado-ia"
            icone="🤖"
            texto="Resolver Simulado IA"
          />
        </GrupoMenu>

        <GrupoMenu
          titulo="Sistema"
          icone="⚙️"
          rotas={[
            "/ia-coach",
            "/backup",
            "/configuracoes",
          ]}
        >
          <ItemMenu
            to="/ia-coach"
            icone="🤖"
            texto="IA Coach"
          />

          <ItemMenu
            to="/backup"
            icone="💾"
            texto="Backup"
          />

          <ItemMenu
            to="/configuracoes"
            icone="⚙"
            texto="Configurações"
          />
        </GrupoMenu>
      </nav>

      <div className="sidebar-rodape">
        <span>Foco atual</span>
        <strong>PMPE</strong>
        <small>Planejamento tático</small>
      </div>
    </aside>
  );
}

function GrupoMenu({
  titulo,
  icone,
  rotas,
  abertoInicialmente = false,
  children,
}: GrupoMenuProps) {
  const location =
    useLocation();

  const possuiRotaAtiva =
    rotas.some(
      (rota) =>
        location.pathname ===
          rota ||
        location.pathname.startsWith(
          `${rota}/`
        )
    );

  const [
    aberto,
    setAberto,
  ] = useState(
    abertoInicialmente ||
    possuiRotaAtiva
  );

  const grupoAberto =
    aberto ||
    possuiRotaAtiva;

  return (
    <div
      className={`sidebar-grupo ${
        possuiRotaAtiva
          ? "sidebar-grupo-ativo"
          : ""
      }`}
    >
      <button
        type="button"
        className="sidebar-grupo-botao"
        onClick={() =>
          setAberto(
            (valor) =>
              !valor
          )
        }
      >
        <span className="sidebar-grupo-identidade">
          <span className="sidebar-grupo-icone">
            {icone}
          </span>

          <span>
            {titulo}
          </span>
        </span>

        <span
          className={`sidebar-seta ${
            grupoAberto
              ? "sidebar-seta-aberta"
              : ""
          }`}
        >
          ›
        </span>
      </button>

      {grupoAberto && (
        <div className="sidebar-submenu">
          {children}
        </div>
      )}
    </div>
  );
}

type ItemMenuProps = {
  to: string;
  icone: string;
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
      className={({
        isActive,
      }) =>
        `sidebar-link ${
          isActive
            ? "sidebar-link-ativo"
            : ""
        }`
      }
    >
      <span className="sidebar-link-icone">
        {icone}
      </span>

      <span className="sidebar-link-texto">
        {texto}
      </span>
    </NavLink>
  );
}