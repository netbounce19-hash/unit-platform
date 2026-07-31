"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type LabelTheme = "light" | "dark";

const STORAGE_KEY = "unit-label-theme";

interface Ctx {
  theme: LabelTheme;
  setTheme: (t: LabelTheme) => void;
}

const LabelThemeContext = createContext<Ctx | undefined>(undefined);

/**
 * Тема скопирована только на кабинет лейбла: класс `dark` вешается на
 * обёртку внутри LabelShell, а не на <html>, поэтому кабинет артиста
 * (и остальной сайт) переключение никак не видит.
 */
export function LabelThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<LabelTheme>("light");

  // Читаем сохранённую тему уже после гидратации — так серверный
  // и первый клиентский рендер совпадают, без предупреждений React.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        setThemeState(stored);
        return;
      }
      if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        setThemeState("dark");
      }
    } catch {
      /* localStorage недоступен — остаёмся на светлой */
    }
  }, []);

  const setTheme = (t: LabelTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* приватный режим — не критично, тема просто не запомнится */
    }
  };

  return (
    <LabelThemeContext.Provider value={{ theme, setTheme }}>
      <div className={theme === "dark" ? "dark" : undefined}>{children}</div>
    </LabelThemeContext.Provider>
  );
}

export function useLabelTheme() {
  const ctx = useContext(LabelThemeContext);
  if (!ctx) throw new Error("useLabelTheme must be used within LabelThemeProvider");
  return ctx;
}
