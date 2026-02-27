import { useCallback, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
            style={styles.buttonSecondary}
            onPress={() => router.push("/screens/diario/AdicionarExercicios")}
          >
            <Text style={styles.buttonSecondaryText}>Continuar treino</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.button}
          onPress={() => router.push("/screens/diario/AdicionarExercicios")}
        >
          <Text style={styles.buttonText}>{t("diary_add_workout")}</Text>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={() => router.push("/screens/diario/MeusTreinos")}
        >
          <Text style={styles.buttonText}>{t("diary_my_workouts")}</Text>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={() => router.push("/screens/diario/Graficos")}
        >
          <Text style={styles.buttonText}>{t("diary_charts")}</Text>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={() => router.push("/screens/diario/CriarExercicio")}
        >
          <Text style={styles.buttonText}>{t("diary_ranking")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      padding: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
    },
    subtitle: {
      marginTop: 6,
      color: theme.colors.mutedText,
      textAlign: "center",
    },
    buttonsContainer: {
      marginTop: 20,
      gap: 10,
    },
    button: {
      height: 48,
      borderRadius: 10,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    buttonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    buttonSecondary: {
      height: 48,
      borderRadius: 10,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderColor: theme.colors.button,
      borderWidth: 1.5,
    },
    buttonSecondaryText: {
      color: theme.colors.button,
      fontWeight: "700",
    },
  });
}
