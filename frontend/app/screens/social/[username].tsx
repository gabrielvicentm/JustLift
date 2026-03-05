import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import type { PublicProfileResponse } from "@/app/features/profile/types";
import {
  fetchProfileByUsername,
  followUser,
  getApiErrorMessage,
  removeFollowing,
} from "@/app/features/profile/service";

export default function PublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingFollow, setUpdatingFollow] = useState(false);

  const loadProfile = async () => {
    const safeUsername = String(username || "").trim();
    if (!safeUsername) {
      setError("Username invalido.");
      setLoading(false);
      return;
    }

    try {
      setError("");
      setLoading(true);
      const data = await fetchProfileByUsername(safeUsername);
      setProfile(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "carregar perfil"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [username]);

  const handleFollowToggle = async () => {
    if (!profile || profile.is_me) {
      return;
    }

    try {
      setUpdatingFollow(true);
      setError("");

      if (profile.is_following) {
        await removeFollowing(profile.user_id);
        setProfile({
          ...profile,
          is_following: false,
          followers_count: Math.max(0, profile.followers_count - 1),
        });
      } else {
        await followUser(profile.user_id);
        setProfile({
          ...profile,
          is_following: true,
          followers_count: profile.followers_count + 1,
        });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "atualizar follow"));
    } finally {
      setUpdatingFollow(false);
    }
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
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>
        </View>

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

            <Text style={styles.nameText}>{profile?.nome_exibicao || profile?.username || "Perfil"}</Text>
            {profile?.biografia ? <Text style={styles.bioText}>{profile.biografia}</Text> : null}

            <View style={styles.socialSummary}>
              <Text style={styles.socialSummaryText}>
                <Text style={styles.socialSummaryNumber}>{profile?.followers_count ?? 0}</Text> seguidores
              </Text>
              <Text style={styles.socialSummaryText}>
                <Text style={styles.socialSummaryNumber}>{profile?.following_count ?? 0}</Text> seguindo
              </Text>
            </View>
          </View>

          {!profile?.is_me ? (
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.button, updatingFollow && styles.disabled]}
                onPress={handleFollowToggle}
                disabled={updatingFollow}
              >
                {updatingFollow ? (
                  <ActivityIndicator color={theme.colors.buttonText} />
                ) : (
                  <Text style={styles.buttonText}>{profile?.is_following ? "Seguindo" : "Seguir"}</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 10,
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
      gap: 10,
      paddingBottom: 24,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "flex-start",
    },
    backButton: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
    },
    backButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
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
    socialSummary: {
      marginTop: 8,
      flexDirection: "row",
      gap: 16,
    },
    socialSummaryText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    socialSummaryNumber: {
      fontWeight: "800",
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
    disabled: {
      opacity: 0.7,
    },
    error: {
      color: theme.colors.error,
      fontWeight: "500",
    },
  });
}
