import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import type { PostSummary } from "@/app/features/social/types";
import { fetchPostsByUser } from "@/app/features/social/service";
import { fetchDailySummaryByUser } from "@/app/features/daily/service";
import type { DailySummary } from "@/app/features/daily/types";
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
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);

  const loadProfile = useCallback(async () => {
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
  }, [username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const userId = profile?.user_id;
    if (!userId) {
      return;
    }

    let active = true;
    setLoadingPosts(true);

    fetchPostsByUser(userId)
      .then((data) => {
        if (!active) return;
        setPosts(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(getApiErrorMessage(err, "carregar posts"));
      })
      .finally(() => {
        if (!active) return;
        setLoadingPosts(false);
      });

    return () => {
      active = false;
    };
  }, [profile?.user_id]);

  useEffect(() => {
    const userId = profile?.user_id;
    if (!userId) {
      return;
    }

    let active = true;

    fetchDailySummaryByUser(userId)
      .then((data) => {
        if (!active) return;
        setDailySummary(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(getApiErrorMessage(err, "carregar Daily"));
      });

    return () => {
      active = false;
    };
  }, [profile?.user_id]);

  useFocusEffect(
    useCallback(() => {
      const userId = profile?.user_id;
      if (!userId) {
        return;
      }

      let active = true;
      setLoadingPosts(true);

      fetchPostsByUser(userId)
        .then((data) => {
          if (!active) return;
          setPosts(data);
        })
        .catch((err) => {
          if (!active) return;
          setError(getApiErrorMessage(err, "carregar posts"));
        })
        .finally(() => {
          if (!active) return;
          setLoadingPosts(false);
        });

      fetchDailySummaryByUser(userId)
        .then((data) => {
          if (!active) return;
          setDailySummary(data);
        })
        .catch((err) => {
          if (!active) return;
          setError(getApiErrorMessage(err, "carregar Daily"));
        });

      return () => {
        active = false;
      };
    }, [profile?.user_id]),
  );

  const hasActiveDaily = dailySummary?.has_active_daily ?? false;
  const hasUnseenDaily = dailySummary?.has_unseen_daily ?? false;

  const handleOpenDaily = () => {
    if (!profile?.user_id || !hasActiveDaily) {
      return;
    }
    router.push({ pathname: "/screens/social/VerDaily", params: { userId: profile.user_id } } as never);
  };

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
            <Pressable
              style={[
                styles.avatarRing,
                hasActiveDaily && (hasUnseenDaily ? styles.avatarRingUnseen : styles.avatarRingSeen),
              ]}
              onPress={handleOpenDaily}
              disabled={!hasActiveDaily}
            >
              {profile?.foto_perfil ? (
                <Image source={{ uri: profile.foto_perfil }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarPlaceholderText}>Sem foto</Text>
                </View>
              )}
            </Pressable>

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

        <View style={styles.postsSection}>
          <Text style={styles.postsTitle}>Posts</Text>

          {loadingPosts ? (
            <View style={styles.postsLoading}>
              <ActivityIndicator color={theme.colors.text} />
              <Text style={styles.loadingText}>Carregando posts...</Text>
            </View>
          ) : null}

          {!loadingPosts && posts.length === 0 ? (
            <Text style={styles.emptyPosts}>Este usuario ainda nao publicou posts.</Text>
          ) : null}

          {posts.map((item) => {
            const firstMedia = item.midias?.[0];
            return (
              <Pressable
                key={item.id}
                style={styles.postCard}
                onPress={() => router.push(`/screens/social/Post/${item.id}` as never)}
              >
                {firstMedia ? (
                  firstMedia.type === "image" ? (
                    <Image source={{ uri: firstMedia.url }} style={styles.postPreview} />
                  ) : (
                    <View style={[styles.postPreview, styles.videoPreview]}>
                      <Text style={styles.videoPreviewText}>Video</Text>
                    </View>
                  )
                ) : null}
                {item.descricao ? <Text style={styles.postDescription}>{item.descricao}</Text> : null}
                <View style={styles.postMetaRow}>
                  <Text style={styles.postMetaText}>Curtidas: {item.likes_count}</Text>
                  <Text style={styles.postMetaText}>Comentarios: {item.comments_count}</Text>
                </View>
              </Pressable>
            );
          })}
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
    avatarRing: {
      borderRadius: 50,
      padding: 3,
      borderWidth: 2,
      borderColor: "transparent",
    },
    avatarRingUnseen: {
      borderColor: theme.colors.button,
    },
    avatarRingSeen: {
      borderColor: theme.colors.border,
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
    postsSection: {
      gap: 8,
    },
    postsTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    postsLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    emptyPosts: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    postCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
      padding: 10,
      gap: 8,
    },
    postPreview: {
      width: "100%",
      height: 180,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
    },
    videoPreview: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.button,
    },
    videoPreviewText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    postDescription: {
      color: theme.colors.text,
      fontSize: 14,
    },
    postMetaRow: {
      flexDirection: "row",
      gap: 12,
    },
    postMetaText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
  });
}
