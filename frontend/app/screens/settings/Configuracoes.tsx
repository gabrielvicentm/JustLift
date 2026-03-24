import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/app/config/api";
import { fetchUnreadNotificationsCount } from "@/app/features/notifications/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

const PROGRESS_GRADIENT = ["#5BE7FF", "#7C5CFF", "#FF4BD8"] as const;
const GOLD_GRADIENT = ["#FDE68A", "#F8C84A", "#B45309"] as const;

export default function ConfiguracoesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const premiumPulse = useRef(new Animated.Value(1)).current;
  const negativeGradient = (theme.colors.negativeGradient ?? PROGRESS_GRADIENT) as unknown as readonly [
    string,
    string,
    ...string[],
  ];
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const goHome = () => router.push("/screens/Home");

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      const refreshToken = await AsyncStorage.getItem("refreshToken");
      if (refreshToken) {
        await api.post("/user/logout", { refreshToken });
      }
    } catch (err) {
      console.log("Erro ao fazer logout no servidor:", err);
    } finally {
      await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
      router.replace("/screens/auth/Login");
      setIsLoggingOut(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadUnreadCount = async () => {
        try {
          const count = await fetchUnreadNotificationsCount();
          if (isActive) {
            setUnreadNotificationsCount(count);
          }
        } catch {
          if (isActive) {
            setUnreadNotificationsCount(0);
          }
        }
      };

      loadUnreadCount();

      return () => {
        isActive = false;
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.title}>Configurações</Text>
        <Text style={styles.subtitle}>Personalize o tema e gerencie sua conta.</Text>

        <View style={styles.optionsList}>
          <Animated.View style={{ transform: [{ scale: premiumPulse }] }}>
            <LinearGradient
              colors={GOLD_GRADIENT}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.premiumBorder}
            >
              <Pressable style={styles.premiumCard} onPress={() => router.push("/screens/settings/Premium")}>
                <View>
                  <Text style={styles.premiumTitle}>Obter Premium</Text>
                  <Text style={styles.premiumHint}>Desbloqueie benefícios épicos</Text>
                </View>
                <View style={styles.premiumBadge}>
                  <MaterialCommunityIcons name="crown" size={18} style={styles.premiumBadgeIcon} />
                  <Text style={styles.premiumBadgeText}>VIP</Text>
                </View>
              </Pressable>
            </LinearGradient>
          </Animated.View>

          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.cardBorder}
          >
            <Pressable style={styles.optionCard} onPress={() => router.push("/screens/settings/Notificacoes")}>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionText}>Notificações</Text>
                {unreadNotificationsCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadNotificationsCount > 99 ? "99+" : String(unreadNotificationsCount)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} style={styles.chevron} />
            </Pressable>
          </LinearGradient>

          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.cardBorder}
          >
            <Pressable style={styles.optionCard} onPress={() => router.push("/screens/settings/Conta")}>
              <Text style={styles.optionText}>Conta</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} style={styles.chevron} />
            </Pressable>
          </LinearGradient>

          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.cardBorder}
          >
            <Pressable style={styles.optionCard} onPress={() => router.push("/screens/settings/Suporte")}>
              <Text style={styles.optionText}>Suporte</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} style={styles.chevron} />
            </Pressable>
          </LinearGradient>

          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.cardBorder}
          >
            <Pressable style={styles.optionCard} onPress={() => router.push("/screens/settings/GerenciarPosts")}>
              <Text style={styles.optionText}>Gerenciar Posts e Dailys</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} style={styles.chevron} />
            </Pressable>
          </LinearGradient>

          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.cardBorder}
          >
            <Pressable style={styles.optionCard} onPress={goHome}>
              <Text style={styles.optionText}>Sobre</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} style={styles.chevron} />
            </Pressable>
          </LinearGradient>
        </View>

        <LinearGradient
          colors={negativeGradient}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.negativeButtonBorder}
        >
          <Pressable style={styles.negativeButton} onPress={handleLogout} disabled={isLoggingOut}>
            <Text style={styles.negativeButtonText}>{isLoggingOut ? "Saindo..." : "Logout"}</Text>
          </Pressable>
        </LinearGradient>
      </ScrollView>

    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#0B0E18",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      gap: 14,
      paddingBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: "#E0E0E0",
      textShadowColor: "rgba(0, 255, 255, 0.75)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    subtitle: {
      color: "#7FE7FF",
      textShadowColor: "rgba(0, 255, 255, 0.45)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    optionsList: {
      gap: 14,
    },
    cardBorder: {
      borderRadius: 18,
      padding: 1.5,
      shadowColor: "#74D3FF",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
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
    optionCard: {
      minHeight: 64,
      borderRadius: 16,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
    },
    premiumCard: {
      minHeight: 68,
      borderRadius: 16,
      backgroundColor: "rgba(18, 8, 4, 0.96)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      gap: 12,
    },
    optionText: {
      color: "#E0E0E0",
      fontSize: 16,
      fontWeight: "600",
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
    optionTextWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    badge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255, 75, 216, 0.7)",
    },
    badgeText: {
      color: "#0B0E18",
      fontSize: 11,
      fontWeight: "800",
    },
    chevron: {
      color: "#7FE7FF",
      fontSize: 24,
      lineHeight: 24,
    },
    negativeButtonBorder: {
      borderRadius: 16,
      padding: 1.5,
      shadowColor: "#FF9500",
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    negativeButton: {
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    negativeButtonText: {
      color: "#FFF3C4",
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    logoutBorder: {
      borderRadius: 16,
      padding: 1.5,
      shadowColor: "#FF4BD8",
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 7,
    },
    logoutButton: {
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    logoutButtonText: {
      color: "#FF4BD8",
      fontWeight: "700",
      letterSpacing: 0.3,
    },
  });
}
