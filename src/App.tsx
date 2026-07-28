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
import Configuracoes from "./pages/Configuracoes/Configuracoes";
import BancoQuestoes from "./pages/BancoQuestoes/BancoQuestoes";
import EstatisticasSimuladoIA from "./pages/EstatisticasSimuladoIA/EstatisticasSimuladoIA";
import EstatisticasSessoes from "./pages/EstatisticasSessoes/EstatisticasSessoes";
import IACoach from "./pages/IACoach/IACoach";
import Calendario from "./pages/Calendario/Calendario";
import Auth from "./pages/Auth/Auth";

import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";
import ProtectedRoute from "./components/ProtectedRoute";

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

                    <Route
                      path="/materiais"
                      element={<CentroMateriais />}
                    />

                    <Route
                      path="/estudos"
                      element={<Estudos />}
                    />

                    <Route
                      path="/questoes"
                      element={<Questoes />}
                    />

                    <Route
                      path="/historico"
                      element={<Historico />}
                    />

                    <Route
                      path="/estatisticas"
                      element={<Estatisticas />}
                    />

                    <Route
                      path="/revisoes"
                      element={<Revisoes />}
                    />

                    <Route
                      path="/central-estudos"
                      element={<CentralEstudos />}
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
                      path="/simulados"
                      element={<Simulados />}
                    />

                    <Route
                      path="/banco-questoes"
                      element={<BancoQuestoes />}
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
                      path="/ia-coach"
                      element={<IACoach />}
                    />

                    <Route
                      path="/cronograma-ia"
                      element={<CronogramaIA />}
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
  );
}

export default App;