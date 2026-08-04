import { useEffect } from "react";
import { useInputRouter } from "@/contexts/InputRouterContext";

export function AppInputAdapter() {
  const router = useInputRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (router.dispatchKeyboard(event)) event.preventDefault();
    };
    const cancelGameplay = (): void => {
      router.dispatch({ type: "cancel-gameplay" });
    };
    const handleVisibilityChange = (): void => {
      if (document.hidden) cancelGameplay();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", cancelGameplay);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", cancelGameplay);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  return null;
}
