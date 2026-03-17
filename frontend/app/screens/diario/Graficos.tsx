import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

const PROGRESS_GRADIENT = ["#5BE7FF", "#7C5CFF", "#FF4BD8"] as const;

export default function GraficosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, { paddingTop: 8 + insets.top }]}>
        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.backIconBorder}
        >
          <Pressable style={styles.backIcon} onPress={() => router.back()}>
            <Text style={styles.backIconText}>{"<"}</Text>
          </Pressable>
        </LinearGradient>

        <Text style={styles.title}>{t("diary_charts_title")}</Text>
        <Text style={styles.description}>{t("diary_charts_description")}</Text>

      <Pressable
        style={[styles.button, styles.buttonCard]}
        onPress={() => router.push("/screens/diario/GraficoExercicios")}
      >
        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.neonBorder}
        >
          <View style={styles.neonInner}>
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="chart-box-outline" size={40} style={styles.icon} />
              <Text style={styles.buttonText}>Gráfico de exercícios</Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={[styles.button, styles.buttonCard]}
        onPress={() => router.push("/screens/diario/GraficoVolumeTreino")}
      >
        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.neonBorder}
        >
          <View style={styles.neonInner}>
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="chart-areaspline" size={40} style={styles.icon} />
              <Text style={styles.buttonText}>Gráfico de volume de treino</Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: "#0B0E18",
    },
    container: {
      flex: 1,
      justifyContent: "flex-start",
      backgroundColor: "#0B0E18",
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 16,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: "#E0E0E0",
    },
    description: {
      color: "#7FE7FF",
    },
    backIconBorder: {
      width: 38,
      height: 38,
      borderRadius: 999,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
      marginBottom: 18,
      alignSelf: "flex-start",
    },
    backIcon: {
      width: "100%",
      height: "100%",
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    backIconText: {
      color: "#7FE7FF",
      fontSize: 18,
      fontWeight: "700",
    },
    button: {
      width: "100%",
      flex: 1,
    },
    buttonCard: {
      marginTop: 8,
    },
    neonBorder: {
      borderRadius: 12,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    neonInner: {
      minHeight: 190,
      borderRadius: 10,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      paddingVertical: 26,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    icon: {
      color: "#7FE7FF",
    },
    buttonText: {
      color: "#E0E0E0",
      fontWeight: "700",
      fontSize: 20,
    },
  });
}
