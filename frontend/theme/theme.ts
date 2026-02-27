export type ThemeMode = "light" | "dark";

export type ThemeOverrides = {
  appBackground?: string;
  safeArea?: string;
  border?: string;
  button?: string;
};

export type AppTheme = {
  mode: ThemeMode;
  colors: {
    background: string;
    safeArea: string;
    surface: string;
    border: string;
    text: string;
    mutedText: string;
    inputBackground: string;
    button: string;
    buttonText: string;
    link: string;
    success: string;
    error: string;
    shadow: string;
  };
};

const lightTheme: AppTheme = {
  mode: "light",
  colors: {
    background: "#f6f8fb",
    safeArea: "#e9eef7",
    surface: "#ffffff",
    border: "#cbd5e1",
    text: "#0f172a",
    mutedText: "#475569",
    inputBackground: "#ffffff",
    button: "#2563eb",
    buttonText: "#ffffff",
    link: "#1d4ed8",
    success: "#16a34a",
    error: "#dc2626",
    shadow: "#000000",
  },
};

const darkTheme: AppTheme = {
  mode: "dark",
  colors: {
    background: "#0b1220",
    safeArea: "#050a14",
    surface: "#111b2e",
    border: "#334155",
    text: "#e2e8f0",
    mutedText: "#94a3b8",
    inputBackground: "#0f172a",
    button: "#3b82f6",
    buttonText: "#ffffff",
    link: "#60a5fa",
    success: "#4ade80",
    error: "#f87171",
    shadow: "#000000",
  },
};

export const DEFAULT_THEME_STATE: {
  mode: ThemeMode;
  overrides: ThemeOverrides;
} = {
  mode: "light",
  overrides: {
    appBackground: undefined,
    safeArea: undefined,
    border: undefined,
    button: undefined,
  },
};

export function createAppTheme(mode: ThemeMode, overrides: ThemeOverrides): AppTheme {
  const baseTheme = mode === "dark" ? darkTheme : lightTheme;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: overrides.appBackground ?? baseTheme.colors.background,
      safeArea: overrides.safeArea ?? overrides.appBackground ?? baseTheme.colors.safeArea,
      border: overrides.border ?? baseTheme.colors.border,
      button: overrides.button ?? baseTheme.colors.button,
    },
  };
}
