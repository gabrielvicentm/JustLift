import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import {
  type AppTheme,
  createAppTheme,
  DEFAULT_THEME_STATE,
  type ThemeMode,
  type ThemeOverrides,
} from "@/theme/theme";
import { loadPersistedJSON, savePersistedJSON } from "@/utils/persistence";

type ThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  overrides: ThemeOverrides;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setBackgroundColor: (color?: string) => void;
  setBorderColor: (color?: string) => void;
  setButtonColor: (color?: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_STORAGE_KEY = "app_theme_v1";

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (DEFAULT_THEME_STATE.mode) {
      return DEFAULT_THEME_STATE.mode;
    }

    return systemScheme === "dark" ? "dark" : "light";
  });

  const [overrides, setOverrides] = useState<ThemeOverrides>(DEFAULT_THEME_STATE.overrides);
  const theme = useMemo(() => createAppTheme(mode, overrides), [mode, overrides]);

  useEffect(() => {
    let active = true;

    async function hydrateTheme() {
      const persisted = await loadPersistedJSON<{
        mode?: ThemeMode;
        overrides?: ThemeOverrides;
      }>(THEME_STORAGE_KEY);

      if (!active) {
        return;
      }

      if (persisted?.mode === "light" || persisted?.mode === "dark") {
        setMode(persisted.mode);
      }

      if (persisted?.overrides) {
        setOverrides({
          appBackground: persisted.overrides.appBackground,
          safeArea: persisted.overrides.safeArea,
          border: persisted.overrides.border,
          button: persisted.overrides.button,
        });
      }

      setHydrated(true);
    }

    hydrateTheme().catch(() => {
      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    savePersistedJSON(THEME_STORAGE_KEY, { mode, overrides }).catch(() => undefined);
  }, [hydrated, mode, overrides]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      overrides,
      setMode,
      toggleMode: () => setMode((prev) => (prev === "dark" ? "light" : "dark")),
      setBackgroundColor: (color?: string) =>
        setOverrides((prev) => ({ ...prev, appBackground: color, safeArea: color })),
      setBorderColor: (color?: string) => setOverrides((prev) => ({ ...prev, border: color })),
      setButtonColor: (color?: string) => setOverrides((prev) => ({ ...prev, button: color })),
    }),
    [theme, mode, overrides],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme precisa ser usado dentro de ThemeProvider");
  }

  return context;
}
