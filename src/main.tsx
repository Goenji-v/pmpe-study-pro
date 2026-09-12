import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter } from "react-router-dom";

// The visual laboratory has no dependency on account providers or live services.
// All other entry points keep the existing application and authentication intact.
const isDemo = /^\/demo(?:\/|$|-(?:completo|plano|estudos|questoes|revisoes|simulados|desempenho|estatisticas|materiais|cronograma|mentoria)\/?$)/.test(window.location.pathname);
const App = React.lazy(() => import("./App"));
const DemoCompleto = React.lazy(() => import("./pages/DemoCompleto/DemoCompleto"));

import "./global.css";
import "./styles/mobile.css";
import "./styles/visual-final.css";
import "./styles/visual-3d.css";
import "./styles/sidebar-organizado.css";
import "./styles/app-premium.css";
import "./styles/mobile-density.css";
import "./styles/mobile-dashboard-fixes.css";
import "./styles/visual-qa-final.css";
import "./components/BetaMonitor/BetaMonitorProducao.css";
import "./pages/Demo/Demo.reference-fidelity.css";
import "./pages/Demo/Demo.performance-match.css";

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <React.Suspense fallback={<div role="status" style={{ padding: 32 }}>Preparando Studio Pro…</div>}>
      {isDemo ? <BrowserRouter><DemoCompleto /></BrowserRouter> : <App />}
    </React.Suspense>
  </React.StrictMode>
);
