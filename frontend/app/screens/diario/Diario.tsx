import { useCallback, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

const WORKOUT_DRAFT_KEY = "current_workout_draft_v1";

export default function DiarioScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [hasWorkoutDraft, setHasWorkoutDraft] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function checkDraft() {
        try {
          const raw = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
          if (!active || !raw) {
            if (active) setHasWorkoutDraft(false);
            return;
          }

          const draft = JSON.parse(raw) as {
            selected_api_items?: unknown[];
            selected_custom_items?: unknown[];
            series_data?: unknown[];
          };

          const hasSelection =
            (Array.isArray(draft.selected_api_items) && draft.selected_api_items.length > 0) ||
            (Array.isArray(draft.selected_custom_items) && draft.selected_custom_items.length > 0) ||
            (Array.isArray(draft.series_data) && draft.series_data.length > 0);

          if (active) {
            setHasWorkoutDraft(hasSelection);
          }
        } catch {
          if (active) setHasWorkoutDraft(false);
        }
      }

      checkDraft().catch(() => setHasWorkoutDraft(false));

      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("diary_title")}</Text>
      <Text style={styles.subtitle}>{t("diary_subtitle")}</Text>

      <View style={styles.buttonsContainer}>
        {hasWorkoutDraft ? (
          <Pressable
            style={[styles.buttonSecondary, styles.buttonWide]}
            onPress={() => router.push("/screens/diario/AdicionarExercicios")}
          >
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="play-circle-outline" size={20} style={styles.icon} />
              <Text style={styles.buttonSecondaryText}>Continuar treino</Text>
            </View>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.button, styles.buttonCard]}
          onPress={() => router.push("/screens/diario/AdicionarExercicios")}
        >
          <LinearGradient
            colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.neonBorder}
          >
            <View style={styles.neonInner}>
              <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="dumbbell" size={26} style={styles.icon} />
              <Text style={styles.buttonText}>{t("diary_add_workout")}</Text>
            </View>
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={[styles.button, styles.buttonCard]}
          onPress={() => router.push("/screens/diario/MeusTreinos")}
        >
          <LinearGradient
            colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.neonBorder}
          >
            <View style={styles.neonInner}>
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={26} style={styles.icon} />
                <Text style={styles.buttonText}>{t("diary_my_workouts")}</Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={[styles.button, styles.buttonCard]}
          onPress={() => router.push("/screens/diario/Graficos")}
        >
          <LinearGradient
            colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.neonBorder}
          >
            <View style={styles.neonInner}>
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons name="chart-bar" size={26} style={styles.icon} />
                <Text style={styles.buttonText}>{t("diary_charts")}</Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={[styles.button, styles.buttonCard]}
          onPress={() => router.push("/screens/diario/Ranking")}
        >
          <LinearGradient
            colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.neonBorder}
          >
            <View style={styles.neonInner}>
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons name="trophy-outline" size={26} style={styles.icon} />
                <Text style={styles.buttonText}>{t("diary_ranking")}</Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={[styles.button, styles.buttonCard]}
          onPress={() => router.push("/screens/diario/Patentes")}
        >
          <LinearGradient
            colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.neonBorder}
          >
            <View style={styles.neonInner}>
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons name="diamond-stone" size={26} style={styles.icon} />
                <Text style={styles.buttonText}>{t("diary_patents")}</Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "flex-start",
      backgroundColor: "#0B0E18",
      paddingHorizontal: 16,
      paddingTop: 28,
      paddingBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: "#E0E0E0",
      textAlign: "center",
      textShadowColor: "rgba(0, 255, 255, 0.75)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    subtitle: {
      marginTop: 6,
      color: "#7FE7FF",
      textAlign: "center",
      textShadowColor: "rgba(0, 255, 255, 0.45)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    buttonsContainer: {
      marginTop: 22,
      gap: 14,
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      alignContent: "center",
    },
    button: {
      height: 92,
      borderRadius: 16,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
      borderColor: "transparent",
      borderWidth: 0,
      shadowColor: "#74D3FF",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
      overflow: "visible",
    },
    buttonCard: {
      width: "100%",
    },
    buttonWide: {
      width: "100%",
    },
    buttonText: {
      color: "#F4F7FF",
      fontWeight: "700",
      fontSize: 16,
      letterSpacing: 0.2,
      textShadowColor: "rgba(64, 182, 255, 0.65)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    buttonSecondary: {
      height: 52,
      borderRadius: 16,
      backgroundColor: "#0F1323",
      alignItems: "center",
      justifyContent: "center",
      borderColor: "rgba(123, 47, 247, 0.8)",
      borderWidth: 1.2,
      shadowColor: "#7B2FF7",
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
      paddingHorizontal: 14,
    },
    buttonSecondaryText: {
      color: "#E0E0E0",
      fontWeight: "700",
      letterSpacing: 0.2,
      textShadowColor: "rgba(123, 47, 247, 0.6)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 6,
    },
    buttonContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    neonBorder: {
      height: "100%",
      width: "100%",
      borderRadius: 16,
      padding: 1.5,
      shadowColor: "#FF4BD8",
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 0 },
    },
    neonInner: {
      flex: 1,
      borderRadius: 14,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    icon: {
      color: "#7FE7FF",
    },
  });
}
