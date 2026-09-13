import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

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
import "./styles/StudioProPremiumShell.css";
import "./components/Sidebar/SidebarPremiumGroups.css";

// Mantém a preview no estado visual anterior ao experimento da nova tela inicial.
ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
