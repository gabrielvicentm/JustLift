import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMyProfileQuery } from "@/app/features/profile/hooks";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { fetchPostsByUser } from "@/app/features/social/service";
import type { PostSummary } from "@/app/features/social/types";
import { fetchDailySummaryByUser } from "@/app/features/daily/service";
import type { DailySummary } from "@/app/features/daily/types";
import { useFocusEffect } from "@react-navigation/native";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { useRouter } from "expo-router";
import PremiumAdModal from "@/app/components/PremiumAdModal";

const PREMIUM_AD_FLAG_KEY = "show_premium_modal_after_workout_post";
const PREMIUM_AD_PROFILE_FLAG_KEY = "show_premium_modal_after_profile_update";

export default function PerfilScreen() {
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();

  const profileQuery = useMyProfileQuery();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "treinos" | "salvos">("posts");
  const [showPremiumAdModal, setShowPremiumAdModal] = useState(false);

  const loading = profileQuery.isLoading;
  const refreshing = profileQuery.isRefetching;

  const errorMessage = profileQuery.error ? getApiErrorMessage(profileQuery.error, "carregar perfil") : "";

  const profile = profileQuery.data;
  const postsCount = posts.length;
  const treinoPosts = posts.filter((item) => item.tipo === "treino");
  const savedPosts = posts.filter((item) => item.viewer_saved);
  const visiblePosts =
    activeTab === "treinos" ? treinoPosts : activeTab === "salvos" ? savedPosts : posts;

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

  const loadDailySummary = useCallback(async () => {
    const userId = profileQuery.data?.user_id;
    if (!userId) {
      return;
    }

    try {
      const data = await fetchDailySummaryByUser(userId);
      setDailySummary(data);
    } catch (err) {
      setPostsError(getApiErrorMessage(err, "carregar Daily"));
    }
  }, [profileQuery.data?.user_id]);

  const handleRefresh = async () => {
    await profileQuery.refetch();
    await loadPosts();
    await loadDailySummary();
  };

  useEffect(() => {
    loadPosts();
    loadDailySummary();
  }, [loadPosts, loadDailySummary]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const hydrate = async () => {
        await loadPosts();
        await loadDailySummary();
        const [shouldShowPost, shouldShowProfile] = await Promise.all([
          AsyncStorage.getItem(PREMIUM_AD_FLAG_KEY),
          AsyncStorage.getItem(PREMIUM_AD_PROFILE_FLAG_KEY),
        ]);
        if ((shouldShowPost || shouldShowProfile) && active) {
          setShowPremiumAdModal(true);
          await AsyncStorage.multiRemove([PREMIUM_AD_FLAG_KEY, PREMIUM_AD_PROFILE_FLAG_KEY]);
        }
      };

      hydrate().catch(() => undefined);
      return () => {
        active = false;
      };
    }, [loadPosts, loadDailySummary]),
  );

  const hasActiveDaily = dailySummary?.has_active_daily ?? false;
  const hasUnseenDaily = dailySummary?.has_unseen_daily ?? false;

  const handleOpenDaily = () => {
    if (!profile?.user_id || !hasActiveDaily) {
      return;
    }
    router.push({ pathname: "/screens/social/VerDaily", params: { userId: profile.user_id } } as never);
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
        <View style={styles.headerTop}>
          <Pressable style={styles.headerIcon} onPress={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <Ionicons name="refresh" size={18} color={theme.colors.text} />
            )}
          </Pressable>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.bannerWrapper}>
            {profile?.banner?.startsWith("color:") ? (
              <View style={[styles.bannerImage, { backgroundColor: profile.banner.replace("color:", "") }]} />
            ) : profile?.banner?.startsWith("gradient:") ? (
              <LinearGradient
                colors={profile.banner.replace("gradient:", "").split(",").map((color) => color.trim())}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerImage}
              />
            ) : profile?.banner ? (
              <Image source={{ uri: profile.banner }} style={styles.bannerImage} />
            ) : (
              <View style={styles.bannerPlaceholder} />
            )}
          </View>

          <View style={styles.profileTopRow}>
            <View style={styles.avatarOverlap}>
              <Pressable
                style={styles.avatarRing}
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
                {hasActiveDaily ? (
                  <View style={[styles.ringOverlay, hasUnseenDaily ? styles.ringUnseen : styles.ringSeen]} />
                ) : null}
              </Pressable>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameBlock}>
                <Text style={styles.nameText}>{profile?.nome_exibicao || profile?.username || "Seu perfil"}</Text>
                {profile?.username ? <Text style={styles.userText}>@{profile.username}</Text> : null}
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile?.followers_count ?? 0}</Text>
                  <Text style={styles.statLabel}>seguidores</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile?.following_count ?? 0}</Text>
                  <Text style={styles.statLabel}>seguindo</Text>
                </View>
              </View>
            </View>
          </View>

          {profile?.biografia ? <Text style={styles.bioText}>{profile.biografia}</Text> : null}

          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={() => router.push("/screens/social/UpdateProfile")}>
              <Text style={styles.primaryButtonText}>Editar perfil</Text>
            </Pressable>
          </View>

          {hasActiveDaily ? (
            <View style={styles.highlightsRow}>
              <Pressable style={styles.highlightItem} onPress={handleOpenDaily}>
                <View style={[styles.highlightCircle, hasUnseenDaily ? styles.highlightUnseen : styles.highlightSeen]}>
                  {profile?.foto_perfil ? (
                    <Image source={{ uri: profile.foto_perfil }} style={styles.highlightImage} />
                  ) : (
                    <View style={[styles.highlightImage, styles.highlightPlaceholder]} />
                  )}
                </View>
                <Text style={styles.highlightLabel}>Daily</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <View style={styles.postsSection}>
          <View style={styles.postsTabs}>
            <Pressable
              style={[styles.tabItem, activeTab === "posts" && styles.tabItemActive]}
              onPress={() => setActiveTab("posts")}
            >
              <View style={[styles.tabIconWrap, activeTab === "posts" && styles.tabIconWrapActive]}>
                <Ionicons
                  name="grid-outline"
                  size={20}
                  color={activeTab === "posts" ? theme.colors.text : theme.colors.mutedText}
                />
              </View>
              <Text style={[styles.tabText, activeTab === "posts" && styles.tabTextActive]}>Posts</Text>
            </Pressable>
            <Pressable
              style={[styles.tabItem, activeTab === "treinos" && styles.tabItemActive]}
              onPress={() => setActiveTab("treinos")}
            >
              <View style={[styles.tabIconWrap, activeTab === "treinos" && styles.tabIconWrapActive]}>
                <Ionicons
                  name="barbell-outline"
                  size={20}
                  color={activeTab === "treinos" ? theme.colors.text : theme.colors.mutedText}
                />
              </View>
              <Text style={[styles.tabText, activeTab === "treinos" && styles.tabTextActive]}>Treinos</Text>
            </Pressable>
            <Pressable
              style={[styles.tabItem, activeTab === "salvos" && styles.tabItemActive]}
              onPress={() => setActiveTab("salvos")}
            >
              <View style={[styles.tabIconWrap, activeTab === "salvos" && styles.tabIconWrapActive]}>
                <Ionicons
                  name="bookmark-outline"
                  size={20}
                  color={activeTab === "salvos" ? theme.colors.text : theme.colors.mutedText}
                />
              </View>
              <Text style={[styles.tabText, activeTab === "salvos" && styles.tabTextActive]}>Salvos</Text>
            </Pressable>
          </View>

          {loadingPosts ? (
            <View style={styles.postsLoading}>
              <ActivityIndicator color={theme.colors.text} />
              <Text style={styles.loadingText}>Carregando posts...</Text>
            </View>
          ) : null}

          {postsError ? <Text style={styles.error}>{postsError}</Text> : null}

          {!loadingPosts && visiblePosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={22} color={theme.colors.mutedText} />
              <Text style={styles.emptyPosts}>
                {activeTab === "treinos"
                  ? "Ainda não há treinos publicados."
                  : activeTab === "salvos"
                    ? "Você ainda não salvou nenhum post."
                    : "Você ainda não publicou nenhum post."}
              </Text>
            </View>
          ) : null}

          {visiblePosts.map((item) => {
            const firstMedia = item.midias?.[0];
            const isTreino = item.tipo === "treino" && item.treino;

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
                      <Ionicons name="videocam" size={20} color={theme.colors.buttonText} />
                      <Text style={styles.videoPreviewText}>Video</Text>
                    </View>
                  )
                ) : null}

                {isTreino ? (
                  <View style={styles.treinoResumo}>
                    <Text style={styles.treinoBadge}>Treino compartilhado</Text>
                    <View style={styles.treinoMetrics}>
                      <Text style={styles.treinoMetricText}>
                        Duracao {item.treino?.duracao ? Math.round(item.treino.duracao / 60) : 0} min
                      </Text>
                      <Text style={styles.treinoMetricText}>
                        Peso {Number(item.treino?.peso_total ?? 0).toFixed(1)}kg
                      </Text>
                      <Text style={styles.treinoMetricText}>Series {item.treino?.total_series ?? 0}</Text>
                      <Text style={styles.treinoMetricText}>
                        Exercicios {item.treino?.total_exercicios ?? 0}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {item.descricao ? <Text style={styles.postDescription}>{item.descricao}</Text> : null}

                <View style={styles.postMetaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="heart-outline" size={14} color={theme.colors.mutedText} />
                    <Text style={styles.postMetaText}>{item.likes_count}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="chatbubble-outline" size={14} color={theme.colors.mutedText} />
                    <Text style={styles.postMetaText}>{item.comments_count}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <PremiumAdModal
        visible={showPremiumAdModal}
        onClose={() => setShowPremiumAdModal(false)}
        onUpgrade={() => {
          setShowPremiumAdModal(false);
          router.push("/screens/settings/Premium");
        }}
      />
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
      gap: 16,
      paddingBottom: 30,
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    headerIcon: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    profileSection: {
      gap: 10,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      padding: 14,
    },
    bannerWrapper: {
      width: "100%",
      height: 90,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.colors.inputBackground,
    },
    bannerImage: {
      width: "100%",
      height: "100%",
    },
    bannerPlaceholder: {
      flex: 1,
      backgroundColor: theme.colors.inputBackground,
    },
    profileTopRow: {
      flexDirection: "row",
      gap: 14,
      alignItems: "flex-end",
      marginTop: 12,
    },
    avatarOverlap: {
      marginTop: -90,
      zIndex: 2,
    },
    profileInfo: {
      flex: 1,
      minHeight: 104,
      justifyContent: "space-between",
      paddingBottom: 4,
      gap: 6,
    },
    nameBlock: {
      gap: 2,
    },
    avatarRing: {
      width: 104,
      height: 104,
      borderRadius: 52,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.inputBackground,
      position: "relative",
    },
    ringOverlay: {
      position: "absolute",
      width: 104,
      height: 104,
      borderRadius: 52,
      borderWidth: 2.5,
    },
    ringUnseen: {
      borderColor: theme.colors.button,
    },
    ringSeen: {
      borderColor: theme.colors.border,
    },
    avatar: {
      width: 94,
      height: 94,
      borderRadius: 47,
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
      fontSize: 11,
      fontWeight: "600",
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "flex-start",
      gap: 20,
      marginTop: 2,
    },
    statItem: {
      alignItems: "center",
      gap: 2,
      minWidth: 72,
    },
    statValue: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    statLabel: {
      color: theme.colors.mutedText,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    nameText: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    userText: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    bioText: {
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
    },
    actionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    primaryButton: {
      flex: 1,
      borderRadius: 10,
      backgroundColor: theme.colors.button,
      minHeight: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    secondaryButton: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      minHeight: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    highlightsRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 6,
    },
    highlightItem: {
      alignItems: "center",
      gap: 6,
    },
    highlightCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    highlightUnseen: {
      borderColor: theme.colors.button,
    },
    highlightSeen: {
      borderColor: theme.colors.border,
    },
    highlightImage: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: theme.colors.inputBackground,
    },
    highlightPlaceholder: {
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    highlightLabel: {
      color: theme.colors.mutedText,
      fontSize: 11,
    },
    error: {
      color: theme.colors.error,
      fontWeight: "500",
    },
    postsSection: {
      gap: 12,
    },
    postsTabs: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingVertical: 12,
    },
    tabItem: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      paddingBottom: 6,
    },
    tabItemActive: {
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.text,
    },
    tabIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    tabIconWrapActive: {
      backgroundColor: "transparent",
    },
    tabText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      fontWeight: "600",
    },
    tabTextActive: {
      color: theme.colors.text,
    },
    postsLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    emptyPosts: {
      color: theme.colors.mutedText,
      fontSize: 13,
      textAlign: "center",
    },
    emptyState: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
    },
    postCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
      padding: 12,
      gap: 10,
    },
    postPreview: {
      width: "100%",
      height: 190,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
    },
    videoPreview: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.button,
      gap: 4,
    },
    videoPreviewText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    treinoResumo: {
      gap: 6,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBackground,
    },
    treinoBadge: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.text,
    },
    treinoMetrics: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    treinoMetricText: {
      fontSize: 11,
      color: theme.colors.mutedText,
      fontWeight: "600",
    },
    postDescription: {
      color: theme.colors.text,
      fontSize: 14,
    },
    postMetaRow: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
    },
    metaItem: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
    },
    postMetaText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
  });
}
