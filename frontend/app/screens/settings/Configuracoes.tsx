import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/app/config/api";
import { fetchUnreadNotificationsCount } from "@/app/features/notifications/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useI18n } from "@/providers/I18nProvider";
import type { AppTheme } from "@/theme/theme";

export default function ConfiguracoesScreen() {
  const router = useRouter();
  const { theme, mode, setMode } = useAppTheme();
  const { language, setLanguage, t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isDarkMode = mode === "dark";
  const [showLanguageModal, setShowLanguageModal] = useState(false);
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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.title}>{t("settings_title")}</Text>
        <Text style={styles.subtitle}>{t("settings_subtitle")}</Text>

        <View style={styles.optionsList}>
        <LinearGradient
          colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.cardBorder}
        >
          <View style={styles.cardInner}>
            <View style={styles.themeRow}>
              <Pressable
                style={styles.themePressable}
                onPress={() => router.push("/screens/settings/ThemeCustomization")}
              >
                <Text style={styles.optionText}>{t("settings_theme_title")}</Text>
                <Text style={styles.optionHint}>{t("settings_open_theme")}</Text>
              </Pressable>

              <View style={styles.switchWrap}>
                <Text style={styles.switchLabel}>{isDarkMode ? "Escuro" : "Claro"}</Text>
                <Switch
                  value={isDarkMode}
                  onValueChange={(value) => setMode(value ? "dark" : "light")}
                  trackColor={{ false: "rgba(124, 92, 255, 0.35)", true: "rgba(255, 75, 216, 0.6)" }}
                  thumbColor="#F4F7FF"
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.cardBorder}
        >
          <Pressable style={styles.optionCard} onPress={() => router.push("/screens/settings/Notificacoes")}>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionText}>Notificacoes</Text>
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
          colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
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
          colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.cardBorder}
        >
          <Pressable style={styles.optionCard} onPress={goHome}>
            <Text style={styles.optionText}>Suporte</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} style={styles.chevron} />
          </Pressable>
        </LinearGradient>

        <LinearGradient
          colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.cardBorder}
        >
          <Pressable style={styles.optionCard} onPress={() => setShowLanguageModal(true)}>
            <View>
              <Text style={styles.optionText}>{t("settings_language_title")}</Text>
              <Text style={styles.optionHint}>
                {language === "pt" ? t("settings_language_pt") : t("settings_language_en")}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} style={styles.chevron} />
          </Pressable>
        </LinearGradient>

        <LinearGradient
          colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.cardBorder}
        >
          <Pressable style={styles.optionCard} onPress={() => router.push("/screens/settings/Premium")}>
            <Text style={styles.optionText}>Obter Premium</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} style={styles.chevron} />
          </Pressable>
        </LinearGradient>

        <LinearGradient
          colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.cardBorder}
        >
          <Pressable style={styles.optionCard} onPress={() => router.push("/screens/settings/GerenciarPosts")}>
            <Text style={styles.optionText}>Gerenciar posts</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} style={styles.chevron} />
          </Pressable>
        </LinearGradient>

        <LinearGradient
          colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
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
          colors={theme.colors.negativeGradient}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.negativeButtonBorder}
        >
          <Pressable style={styles.negativeButton} onPress={handleLogout} disabled={isLoggingOut}>
            <Text style={styles.negativeButtonText}>{isLoggingOut ? "Saindo..." : "Logout"}</Text>
          </Pressable>
        </LinearGradient>
      </ScrollView>

      <Modal visible={showLanguageModal} animationType="fade" transparent onRequestClose={() => setShowLanguageModal(false)}>
        <View style={styles.modalBackdrop}>
          <LinearGradient
            colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.modalBorder}
          >
            <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("settings_language_title")}</Text>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setLanguage("pt");
                setShowLanguageModal(false);
              }}
            >
              <Text style={styles.modalOptionText}>{t("settings_language_pt")}</Text>
              {language === "pt" ? <Text style={styles.modalSelected}>OK</Text> : null}
            </Pressable>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setLanguage("en");
                setShowLanguageModal(false);
              }}
            >
              <Text style={styles.modalOptionText}>{t("settings_language_en")}</Text>
              {language === "en" ? <Text style={styles.modalSelected}>OK</Text> : null}
            </Pressable>

            <Pressable style={styles.modalCancel} onPress={() => setShowLanguageModal(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </Pressable>
            </View>
          </LinearGradient>
        </View>
      </Modal>
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
    cardInner: {
      borderRadius: 16,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      paddingVertical: 2,
    },
    themeRow: {
      minHeight: 56,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(124, 92, 255, 0.35)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 10,
    },
    themePressable: {
      flex: 1,
      gap: 2,
    },
    switchWrap: {
      alignItems: "center",
      gap: 4,
    },
    switchLabel: {
      color: "#7FE7FF",
      fontSize: 12,
      fontWeight: "600",
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
    optionText: {
      color: "#E0E0E0",
      fontSize: 16,
      fontWeight: "600",
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
    optionHint: {
      color: "#7FE7FF",
      fontSize: 12,
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modalBorder: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 18,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    modalCard: {
      borderRadius: 16,
      backgroundColor: "rgba(11, 14, 24, 0.96)",
      padding: 14,
      gap: 8,
    },
    modalTitle: {
      color: "#E0E0E0",
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    modalOption: {
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalOptionText: {
      color: "#E0E0E0",
      fontSize: 15,
      fontWeight: "600",
    },
    modalSelected: {
      color: "#7FE7FF",
      fontSize: 12,
      fontWeight: "700",
    },
    modalCancel: {
      marginTop: 4,
      minHeight: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    modalCancelText: {
      color: "#E0E0E0",
      fontWeight: "700",
    },
  });
}
