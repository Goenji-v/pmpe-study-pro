import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import "./pages/PlanoEdital/PlanoEditalCursos.css";
import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import AvisoArmazenamento from "./components/AvisoArmazenamento/AvisoArmazenamento";
import RuntimeErrorGuard from "./components/RuntimeErrorGuard/RuntimeErrorGuard";
import QuestaoIACronometroBridge from "./components/QuestaoIACronometroBridge/QuestaoIACronometroBridge";
import CentralRedacaoBridge from "./components/CentralRedacaoBridge/CentralRedacaoBridge";
import PersonalizacaoBridge from "./components/PersonalizacaoBridge/PersonalizacaoBridge";
import DeferredAppExtras from "./components/DeferredAppExtras/DeferredAppExtras";

import { AppProvider } from "./context/AppContext";
import { ToastProvider } from "./context/ToastContext";
import { CronometroProvider } from "./context/CronometroContext";
import { AuthProvider } from "./context/AuthContext";

const PlanoEditalGateway = lazy(() => import("./pages/PlanoEdital/PlanoEditalGatewayCursos"));
const MeuEdital = lazy(() => import("./pages/MeuEdital/MeuEdital"));
const Cursos = lazy(() => import("./pages/Cursos/Cursos"));
const Loja = lazy(() => import("./pages/Loja/Loja"));
const ResolverSimuladoIA = lazy(() => import("./pages/ResolverSimuladoIA/ResolverSimuladoIA"));
const MeusSimuladosIA = lazy(() => import("./pages/MeusSimuladosIA/MeusSimuladosIA"));
const RevisaoCadernoIA = lazy(() => import("./pages/RevisaoCadernoIA/RevisaoCadernoIA"));
const CronogramaIA = lazy(() => import("./pages/CronogramaIA/CronogramaIA"));
const GerarSimuladoIA = lazy(() => import("./pages/GerarSimuladoIA/GerarSimuladoIA"));
const CentroMateriais = lazy(() => import("./pages/CentroMateriais/CentroMateriais"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const Estudos = lazy(() => import("./pages/Estudos/Estudos"));
const Questoes = lazy(() => import("./pages/Questoes/Questoes"));
const Historico = lazy(() => import("./pages/Historico/Historico"));
const Estatisticas = lazy(() => import("./pages/Estatisticas/Estatisticas"));
const Revisoes = lazy(() => import("./pages/Revisoes/Revisoes"));
const CentralEstudosGateway = lazy(() => import("./pages/CentralEstudos/CentralEstudosGateway"));
const HistoricoSessoes = lazy(() => import("./pages/HistoricoSessoes/HistoricoSessoes"));
const Simulados = lazy(() => import("./pages/Simulados/Simulados"));
const Backup = lazy(() => import("./pages/Backup/Backup"));
const CentralQuestoes = lazy(() => import("./pages/CentralQuestoes/CentralQuestoes"));
const Configuracoes = lazy(() => import("./pages/Configuracoes/Configuracoes"));
const BancoQuestoes = lazy(() => import("./pages/BancoQuestoes/BancoQuestoes"));
const InteligenciaHub = lazy(() => import("./pages/InteligenciaHub/InteligenciaHub"));
const EstatisticasSimuladoIA = lazy(() => import("./pages/EstatisticasSimuladoIA/EstatisticasSimuladoIA"));
const EstatisticasSessoes = lazy(() => import("./pages/EstatisticasSessoes/EstatisticasSessoes"));
const CentralDesempenho = lazy(() => import("./pages/CentralDesempenho/CentralDesempenho"));
const Calendario = lazy(() => import("./pages/Calendario/Calendario"));
const Auth = lazy(() => import("./pages/Auth/Auth"));
const Demo = lazy(() => import("./pages/Demo/Demo"));
const NotFound = lazy(() => import("./pages/NotFound/NotFound"));
const Ranking = lazy(() => import("./pages/Ranking/Ranking"));
const Admin = lazy(() => import("./pages/Admin/Admin"));
const Conquistas = lazy(() => import("./pages/Conquistas/Conquistas"));
const DashboardGamificacaoSpotlight = lazy(
  () => import("./components/DashboardGamificacaoSpotlight/DashboardGamificacaoSpotlight")
);

function CarregandoRota() {
  return (
    <div role="status" aria-live="polite">
      Carregando...
    </div>
  );
}

function LayoutProtegido() {
  const location = useLocation();
  const paginaDashboard = location.pathname === "/";

  return (
    <ProtectedRoute>
      <ToastProvider>
        <RuntimeErrorGuard />
        <AppProvider>
          <PersonalizacaoBridge />
          {paginaDashboard && (
            <Suspense fallback={null}>
              <DashboardGamificacaoSpotlight />
            </Suspense>
          )}
          <DeferredAppExtras />
          <CronometroProvider>
            <QuestaoIACronometroBridge />
            <CentralRedacaoBridge />
            <div className="layout">
              <Sidebar />

              <div className="content">
                <Header />
                <AvisoArmazenamento />

                <main className={`page ${paginaDashboard ? "page-dashboard" : "page-interna"}`}>
                  <Suspense fallback={<CarregandoRota />}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />

                      <Route path="/meu-edital" element={<MeuEdital />} />
                      <Route path="/cursos" element={<Cursos />} />
                      <Route path="/plano" element={<PlanoEditalGateway />} />
                      <Route path="/plano-estudos" element={<PlanoEditalGateway />} />

                      <Route path="/calendario" element={<Calendario />} />
                      <Route path="/cronograma-ia" element={<CronogramaIA />} />
                      <Route path="/central-estudos" element={<CentralEstudosGateway />} />
                      <Route path="/materiais" element={<CentroMateriais />} />
                      <Route path="/inteligencia" element={<InteligenciaHub />} />

                      <Route path="/estudos" element={<Estudos />} />
                      <Route path="/conteudos" element={<Estudos />} />
                      <Route path="/buscar" element={<Estudos />} />
                      <Route path="/pesquisa" element={<Estudos />} />
                      <Route path="/search" element={<Estudos />} />

                      <Route path="/revisoes" element={<Revisoes />} />

                      <Route path="/questoes" element={<CentralQuestoes />} />
                      <Route path="/registrar-questoes" element={<Questoes />} />
                      <Route path="/historico" element={<Historico />} />
                      <Route path="/banco-questoes" element={<BancoQuestoes />} />
                      <Route path="/estatisticas" element={<Estatisticas />} />

                      <Route path="/simulados" element={<Simulados />} />
                      <Route path="/resolver-simulado-ia" element={<MeusSimuladosIA />} />
                      <Route path="/resolver-simulado-ia/prova" element={<ResolverSimuladoIA />} />
                      <Route path="/resolver-simulado-ia/revisao/:cadernoId" element={<RevisaoCadernoIA />} />
                      <Route path="/gerar-simulado-ia" element={<GerarSimuladoIA />} />
                      <Route path="/estatisticas-simulado-ia" element={<EstatisticasSimuladoIA />} />

                      <Route path="/desempenho" element={<CentralDesempenho />} />
                      <Route path="/historico-sessoes" element={<HistoricoSessoes />} />
                      <Route path="/estatisticas-sessoes" element={<EstatisticasSessoes />} />
                      <Route path="/ranking" element={<Ranking />} />
                      <Route path="/conquistas" element={<Conquistas />} />
                      <Route path="/loja" element={<Loja />} />

                      <Route
                        path="/relatorio-inteligente"
                        element={<Navigate to="/inteligencia?aba=relatorio" replace />}
                      />
                      <Route
                        path="/ia-coach"
                        element={<Navigate to="/inteligencia?aba=coach" replace />}
                      />

                      <Route path="/backup" element={<Backup />} />
                      <Route path="/configuracoes" element={<Configuracoes />} />
                      <Route path="/admin" element={<Admin />} />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </main>
              </div>
            </div>
          </CronometroProvider>
        </AppProvider>
      </ToastProvider>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<CarregandoRota />}>
            <Routes>
              <Route path="/login" element={<Auth />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/*" element={<LayoutProtegido />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;