import { createContext, useContext } from "react";
import type { InputRouter } from "@/game/input/InputRouter";

export const InputRouterContext = createContext<InputRouter | null>(null);

export function useInputRouter(): InputRouter {
  const router = useContext(InputRouterContext);
  if (!router) throw new Error("Input router is unavailable outside GameUiProvider");
  return router;
}
