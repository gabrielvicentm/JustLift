import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchHomeFeed } from "@/app/features/social/service";
import { fetchDailySummaryByUser } from "@/app/features/daily/service";
import type { DailySummary } from "@/app/features/daily/types";
import type { PostSummary, SuggestedUser } from "@/app/features/social/types";
import { fetchFollowing, followUser, getApiErrorMessage } from "@/app/features/profile/service";
import type { FollowListItem } from "@/app/features/profile/types";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

const PAGE_SIZE = 20;
const PROGRESS_GRADIENT = ["#5BE7FF", "#7C5CFF", "#FF4BD8"] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [dailyStories, setDailyStories] = useState<
    Array<{ user: FollowListItem; summary: DailySummary }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [loadingStories, setLoadingStories] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadFeed = useCallback(
    async (reset = false) => {
      if (reset) {
        if (isMountedRef.current) {
          setLoading(true);
          setError("");
          setOffset(0);
          setHasMore(true);
        }
      } else if (loadingMore || !hasMore) {
        return;
      } else {
        if (isMountedRef.current) {
          setLoadingMore(true);
        }
      }

      const requestOffset = reset ? 0 : offset;

      try {
        const data = await fetchHomeFeed(PAGE_SIZE, requestOffset);
        if (isMountedRef.current) {
          setPosts((prev) => {
            const merged = reset ? data.posts : [...prev, ...data.posts];
            const map = new Map<number, PostSummary>();
            for (const item of merged) {
              map.set(item.id, item);
            }
            return Array.from(map.values());
          });
          if (reset) {
            setSuggestedUsers(data.suggested_users ?? []);
          }
          setOffset(requestOffset + data.posts.length);
          setHasMore(data.posts.length === PAGE_SIZE);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(getApiErrorMessage(err, "carregar feed"));
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [hasMore, loadingMore, offset],
  );

  const loadDailyStories = useCallback(async () => {
    if (isMountedRef.current) {
      setLoadingStories(true);
    }
    try {
      const following = await fetchFollowing("", 50, 0);
      if (following.length === 0) {
        if (isMountedRef.current) {
          setDailyStories([]);
        }
        return;
      }

      const summaries = await Promise.allSettled(
        following.map(async (user) => ({
          user,
          summary: await fetchDailySummaryByUser(user.user_id),
        })),
      );

      const active = summaries
        .filter((item): item is PromiseFulfilledResult<{ user: FollowListItem; summary: DailySummary }> => {
          return item.status === "fulfilled";
        })
        .map((item) => item.value)
        .filter((item) => item.summary.has_active_daily);

      if (isMountedRef.current) {
        setDailyStories(active);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(getApiErrorMessage(err, "carregar Daily"));
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingStories(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFeed(true);
      loadDailyStories();
    }, [loadDailyStories, loadFeed]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed(true);
    loadDailyStories();
  }, [loadDailyStories, loadFeed]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadFeed(false);
    }
  }, [hasMore, loadFeed, loadingMore]);

  const handleFollowSuggested = useCallback(
    async (user: SuggestedUser) => {
      if (!user?.user_id || followingUserId) return;
      setFollowingUserId(user.user_id);
      try {
        await followUser(user.user_id);
        setSuggestedUsers((prev) => prev.filter((item) => item.user_id !== user.user_id));
      } catch (err) {
        setError(getApiErrorMessage(err, "seguir usuario"));
      } finally {
        setFollowingUserId(null);
      }
    },
    [followingUserId],
  );

  const renderPost = useCallback(
    ({ item }: { item: PostSummary }) => {
      const firstMedia = item.midias?.[0];
      const isTreino = item.tipo === "treino" && item.treino;

      return (
        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.postBorder}
        >
          <Pressable
            style={styles.postCard}
            onPress={() => router.push(`/screens/social/Post/${item.id}` as never)}
          >
            <View style={styles.postHeader}>
              {item.foto_perfil ? (
                <Image source={{ uri: item.foto_perfil }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {(item.nome_exibicao || item.username || "U").slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.postHeaderInfo}>
                <Text style={styles.authorName}>{item.nome_exibicao || item.username}</Text>
                <Text style={styles.authorUser}>@{item.username}</Text>
              </View>
              {isTreino ? (
                <View style={styles.badge}>
                  <Ionicons name="barbell-outline" size={12} color={theme.colors.buttonText} />
                  <Text style={styles.badgeText}>Treino</Text>
                </View>
              ) : null}
            </View>

            {firstMedia ? (
              firstMedia.type === "image" ? (
                <Image source={{ uri: firstMedia.url }} style={styles.media} />
              ) : (
                <View style={[styles.media, styles.mediaPlaceholder]}>
                  <Ionicons name="videocam" size={24} color={theme.colors.buttonText} />
                </View>
              )
            ) : (
              <View style={[styles.media, styles.mediaPlaceholder]}>
                <Ionicons name="images-outline" size={24} color={theme.colors.buttonText} />
              </View>
            )}

            {item.descricao ? (
              <Text style={styles.description} numberOfLines={3}>
                {item.descricao}
              </Text>
            ) : null}

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Ionicons name="heart-outline" size={14} color={theme.colors.text} />
                <Text style={styles.metricText}>{item.likes_count}</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="chatbubble-outline" size={14} color={theme.colors.text} />
                <Text style={styles.metricText}>{item.comments_count}</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="bookmark-outline" size={14} color={theme.colors.text} />
                <Text style={styles.metricText}>{item.saves_count}</Text>
              </View>
            </View>
          </Pressable>
        </LinearGradient>
      );
    },
    [router, styles, theme.colors.buttonText, theme.colors.text],
  );

  const renderSuggestedUser = useCallback(
    ({ item }: { item: SuggestedUser }) => (
      <View style={styles.suggestedCard}>
        <Pressable
          style={styles.suggestedInfo}
          onPress={() =>
            router.push({ pathname: "/screens/social/[username]", params: { username: item.username } } as never)
          }
        >
          {item.foto_perfil ? (
            <Image source={{ uri: item.foto_perfil }} style={styles.suggestedAvatar} />
          ) : (
            <View style={[styles.suggestedAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {(item.nome_exibicao || item.username || "U").slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.suggestedTextWrap}>
            <Text style={styles.suggestedName}>{item.nome_exibicao || item.username}</Text>
            <Text style={styles.suggestedUser}>@{item.username}</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.followButton, followingUserId === item.user_id && styles.disabled]}
          onPress={() => handleFollowSuggested(item)}
          disabled={followingUserId === item.user_id}
        >
          <Text style={styles.followButtonText}>
            {followingUserId === item.user_id ? "Seguindo..." : "Seguir"}
          </Text>
        </Pressable>
      </View>
    ),
    [followingUserId, handleFollowSuggested, router, styles],
  );

  const renderDailyStory = useCallback(
    ({ item }: { item: { user: FollowListItem; summary: DailySummary } }) => {
      const { user, summary } = item;
      const ringStyle = summary.has_unseen_daily ? styles.storyRingUnseen : styles.storyRingSeen;

      return (
        <Pressable
          style={styles.storyItem}
          onPress={() => router.push({ pathname: "/screens/social/VerDaily", params: { userId: user.user_id } } as never)}
        >
          <View style={[styles.storyRing, ringStyle]}>
            {user.foto_perfil ? (
              <Image source={{ uri: user.foto_perfil }} style={styles.storyAvatar} />
            ) : (
              <View style={[styles.storyAvatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>
                  {(user.nome_exibicao || user.username || "U").slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.storyLabel} numberOfLines={1}>
            {user.nome_exibicao || user.username}
          </Text>
        </Pressable>
      );
    },
    [router, styles],
  );

  const listHeader = (
    <>
      <View style={styles.headerRow}>
        <View style={styles.headerActions}>
          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.iconBorder}
          >
            <Pressable
              style={styles.iconButton}
              onPress={() => router.push("/screens/social/CriarPost")}
              accessibilityRole="button"
              accessibilityLabel="Criar post"
            >
              <Ionicons name="add-circle-outline" size={22} color={theme.colors.text} />
            </Pressable>
          </LinearGradient>

          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.iconBorder}
          >
            <Pressable
              style={styles.iconButton}
              onPress={() => router.push("/screens/Explorar")}
              accessibilityRole="button"
              accessibilityLabel="Explorar"
            >
              <Ionicons name="search" size={22} color={theme.colors.text} />
            </Pressable>
          </LinearGradient>
        </View>
      </View>

      {dailyStories.length > 0 ? (
        <View style={styles.storiesSection}>
          <FlatList
            data={dailyStories}
            keyExtractor={(item) => item.user.user_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={renderDailyStory}
            contentContainerStyle={styles.storiesList}
          />
        </View>
      ) : loadingStories ? (
        <View style={styles.storiesLoading}>
          <ActivityIndicator color={theme.colors.text} size="small" />
          <Text style={styles.loadingText}>Carregando Daily...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {suggestedUsers.length > 0 ? (
        <View style={styles.suggestedSection}>
          <Text style={styles.sectionTitle}>Sugestoes para seguir</Text>
          <FlatList
            data={suggestedUsers}
            keyExtractor={(item) => item.user_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={renderSuggestedUser}
            contentContainerStyle={styles.suggestedList}
          />
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {loading && posts.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={styles.loadingText}>Carregando feed...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPost}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            !loading ? <Text style={styles.emptyText}>Nenhum post encontrado.</Text> : null
          }
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={theme.colors.text} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      marginBottom: 12,
      marginTop: 6,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBorder: {
      borderRadius: 12,
      padding: 1.5,
    },
    listContent: {
      paddingBottom: 24,
      gap: 12,
    },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    loadingText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "500",
    },
    error: {
      color: theme.colors.error,
      marginBottom: 12,
    },
    suggestedSection: {
      marginBottom: 12,
      gap: 8,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    storiesSection: {
      marginBottom: 12,
      gap: 8,
    },
    storiesList: {
      gap: 12,
      paddingVertical: 4,
    },
    storyItem: {
      alignItems: "center",
      gap: 6,
      width: 76,
    },
    storyRing: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.inputBackground,
    },
    storyRingUnseen: {
      borderColor: theme.colors.button,
    },
    storyRingSeen: {
      borderColor: theme.colors.border,
    },
    storyAvatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
    },
    storyLabel: {
      color: theme.colors.mutedText,
      fontSize: 11,
      textAlign: "center",
    },
    storiesLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    suggestedList: {
      gap: 12,
      paddingVertical: 4,
    },
    suggestedCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      minWidth: 220,
    },
    suggestedInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    suggestedAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    suggestedTextWrap: {
      flex: 1,
    },
    suggestedName: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    suggestedUser: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    followButton: {
      borderRadius: 10,
      backgroundColor: theme.colors.button,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    followButtonText: {
      color: theme.colors.buttonText,
      fontSize: 12,
      fontWeight: "600",
    },
    disabled: {
      opacity: 0.6,
    },
    postCard: {
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      padding: 14,
      gap: 10,
    },
    postBorder: {
      borderRadius: 16,
      padding: 1.5,
    },
    postHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatarFallback: {
      backgroundColor: theme.colors.inputBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarFallbackText: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 14,
    },
    postHeaderInfo: {
      flex: 1,
    },
    authorName: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    authorUser: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.button,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeText: {
      color: theme.colors.buttonText,
      fontSize: 11,
      fontWeight: "600",
    },
    media: {
      width: "100%",
      height: 220,
      borderRadius: 12,
    },
    mediaPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.inputBackground,
    },
    description: {
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
    metricsRow: {
      flexDirection: "row",
      gap: 16,
      alignItems: "center",
    },
    metricItem: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
    },
    metricText: {
      color: theme.colors.text,
      fontSize: 12,
    },
    emptyText: {
      color: theme.colors.mutedText,
      textAlign: "center",
      marginTop: 24,
    },
    footerLoading: {
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
