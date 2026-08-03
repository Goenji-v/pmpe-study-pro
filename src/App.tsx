import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import PlanoEstudos from "./pages/PlanoEstudos/PlanoEstudos";
import ResolverSimuladoIA from "./pages/ResolverSimuladoIA/ResolverSimuladoIA";
import CronogramaIA from "./pages/CronogramaIA/CronogramaIA";
import GerarSimuladoIA from "./pages/GerarSimuladoIA/GerarSimuladoIA";
import CentroMateriais from "./pages/CentroMateriais/CentroMateriais";
import Dashboard from "./pages/Dashboard/Dashboard";
import Estudos from "./pages/Estudos/Estudos";
import Questoes from "./pages/Questoes/Questoes";
import Historico from "./pages/Historico/Historico";
import Estatisticas from "./pages/Estatisticas/Estatisticas";
import Revisoes from "./pages/Revisoes/Revisoes";
import CentralEstudos from "./pages/CentralEstudos/CentralEstudos";
import HistoricoSessoes from "./pages/HistoricoSessoes/HistoricoSessoes";
import Simulados from "./pages/Simulados/Simulados";
import Backup from "./pages/Backup/Backup";
import CentralQuestoes from "./pages/CentralQuestoes/CentralQuestoes";
import Configuracoes from "./pages/Configuracoes/Configuracoes";
import BancoQuestoes from "./pages/BancoQuestoes/BancoQuestoes";
import CentralInteligencia from "./pages/CentralInteligencia/CentralInteligencia";
import EstatisticasSimuladoIA from "./pages/EstatisticasSimuladoIA/EstatisticasSimuladoIA";
import EstatisticasSessoes from "./pages/EstatisticasSessoes/EstatisticasSessoes";
import CentralDesempenho from "./pages/CentralDesempenho/CentralDesempenho";
import IACoach from "./pages/IACoach/IACoach";
import Calendario from "./pages/Calendario/Calendario";
import Auth from "./pages/Auth/Auth";
import NotFound from "./pages/NotFound/NotFound";
import Ranking from "./pages/Ranking/Ranking";
import RelatorioInteligente from "./pages/RelatorioInteligente/RelatorioInteligente";
import Admin from "./pages/Admin/Admin";
import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";

import {
  AppProvider,
} from "./context/AppContext";

import {
  ToastProvider,
} from "./context/ToastContext";

import {
  CronometroProvider,
} from "./context/CronometroContext";

import {
  AuthProvider,
} from "./context/AuthContext";

function LayoutProtegido() {
  return (
    <ProtectedRoute>
      <ToastProvider>
        <AppProvider>
          <CronometroProvider>
            <div className="layout">
              <Sidebar />

              <div className="content">
                <Header />

                <main className="page">
                  <Routes>
                    <Route
                      path="/"
                      element={<Dashboard />}
                    />

                    <Route
                      path="/plano"
                      element={<PlanoEstudos />}
                    />

                    <Route
                      path="/calendario"
                      element={<Calendario />}
                    />

                    <Route
                      path="/cronograma-ia"
                      element={<CronogramaIA />}
                    />

                    <Route
                      path="/central-estudos"
                      element={<CentralEstudos />}
                    />

                    <Route
                      path="/materiais"
                      element={<CentroMateriais />}
                    />

<Route
  path="/inteligencia"
  element={<CentralInteligencia />}
/>

                    <Route
                      path="/estudos"
                      element={<Estudos />}
                    />

                    <Route
                      path="/revisoes"
                      element={<Revisoes />}
                    />

                    {/* Central de Questões */}
                    <Route
                      path="/questoes"
                      element={<CentralQuestoes />}
                    />

                    {/* Rotas individuais mantidas */}
                    <Route
                      path="/registrar-questoes"
                      element={<Questoes />}
                    />

                    <Route
                      path="/historico"
                      element={<Historico />}
                    />

                    <Route
                      path="/banco-questoes"
                      element={<BancoQuestoes />}
                    />

                    <Route
                      path="/estatisticas"
                      element={<Estatisticas />}
                    />

                    {/* Central de Simulados */}
                    <Route
                      path="/simulados"
                      element={<Simulados />}
                    />

                    <Route
                      path="/resolver-simulado-ia"
                      element={<ResolverSimuladoIA />}
                    />

                    <Route
                      path="/gerar-simulado-ia"
                      element={<GerarSimuladoIA />}
                    />

                    <Route
                      path="/estatisticas-simulado-ia"
                      element={<EstatisticasSimuladoIA />}
                    />

                    {/* Central de Desempenho */}
                    <Route
                      path="/desempenho"
                      element={<CentralDesempenho />}
                    />

                    <Route
                      path="/historico-sessoes"
                      element={<HistoricoSessoes />}
                    />

                    <Route
                      path="/estatisticas-sessoes"
                      element={<EstatisticasSessoes />}
                    />


                    <Route
                      path="/ranking"
                      element={<Ranking />}
                    />

                    {/* Sistema */}

                    <Route
                      path="/relatorio-inteligente"
                      element={<RelatorioInteligente />}
                    />

                    <Route
                      path="/ia-coach"
                      element={<IACoach />}
                    />

                    <Route
                      path="/backup"
                      element={<Backup />}
                    />

                    <Route
                      path="/configuracoes"
                      element={<Configuracoes />}
                    />

                    <Route
                      path="/admin"
                      element={<Admin />}
                    />

                    <Route
                      path="*"
                      element={<NotFound />}
                    />
                  </Routes>
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
        <Routes>
          <Route
            path="/login"
            element={<Auth />}
          />

          <Route
            path="/*"
            element={<LayoutProtegido />}
          />
        </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;