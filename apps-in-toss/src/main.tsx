import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { createRoot } from "react-dom/client";

import config from "../apps-in-toss.config.ts";
import App from "./App.tsx";
import "./index.css";

// 게임 엔진이 명령형으로 DOM/RAF/리스너를 다루므로 StrictMode 이중 마운트를 피한다.
createRoot(document.getElementById("root")!).render(
  <TDSMobileAITProvider brandPrimaryColor={config.brand.primaryColor}>
    <App />
  </TDSMobileAITProvider>,
);
