import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Voce esta na Home</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.push("/screens/social/CriarPost")}
            accessibilityRole="button"
            accessibilityLabel="Criar post"
          >
            <Ionicons name="add-circle-outline" size={22} color={theme.colors.text} />
          </Pressable>

          <Pressable
            style={styles.iconButton}
            onPress={() => router.push("/screens/social/SearchUsers")}
            accessibilityRole="button"
            accessibilityLabel="Pesquisar usuarios"
          >
            <Ionicons name="search" size={22} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.subtitle}>Explore o app e encontre outros usuarios.</Text>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.colors.text,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    subtitle: {
      color: theme.colors.mutedText,
      textAlign: "center",
      fontSize: 14,
    },
  });
}
