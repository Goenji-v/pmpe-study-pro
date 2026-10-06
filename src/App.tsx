import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import PWAInstallPrompt from "./components/PWAInstallPrompt/PWAInstallPrompt";

const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));
const TermosUso = lazy(() => import("./pages/Legal/TermosUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/Legal/PoliticaPrivacidade"));
const Demo = lazy(() => import("./pages/Demo/Demo"));

function CarregandoRota() {
  return (
    <div role="status" aria-live="polite">
      Carregando...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PWAInstallPrompt />
      <Suspense fallback={<CarregandoRota />}>
        <Routes>
          <Route path="/termos" element={<TermosUso />} />
          <Route path="/privacidade" element={<PoliticaPrivacidade />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/*" element={<AuthenticatedApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
