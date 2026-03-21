import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, useAppTheme } from "@/providers/ThemeProvider";
import { AppQueryProvider } from "@/app/providers/QueryProvider";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
      <Stack.Screen
        name="screens/social/Chat"
        options={{
          contentStyle: {
            backgroundColor: theme.colors.background,
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      />
      <Stack.Screen
        name="screens/social/Conversas"
        options={{
          contentStyle: {
            backgroundColor: theme.colors.background,
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppQueryProvider>
            <RootStack />
          </AppQueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
