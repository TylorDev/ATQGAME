import { useEffect } from "react";
import { useGameUiStore } from "@/contexts/GameUiContext";
import { useInputRouter } from "@/contexts/InputRouterContext";

export function UiInputBridge() {
  const router = useInputRouter();
  const store = useGameUiStore();

  useEffect(() => {
    const handle = (action: Parameters<typeof router.dispatch>[0]): boolean => {
      switch (action.type) {
        case "toggle-console": store.toggleConsole(); return true;
        case "close-overlays": store.closeOverlays(); return true;
        case "toggle-player-stats": store.toggleStats(); return true;
        case "toggle-player-hud": store.toggleHud(); return true;
        case "camera-zoom": store.adjustCameraDistance(action.deltaMeters); return true;
        default: return false;
      }
    };
    const unsubscribers = [
      router.subscribe("global", handle),
      router.subscribe("ui", handle),
      router.subscribe("gameplay", handle),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [router, store]);

  return null;
}
