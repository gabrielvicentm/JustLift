import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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

      <LinearGradient
        colors={theme.colors.buttonGradient}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.primaryButtonBorder}
      >
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/screens/diario/GraficoExercicios")}
        >
          <Text style={styles.primaryButtonText}>Gráfico de exercícios</Text>
        </Pressable>
      </LinearGradient>

      <LinearGradient
        colors={theme.colors.buttonGradient}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.primaryButtonBorder}
      >
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/screens/diario/GraficoVolumeTreino")}
        >
          <Text style={styles.primaryButtonText}>Gráfico de volume de treino</Text>
        </Pressable>
      </LinearGradient>

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
      marginTop: 8,
      height: 46,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    primaryButtonBorder: {
      marginTop: 8,
      borderRadius: 10,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    primaryButton: {
      height: 46,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    primaryButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    backButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
  });
}
