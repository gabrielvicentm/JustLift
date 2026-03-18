import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

const WORKOUT_DRAFT_KEY = "current_workout_draft_v1";
const GOLD_GRADIENT = ["#FDE68A", "#F8C84A", "#B45309"] as const;

export default function DiarioScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const premiumPulse = useRef(new Animated.Value(1)).current;
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

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(premiumPulse, {
          toValue: 1.03,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(premiumPulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [premiumPulse]);

  return (
    <View style={[styles.container, { paddingBottom: 0, paddingTop: 28 + insets.top }]}>
      {hasWorkoutDraft ? (
        <Pressable
          style={[styles.buttonSecondary, styles.buttonWide, styles.stickyButton]}
          onPress={() => router.push("/screens/diario/AdicionarExercicios")}
        >
          <LinearGradient
            colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.buttonSecondaryFill}
          >
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="play-circle-outline" size={20} style={styles.icon} />
              <Text style={styles.buttonSecondaryText}>Continuar treino</Text>
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}

      <ScrollView
        style={styles.buttonsScroll}
        contentContainerStyle={styles.buttonsContainer}
        showsVerticalScrollIndicator={false}
      >

        <Animated.View style={[styles.premiumWrapper, { transform: [{ scale: premiumPulse }] }]}>
          <LinearGradient
            colors={GOLD_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.premiumBorder}
          >
            <Pressable style={styles.premiumCard} onPress={() => router.push("/screens/diario/Retrospectiva")}>
              <View>
                <Text style={styles.premiumTitle}>Retrospectiva</Text>
                <Text style={styles.premiumHint}>Semanal e mensal Premium</Text>
              </View>
              <View style={styles.premiumBadge}>
                <MaterialCommunityIcons name="crown" size={18} style={styles.premiumBadgeIcon} />
                <Text style={styles.premiumBadgeText}>VIP</Text>
              </View>
              </Pressable>
            </LinearGradient>
          </Animated.View>

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
              <Text style={styles.buttonText}>Adicionar Treino</Text>
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
                <Text style={styles.buttonText}>Meus Treinos</Text>
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
                <Text style={styles.buttonText}>Graficos</Text>
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
                <Text style={styles.buttonText}>Ranking</Text>
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
                <Text style={styles.buttonText}>Patentes</Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </ScrollView>
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
    buttonsScroll: {
      flex: 1,
      overflow: "visible",
    },
    buttonsContainer: {
      marginTop: 22,
      gap: 14,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      alignItems: "stretch",
      alignContent: "flex-start",
      paddingBottom: 64,
      overflow: "visible",
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
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
      overflow: "hidden",
    },
    buttonSecondaryFill: {
      height: "100%",
      width: "100%",
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    stickyButton: {
      marginTop: 16,
      marginBottom: 12,
      zIndex: 5,
      elevation: 6,
    },
    buttonSecondaryText: {
      color: "#0B0E18",
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    premiumBorder: {
      borderRadius: 18,
      padding: 2,
      shadowColor: "#FDE68A",
      shadowOpacity: 0.55,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    premiumWrapper: {
      width: "100%",
      overflow: "visible",
      paddingHorizontal: 2,
    },
    premiumCard: {
      minHeight: 92,
      borderRadius: 16,
      backgroundColor: "rgba(18, 8, 4, 0.96)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      gap: 12,
    },
    premiumTitle: {
      color: "#FFF7E0",
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    premiumHint: {
      color: "rgba(253, 230, 138, 0.85)",
      fontSize: 12,
      marginTop: 2,
      fontWeight: "600",
    },
    premiumBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(253, 230, 138, 0.15)",
      borderWidth: 1,
      borderColor: "rgba(253, 230, 138, 0.6)",
    },
    premiumBadgeIcon: {
      color: "#FDE68A",
    },
    premiumBadgeText: {
      color: "#FDE68A",
      fontWeight: "800",
      fontSize: 12,
      letterSpacing: 0.8,
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
