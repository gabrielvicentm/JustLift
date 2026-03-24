import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";
import { fetchMyProfile } from "@/app/features/profile/service";

const PROGRESS_GRADIENT = ["#5BE7FF", "#7C5CFF", "#FF4BD8"] as const;
const SUPPORT_EMAIL = "justlift.oficial@gmail.com";
const SUPPORT_SUBJECT = "Mensagem de Suporte do Aplicativo";

export default function SuporteScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchMyProfile()
      .then((profile) => {
        if (!active) return;
        setUsername(profile.username || null);
        setDisplayName(profile.nome_exibicao || null);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  const handleSendEmail = () => {
    const userLabel = displayName || "Usuario";
    const usernameLine = username ? `@${username}` : "@usuario";
    const body = [
      "Olá, equipe JustLift!",
      "",
      "Descreva abaixo o problema:",
      "",
      "---",
      `Usuário: ${userLabel}`,
      usernameLine,
      "---",
    ].join("\n");

    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      SUPPORT_SUBJECT,
    )}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.backBorder}
        >
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#E0E0E0" />
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>
        </LinearGradient>
      </View>

      <View style={styles.center}>
        <Text style={styles.title}>Suporte</Text>
        <Text style={styles.subtitle}>
          Precisa de ajuda? Envie a mensagem e nós responderemos o mais rápido possível.
        </Text>
        <Text style={styles.subtitle}>
          No seu celular, será aberto o aplicativo de e-mail para enviar a mensagem.
        </Text>

        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.ctaBorder}
        >
          <Pressable style={styles.ctaButton} onPress={handleSendEmail}>
            <Text style={styles.ctaText}>Fale Conosco</Text>
          </Pressable>
        </LinearGradient>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#0B0E18",
      padding: 16,
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: 16,
    },
    backBorder: {
      borderRadius: 12,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    backButton: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    backButtonText: {
      color: "#E0E0E0",
      fontWeight: "700",
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      paddingHorizontal: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: "#E0E0E0",
      textShadowColor: "rgba(0, 255, 255, 0.65)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    subtitle: {
      color: "#B8C6FF",
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    ctaBorder: {
      borderRadius: 16,
      padding: 1.5,
      shadowColor: "#74D3FF",
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 7,
      marginTop: 8,
    },
    ctaButton: {
      borderRadius: 14,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      paddingHorizontal: 32,
      paddingVertical: 12,
      alignItems: "center",
    },
    ctaText: {
      color: "#E0E0E0",
      fontWeight: "800",
      fontSize: 16,
    },
  });
}
