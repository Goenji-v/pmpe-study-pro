import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { PARCERIAS_VISIVEIS } from "./config/recursos";

const Auth = lazy(() => import("./pages/Auth/Auth"));
const Convite = lazy(() => import("./pages/Convite/Convite"));
const PrivateApp = lazy(() => import("./PrivateApp"));

function CarregandoRota() {
  return (
    <div role="status" aria-live="polite">
      Carregando...
    </div>
  );
}

export default function AuthenticatedApp() {
  return (
    <AuthProvider>
      <Suspense fallback={<CarregandoRota />}>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route
            path="/convite/:codigo"
            element={
              PARCERIAS_VISIVEIS
                ? <Convite />
                : <Navigate to="/login" replace />
            }
          />
          <Route path="/*" element={<PrivateApp />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
