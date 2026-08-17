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

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);