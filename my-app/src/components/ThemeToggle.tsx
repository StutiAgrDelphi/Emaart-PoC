import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ isDark, toggleTheme }: { isDark: boolean, toggleTheme: () => void }) {
    return (
        <button
            onClick={toggleTheme}
            className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle theme"
        >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
    );
}
