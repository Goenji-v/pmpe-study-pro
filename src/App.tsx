import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import PlanoEditalGateway from "./pages/PlanoEdital/PlanoEditalGateway";
import MeuEdital from "./pages/MeuEdital/MeuEdital";
import ResolverSimuladoIA from "./pages/ResolverSimuladoIA/ResolverSimuladoIA";
import MeusSimuladosIA from "./pages/MeusSimuladosIA/MeusSimuladosIA";
import CronogramaIA from "./pages/CronogramaIA/CronogramaIA";
import GerarSimuladoIA from "./pages/GerarSimuladoIA/GerarSimuladoIA";
import CentroMateriais from "./pages/CentroMateriais/CentroMateriais";
import Dashboard from "./pages/Dashboard/Dashboard";
import Estudos from "./pages/Estudos/Estudos";
import Questoes from "./pages/Questoes/Questoes";
import Historico from "./pages/Historico/Historico";
import Estatisticas from "./pages/Estatisticas/Estatisticas";
import Revisoes from "./pages/Revisoes/Revisoes";
import CentralEstudosGateway from "./pages/CentralEstudos/CentralEstudosGateway";
import HistoricoSessoes from "./pages/HistoricoSessoes/HistoricoSessoes";
import Simulados from "./pages/Simulados/Simulados";
import Backup from "./pages/Backup/Backup";
import CentralQuestoes from "./pages/CentralQuestoes/CentralQuestoes";
import Configuracoes from "./pages/Configuracoes/Configuracoes";
import BancoQuestoes from "./pages/BancoQuestoes/BancoQuestoes";
import InteligenciaHub from "./pages/InteligenciaHub/InteligenciaHub";
import EstatisticasSimuladoIA from "./pages/EstatisticasSimuladoIA/EstatisticasSimuladoIA";
import EstatisticasSessoes from "./pages/EstatisticasSessoes/EstatisticasSessoes";
import CentralDesempenho from "./pages/CentralDesempenho/CentralDesempenho";
import Calendario from "./pages/Calendario/Calendario";
import Auth from "./pages/Auth/Auth";
import NotFound from "./pages/NotFound/NotFound";
import Ranking from "./pages/Ranking/Ranking";
import Admin from "./pages/Admin/Admin";
import Conquistas from "./pages/Conquistas/Conquistas";
import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import RuntimeErrorGuard from "./components/RuntimeErrorGuard/RuntimeErrorGuard";
import BetaFeedback from "./components/BetaFeedback/BetaFeedback";
import NotificationCenter from "./components/NotificationCenter/NotificationCenter";
import QuestaoIABridge from "./components/QuestaoIABridge/QuestaoIABridge";

import { AppProvider, useApp } from "./context/AppContext";
import { ToastProvider } from "./context/ToastContext";
import { CronometroProvider } from "./context/CronometroContext";
import { AuthProvider } from "./context/AuthContext";
import type { ConfiguracoesComEdital } from "./types/editalInteligente";

function EditalPrimeiroAcessoGuard() {
  const { configuracoes, statusNuvem } = useApp();
  const config = configuracoes as ConfiguracoesComEdital;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (statusNuvem === "carregando") return;
    if (config.editalOnboardingVisto) return;
    if (location.pathname === "/meu-edital") return;
    navigate("/meu-edital", { replace: true });
  }, [config.editalOnboardingVisto, location.pathname, navigate, statusNuvem]);

  return null;
}

function LayoutProtegido() {
  const location = useLocation();
  const paginaDashboard = location.pathname === "/";

  return (
    <ProtectedRoute>
      <ToastProvider>
        <RuntimeErrorGuard />
        <AppProvider>
          <EditalPrimeiroAcessoGuard />
          <QuestaoIABridge />
          <CronometroProvider>
            <div className="layout">
              <Sidebar />

              <div className="content">
                <Header />

                <main className={`page ${paginaDashboard ? "page-dashboard" : "page-interna"}`}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />

                    <Route path="/meu-edital" element={<MeuEdital />} />
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
                    <Route path="/gerar-simulado-ia" element={<GerarSimuladoIA />} />
                    <Route path="/estatisticas-simulado-ia" element={<EstatisticasSimuladoIA />} />

                    <Route path="/desempenho" element={<CentralDesempenho />} />
                    <Route path="/historico-sessoes" element={<HistoricoSessoes />} />
                    <Route path="/estatisticas-sessoes" element={<EstatisticasSessoes />} />
                    <Route path="/ranking" element={<Ranking />} />
                    <Route path="/conquistas" element={<Conquistas />} />

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
                </main>
              </div>
            </div>
            <BetaFeedback />
            <NotificationCenter />
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
          <Routes>
            <Route path="/login" element={<Auth />} />
            <Route path="/*" element={<LayoutProtegido />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
