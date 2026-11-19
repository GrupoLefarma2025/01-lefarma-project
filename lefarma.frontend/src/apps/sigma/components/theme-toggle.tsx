import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/apps/sigma/lib/useTheme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg transition-all duration-200 hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
        >
          {theme === "light" && <Sun className="h-4 w-4 sm:h-5 sm:w-5" />}
          {theme === "dark" && <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
          {theme === "auto" && <Monitor className="h-4 w-4 sm:h-5 sm:w-5" />}
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="gap-2 cursor-pointer"
        >
          <Sun className="h-4 w-4" />
          <span>Claro</span>
          {theme === "light" && (
            <span className="ml-auto text-xs text-primary">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="gap-2 cursor-pointer"
        >
          <Moon className="h-4 w-4" />
          <span>Oscuro</span>
          {theme === "dark" && (
            <span className="ml-auto text-xs text-primary">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("auto")}
          className="gap-2 cursor-pointer"
        >
          <Monitor className="h-4 w-4" />
          <span>Automático</span>
          {theme === "auto" && (
            <span className="ml-auto text-xs text-primary">✓</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
