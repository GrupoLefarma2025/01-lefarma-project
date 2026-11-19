import { useEffect } from "react";
import { useTheme } from "@/apps/sigma/lib/useTheme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useTheme();

  // The hook already applies the theme, so we just need to render children
  useEffect(() => {
    // Force apply theme on mount to ensure it's applied before hydration
    const root = document.documentElement;
    const storedTheme = localStorage.getItem("app-theme-preference") || "auto";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const effectiveTheme = storedTheme === "auto" ? systemTheme : storedTheme;

    if (effectiveTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  return <>{children}</>;
}
