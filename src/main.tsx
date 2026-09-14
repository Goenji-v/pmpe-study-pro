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

// Camada visual da nova prévia: mantém as funções atuais e troca apenas a apresentação.
import "./styles/StudioProPremiumShell.css";
import "./styles/StudioProLegacySuite.css";
import "./styles/StudioProFunctional.css";
import "./components/Sidebar/SidebarPremiumGroups.css";
import "./components/Sidebar/SidebarIconAdjustments.css";
import "./components/Sidebar/SidebarMountainArt.css";
import "./pages/Dashboard/DashboardHeroPremium.css";
import "./pages/Dashboard/DashboardCompactStats.css";
import "./pages/Dashboard/DashboardWeeklyGoalCompact.css";
import "./pages/Dashboard/DashboardGeneralPerformanceVisual.css";
import "./pages/Dashboard/DashboardMissionBackgroundOnly.css";

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
