import { useEffect } from "react";
import { useTheme } from "@/apps/sigma/lib/useTheme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useTheme();

  useEffect(() => {
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
