import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useI18n } from "@/providers/I18nProvider";

export default function TabsLayout() {
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: theme.colors.button,
      tabBarInactiveTintColor: theme.colors.mutedText,
      sceneStyle: {
        backgroundColor: theme.colors.background,
        paddingTop: 12,
        paddingBottom: 12,
      },
      tabBarStyle: {
        height: 62 + insets.bottom,
        paddingBottom: 8 + insets.bottom,
        paddingTop: 6,
        backgroundColor: theme.colors.safeArea,
        borderTopColor: theme.colors.border,
        borderTopWidth: 1,
      },
    }),
    [insets.bottom, theme],
  );

  return (
    <Tabs
      screenOptions={({ route }) => ({
        ...screenOptions,
        tabBarIcon: ({ color, size }) => {
          const iconName = getIconName(route.name);
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="home_tab" options={{ title: t("tab_home") }} />
      <Tabs.Screen name="diario_tab" options={{ title: t("tab_diary") }} />
      <Tabs.Screen
        name="perfil_tab"
        options={{
          title: t("tab_profile"),
          sceneStyle: {
            backgroundColor: theme.colors.background,
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      />
      <Tabs.Screen name="configuracoes_tab" options={{ title: t("tab_settings") }} />
    </Tabs>
  );
}

function getIconName(routeName: string): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case "home_tab":
      return "home";
    case "diario_tab":
      return "book";
    case "perfil_tab":
      return "person";
    case "configuracoes_tab":
      return "settings";
    default:
      return "ellipse";
  }
}
