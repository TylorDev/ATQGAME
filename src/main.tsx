import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameLogProvider } from "@/contexts/GameLogContext";
import { Home } from "@/pages/Home/Home";
import "@/styles/global.scss";

console.info("Game renderer initialized");

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <GameLogProvider>
      <Home />
    </GameLogProvider>
  </StrictMode>,
);
