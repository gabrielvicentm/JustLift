import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "@/providers/ThemeProvider";
import { I18nProvider } from "@/providers/I18nProvider";
import { AppQueryProvider } from "@/app/providers/QueryProvider";

function RootStack() {
  const { theme } = useAppTheme();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="(tabs)"
        options={{
          contentStyle: {
            backgroundColor: theme.colors.safeArea,
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      />
      <Stack.Screen
        name="screens"
        options={{
          contentStyle: {
            backgroundColor: theme.colors.safeArea,
            paddingTop: 12,
            paddingBottom: 12,
          },
        }}
      />
      <Stack.Screen
        name="screens/social/Perfil"
        options={{
          contentStyle: {
            backgroundColor: theme.colors.safeArea,
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AppQueryProvider>
            <RootStack />
          </AppQueryProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
