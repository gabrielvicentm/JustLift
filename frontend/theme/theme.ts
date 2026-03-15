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
    negativeGradient: string[];
    negativeText: string;
    link: string;
    success: string;
    error: string;
    shadow: string;
  };
};

const lightTheme: AppTheme = {
  mode: "light",
  colors: {
    background: "#0D0D0D",
    safeArea: "#070707",
    surface: "#11131A",
    border: "#8B5CF6",
    text: "#E5E7EB",
    mutedText: "#67E8F9",
    inputBackground: "#0F1115",
    button: "#0b0b0b",
    buttonText: "#E5E7EB",
    negativeGradient: ["#FF3B30", "#FF9500", "#FFD60A"],
    negativeText: "#1A0B0B",
    link: "#22D3EE",
    success: "#22C55E",
    error: "#F43F5E",
    shadow: "#000000",
  },
};

const darkTheme: AppTheme = {
  mode: "dark",
  colors: {
    background: "#0D0D0D",
    safeArea: "#070707",
    surface: "#11131A",
    border: "#8B5CF6",
    text: "#E5E7EB",
    mutedText: "#67E8F9",
    inputBackground: "#0F1115",
    button: "#0B0B0B",
    buttonText: "#E5E7EB",
    negativeGradient: ["#FF3B30", "#FF9500", "#FFD60A"],
    negativeText: "#1A0B0B",
    link: "#22D3EE",
    success: "#22C55E",
    error: "#F43F5E",
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
