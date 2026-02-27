import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

export default function GraficosScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("diary_charts_title")}</Text>
      <Text style={styles.description}>{t("diary_charts_description")}</Text>

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>{t("common_back")}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 16,
      justifyContent: "center",
      gap: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
    },
    description: {
      color: theme.colors.mutedText,
      textAlign: "center",
    },
    backButton: {
      marginTop: 16,
      height: 46,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.button,
    },
    backButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
  });
}
