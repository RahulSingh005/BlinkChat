import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./lib/install";
import { registerServiceWorker } from "./lib/push";
import { useSettingsStore } from "./store/useSettingsStore";

useSettingsStore.getState().init();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

registerServiceWorker();
