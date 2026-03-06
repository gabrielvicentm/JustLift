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
import { useMyProfileQuery } from "@/app/features/profile/hooks";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { fetchPostsByUser } from "@/app/features/social/service";
import type { PostSummary } from "@/app/features/social/types";
import { useFocusEffect } from "@react-navigation/native";
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
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");

  const loading = profileQuery.isLoading;
  const refreshing = profileQuery.isRefetching;

  const errorMessage = profileQuery.error ? getApiErrorMessage(profileQuery.error, "carregar perfil") : "";

  const profile = profileQuery.data;

  const loadPosts = useCallback(async () => {
    const userId = profileQuery.data?.user_id;
    if (!userId) {
      return;
    }

    setLoadingPosts(true);
    setPostsError("");

    try {
      const data = await fetchPostsByUser(userId);
      setPosts(data);
    } catch (err) {
      setPostsError(getApiErrorMessage(err, "carregar posts"));
    } finally {
      setLoadingPosts(false);
    }
  }, [profileQuery.data?.user_id]);

  const handleRefresh = async () => {
    await profileQuery.refetch();
    await loadPosts();
  };

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts]),
  );

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

              <Pressable
                style={styles.socialSummary}
                onPress={() => router.push("/screens/social/FollowersFollowing" as never)}
              >
                <Text style={styles.socialSummaryText}>
                  <Text style={styles.socialSummaryNumber}>{profile?.followers_count ?? 0}</Text> seguidores
                </Text>
                <Text style={styles.socialSummaryText}>
                  <Text style={styles.socialSummaryNumber}>{profile?.following_count ?? 0}</Text> seguindo
                </Text>
              </Pressable>
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

          <View style={styles.postsSection}>
            <Text style={styles.postsTitle}>Posts</Text>

            {loadingPosts ? (
              <View style={styles.postsLoading}>
                <ActivityIndicator color={theme.colors.text} />
                <Text style={styles.loadingText}>Carregando posts...</Text>
              </View>
            ) : null}

            {postsError ? <Text style={styles.error}>{postsError}</Text> : null}

            {!loadingPosts && posts.length === 0 ? (
              <Text style={styles.emptyPosts}>Voce ainda nao publicou nenhum post.</Text>
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
    error: {
      color: theme.colors.error,
      fontWeight: "500",
    },
    postsSection: {
      marginTop: 4,
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
