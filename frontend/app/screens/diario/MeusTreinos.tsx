import { useCallback, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Calendar, DateData } from "react-native-calendars";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/app/config/api";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

type DiasTreinoResponse = {
  dias: string[];
};

export default function MeusTreinosScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t, language } = useI18n();
  const isEn = language === "en";
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [diasComTreino, setDiasComTreino] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDayPress = useCallback((dateString: string) => {
    setSelectedDate(dateString);
    if (diasComTreino.has(dateString)) {
      router.push({
        pathname: "/screens/diario/DetalheTreino",
        params: { data: dateString },
      });
    }
  }, [diasComTreino, router]);

  const carregarDiasComTreino = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setError(isEn ? "Sign in to view your workouts." : "Faça login para ver seus treinos.");
        setDiasComTreino(new Set());
        return;
      }

      const response = await api.get<DiasTreinoResponse>("/detalhe-treino/dias", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setDiasComTreino(new Set(response.data?.dias ?? []));
    } catch (err) {
      console.error("Erro ao carregar dias com treino:", err);
      setDiasComTreino(new Set());
      setError(isEn ? "Failed to load workout days." : "Falha ao carregar os dias de treino.");
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  useFocusEffect(
    useCallback(() => {
      carregarDiasComTreino().catch(() => undefined);
    }, [carregarDiasComTreino]),
  );

  const diasMarcados = useMemo(() => {
    const marked: Record<string, { selected: boolean; selectedColor: string }> = {};

    diasComTreino.forEach((dia) => {
      marked[dia] = {
        selected: true,
        selectedColor: "transparent",
      };
    });

    if (selectedDate) {
      marked[selectedDate] = {
        selected: true,
        selectedColor: theme.colors.button,
      };
    }

    return marked;
  }, [diasComTreino, selectedDate, theme.colors.button]);

  const renderDay = useCallback(({ date, state }: { date?: DateData; state?: string }) => {
    if (!date) {
      return <View style={styles.dayCell} />;
    }

    const hasWorkout = diasComTreino.has(date.dateString);
    const isSelected = selectedDate === date.dateString;
    const isDisabled = state === "disabled";

    return (
      <Pressable
        disabled={isDisabled}
        onPress={() => handleDayPress(date.dateString)}
        style={[
          styles.dayCell,
          hasWorkout && styles.dayCellWithWorkout,
          isSelected && styles.dayCellSelected,
        ]}
      >
        <Text
          style={[
            styles.dayText,
            isDisabled && styles.dayTextDisabled,
            isSelected && styles.dayTextSelected,
          ]}
        >
          {date.day}
        </Text>

        {hasWorkout ? (
          <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} style={styles.checkIcon} />
        ) : null}
      </Pressable>
    );
  }, [diasComTreino, handleDayPress, selectedDate, styles, theme.colors.success]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Text style={styles.title}>{t("diary_my_workouts_title")}</Text>
        <Text style={styles.description}>{t("diary_my_workouts_description")}</Text>

        <View style={styles.calendarCard}>
          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator color={theme.colors.button} />
            </View>
          ) : error ? (
            <View style={styles.stateContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <Calendar
              markedDates={diasMarcados}
              onDayPress={(day) => handleDayPress(day.dateString)}
              dayComponent={renderDay}
              enableSwipeMonths
              theme={{
                backgroundColor: theme.colors.surface,
                calendarBackground: theme.colors.surface,
                monthTextColor: theme.colors.text,
                textMonthFontWeight: "700",
                textSectionTitleColor: theme.colors.mutedText,
                arrowColor: theme.colors.button,
              }}
            />
          )}
        </View>

        <Text style={styles.legend}>
          <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} /> {" "}
          {isEn ? "Day with saved workout" : "Dia com treino salvo"}
        </Text>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t("common_back")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.safeArea,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 16,
      gap: 10,
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
      marginBottom: 4,
    },
    calendarCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 8,
      minHeight: 380,
      justifyContent: "center",
    },
    stateContainer: {
      minHeight: 220,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    errorText: {
      color: theme.colors.error,
      textAlign: "center",
      fontWeight: "600",
    },
    dayCell: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    dayCellWithWorkout: {
      borderColor: theme.colors.success,
      borderWidth: 1,
    },
    dayCellSelected: {
      backgroundColor: theme.colors.button,
      borderColor: theme.colors.button,
    },
    dayText: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: "600",
    },
    dayTextDisabled: {
      color: theme.colors.mutedText,
      opacity: 0.45,
    },
    dayTextSelected: {
      color: theme.colors.buttonText,
    },
    checkIcon: {
      position: "absolute",
      right: -2,
      bottom: -3,
      backgroundColor: theme.colors.surface,
      borderRadius: 999,
    },
    legend: {
      color: theme.colors.mutedText,
      textAlign: "center",
      fontSize: 13,
    },
    backButton: {
      marginTop: "auto",
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
