import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
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

  const goHome = () => router.push("/screens/Home");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("settings_title")}</Text>
      <Text style={styles.subtitle}>{t("settings_subtitle")}</Text>

      <View style={styles.card}>
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
              trackColor={{ false: theme.colors.border, true: theme.colors.button }}
              thumbColor={theme.colors.buttonText}
            />
          </View>
        </View>

        <Pressable style={styles.optionRow} onPress={goHome}>
          <Text style={styles.optionText}>Notificações</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable style={styles.optionRow} onPress={goHome}>
          <Text style={styles.optionText}>Conta</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable style={styles.optionRow} onPress={goHome}>
          <Text style={styles.optionText}>Suporte</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable style={styles.optionRow} onPress={() => setShowLanguageModal(true)}>
          <Text style={styles.optionText}>{t("settings_language_title")}</Text>
          <Text style={styles.optionHint}>
            {language === "pt" ? t("settings_language_pt") : t("settings_language_en")}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable style={styles.optionRow} onPress={() => router.push("/screens/settings/Premium")}>
          <Text style={styles.optionText}>Obter Premium</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable style={styles.optionRow} onPress={goHome}>
          <Text style={styles.optionText}>Sobre</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => undefined}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </Pressable>

      <Modal visible={showLanguageModal} animationType="fade" transparent onRequestClose={() => setShowLanguageModal(false)}>
        <View style={styles.modalBackdrop}>
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
              {language === "pt" ? <Text style={styles.modalSelected}>✓</Text> : null}
            </Pressable>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setLanguage("en");
                setShowLanguageModal(false);
              }}
            >
              <Text style={styles.modalOptionText}>{t("settings_language_en")}</Text>
              {language === "en" ? <Text style={styles.modalSelected}>✓</Text> : null}
            </Pressable>

            <Pressable style={styles.modalCancel} onPress={() => setShowLanguageModal(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 16,
      gap: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      color: theme.colors.mutedText,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 2,
    },
    themeRow: {
      minHeight: 56,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
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
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    optionRow: {
      minHeight: 54,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
    },
    optionText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    optionHint: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    chevron: {
      color: theme.colors.mutedText,
      fontSize: 24,
      lineHeight: 24,
    },
    logoutButton: {
      marginTop: 8,
      height: 48,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    logoutButtonText: {
      color: theme.colors.error,
      fontWeight: "700",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modalCard: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 14,
      gap: 8,
    },
    modalTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    modalOption: {
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBackground,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalOptionText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "600",
    },
    modalSelected: {
      color: theme.colors.button,
      fontSize: 18,
      fontWeight: "700",
    },
    modalCancel: {
      marginTop: 4,
      minHeight: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    modalCancelText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
  });
}
