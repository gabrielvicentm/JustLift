import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchExploreFeed } from "@/app/features/social/service";
import type { PostSummary } from "@/app/features/social/types";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

const PAGE_SIZE = 30;
const PROGRESS_GRADIENT = ["#5BE7FF", "#7C5CFF", "#FF4BD8"] as const;

export default function ExplorarScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const loadFeed = useCallback(async (reset = false) => {
      if (reset) {
        setLoading(true);
        setError("");
        setOffset(0);
        setHasMore(true);
        offsetRef.current = 0;
        hasMoreRef.current = true;
      } else if (loadingMoreRef.current || !hasMoreRef.current) {
        return;
      } else {
        setLoadingMore(true);
        loadingMoreRef.current = true;
      }

      const requestOffset = reset ? 0 : offsetRef.current;

      try {
        const data = await fetchExploreFeed(PAGE_SIZE, requestOffset);
        setPosts((prev) => (reset ? data.posts : [...prev, ...data.posts]));
        const nextOffset = requestOffset + data.posts.length;
        offsetRef.current = nextOffset;
        hasMoreRef.current = data.posts.length === PAGE_SIZE;
        setOffset(nextOffset);
        setHasMore(hasMoreRef.current);
      } catch (err) {
        setError(getApiErrorMessage(err, "carregar feed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      loadFeed(true);
    }, [loadFeed]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed(true);
  }, [loadFeed]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMoreRef.current && hasMoreRef.current) {
      loadFeed(false);
    }
  }, [loadFeed]);

  const gridSpacing = 8;
  const horizontalPadding = 16;
  const baseWidth = width && width > 0 ? width : 360;
  const tileSize = Math.floor((baseWidth - horizontalPadding * 2 - gridSpacing * 2) / 3);

  const renderPost = useCallback(
    ({ item }: { item: PostSummary }) => {
      const firstMedia = item.midias?.[0];
      const isTreino = item.tipo === "treino" && item.treino;
      const isVideo = firstMedia?.type === "video";

      return (
        <Pressable
          style={[styles.gridItem, { width: tileSize, height: tileSize }]}
          onPress={() => router.push(`/screens/social/Post/${item.id}` as never)}
        >
          {firstMedia ? (
            firstMedia.type === "image" ? (
              <Image source={{ uri: firstMedia.url }} style={styles.gridImage} />
            ) : (
              <View style={[styles.gridImage, styles.gridPlaceholder]}>
                <Ionicons name="videocam" size={20} color={theme.colors.buttonText} />
              </View>
            )
          ) : (
            <View style={[styles.gridImage, styles.gridPlaceholder]}>
              <Ionicons name="images-outline" size={20} color={theme.colors.buttonText} />
            </View>
          )}

          {isVideo || isTreino ? (
            <View style={styles.gridBadge}>
              {isVideo ? <Ionicons name="play" size={12} color={theme.colors.buttonText} /> : null}
              {isTreino ? <Ionicons name="barbell-outline" size={12} color={theme.colors.buttonText} /> : null}
            </View>
          ) : null}
        </Pressable>
      );
    },
    [router, styles, theme.colors.buttonText, tileSize],
  );

  const listHeader = (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Explorar</Text>
        <View style={styles.headerActions}>
          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.iconBorder}
          >
            <Pressable
              style={styles.iconButton}
              onPress={() => router.push("/screens/social/SearchUsers")}
              accessibilityRole="button"
              accessibilityLabel="Pesquisar"
            >
              <Ionicons name="search" size={22} color={theme.colors.text} />
            </Pressable>
          </LinearGradient>
        </View>
      </View>
      <LinearGradient
        colors={PROGRESS_GRADIENT}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.searchBorder}
      >
        <Pressable
          style={styles.searchBar}
          onPress={() => router.push("/screens/social/SearchUsers")}
          accessibilityRole="button"
          accessibilityLabel="Pesquisar posts ou usuarios"
        >
          <Ionicons name="search" size={18} color={theme.colors.mutedText} />
          <Text style={styles.searchPlaceholder}>Pesquisar posts ou usuarios</Text>
        </Pressable>
      </LinearGradient>
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
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
      justifyContent: "space-between",
      marginBottom: 10,
      marginTop: 6,
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.colors.text,
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
    },
    gridRow: {
      gap: 8,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchBorder: {
      borderRadius: 12,
      padding: 1.5,
      marginBottom: 12,
    },
    searchPlaceholder: {
      color: theme.colors.mutedText,
      fontSize: 13,
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
    gridItem: {
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 8,
    },
    gridImage: {
      width: "100%",
      height: "100%",
    },
    gridPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.inputBackground,
    },
    gridBadge: {
      position: "absolute",
      right: 6,
      bottom: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 4,
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
