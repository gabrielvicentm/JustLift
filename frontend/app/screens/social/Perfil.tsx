import { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMyProfileQuery } from "@/app/features/profile/hooks";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { useRouter } from "expo-router";

export default function PerfilScreen() {
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();

  const profileQuery = useMyProfileQuery();

  const loading = profileQuery.isLoading;
  const refreshing = profileQuery.isRefetching;

  const errorMessage = profileQuery.error ? getApiErrorMessage(profileQuery.error, "carregar perfil") : "";

  const profile = profileQuery.data;

  const handleRefresh = async () => {
    await profileQuery.refetch();
  };

  if (loading) {
    return (
      <View style={styles.containerCentered}>
        <ActivityIndicator color={theme.colors.text} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{t("profile_title")}</Text>

          <View style={styles.profileCard}>
            {profile?.banner ? <Image source={{ uri: profile.banner }} style={styles.banner} /> : null}

            <View style={styles.profileBody}>
              {profile?.foto_perfil ? (
                <Image source={{ uri: profile.foto_perfil }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarPlaceholderText}>Sem foto</Text>
                </View>
              )}

              <Text style={styles.nameText}>{profile?.nome_exibicao || profile?.username || "Seu perfil"}</Text>

              {profile?.biografia ? <Text style={styles.bioText}>{profile.biografia}</Text> : null}
            </View>

            <View style={styles.actionsRow}>
              <Pressable style={styles.button} onPress={handleRefresh} disabled={refreshing}>
                <Text style={styles.buttonText}>Atualizar</Text>
              </Pressable>

              <Pressable style={styles.button} onPress={() => router.push("/screens/social/UpdateProfile")}>
                <Text style={styles.buttonText}>Editar Perfil</Text>
              </Pressable>
            </View>
          </View>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    containerCentered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      gap: 8,
    },
    loadingText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "500",
    },
    contentContainer: {
      padding: 16,
      gap: 12,
      paddingBottom: 30,
    },
    headerBlock: {
      gap: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    profileCard: {
      width: "100%",
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 12,
      overflow: "hidden",
    },
    banner: {
      width: "100%",
      height: 120,
      backgroundColor: theme.colors.inputBackground,
    },
    profileBody: {
      alignItems: "center",
      padding: 14,
      gap: 8,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.colors.inputBackground,
    },
    avatarPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    avatarPlaceholderText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    nameText: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
    },
    bioText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      textAlign: "center",
    },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    button: {
      backgroundColor: theme.colors.button,
      borderRadius: 10,
      minHeight: 42,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    buttonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 14,
    },
    error: {
      color: theme.colors.error,
      fontWeight: "500",
    },
  });
}
