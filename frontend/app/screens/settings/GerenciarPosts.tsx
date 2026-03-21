import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { fetchMyProfile, getApiErrorMessage } from "@/app/features/profile/service";
import { fetchPostsByUser } from "@/app/features/social/service";
import type { PostSummary } from "@/app/features/social/types";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

export default function GerenciarPostsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const gridSpacing = 6;
  const horizontalPadding = 16;
  const baseWidth = width && width > 0 ? width : 360;
  const tileSize = Math.floor((baseWidth - horizontalPadding * 2 - gridSpacing * 2) / 3);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const profile = await fetchMyProfile();
      const data = await fetchPostsByUser(profile.user_id);
      setPosts(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "carregar seus posts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts]),
  );

  const headerContent = (
    <>
      <View style={styles.headerRow}>
        <LinearGradient
          colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.backBorder}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>
        </LinearGradient>
      </View>

      <LinearGradient
        colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.heroBorder}
      >
        <View style={styles.heroCard}>
          <Text style={styles.title}>Gerenciar posts</Text>
          <Text style={styles.subtitle}>
            Toque em um post para editar midias, comentarios ou excluir.
          </Text>
        </View>
      </LinearGradient>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <View style={styles.gridContent}>{headerContent}</View>
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.text} />
            <Text style={styles.loadingText}>Carregando...</Text>
          </View>
        </>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          numColumns={3}
          ListHeaderComponent={headerContent}
          ListEmptyComponent={<Text style={styles.emptyText}>Voce ainda nao tem posts para gerenciar.</Text>}
          renderItem={({ item }) => {
            const firstMedia = item.midias?.[0];

            return (
              <Pressable
                style={[styles.gridItem, { width: tileSize, height: tileSize }]}
                onPress={() => router.push(`/screens/social/EditarPost?postId=${item.id}` as never)}
              >
                {firstMedia ? (
                  firstMedia.type === "image" ? (
                    <>
                      <Image source={{ uri: firstMedia.url }} style={styles.gridImage} />
                      <View style={styles.mediaBadge}>
                        <Ionicons name="play" size={12} color="#E0E0E0" />
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={[styles.gridImage, styles.videoPreview]}>
                        <Text style={styles.videoText}>Video</Text>
                      </View>
                      <View style={styles.mediaBadge}>
                        <Ionicons name="play" size={12} color="#E0E0E0" />
                      </View>
                    </>
                  )
                ) : (
                  <View style={[styles.gridImage, styles.emptyPreview]}>
                    <Text style={styles.emptyPreviewText}>Sem midia</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}

    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#0B0E18",
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: 12,
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
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    backButtonText: {
      color: "#E0E0E0",
      fontWeight: "700",
    },
    heroBorder: {
      borderRadius: 18,
      padding: 1.5,
      shadowColor: "#74D3FF",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
      marginBottom: 12,
    },
    heroCard: {
      borderRadius: 16,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      padding: 16,
      gap: 6,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: "#E0E0E0",
      textShadowColor: "rgba(0, 255, 255, 0.65)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    subtitle: {
      color: "#7FE7FF",
      fontSize: 13,
      textShadowColor: "rgba(0, 255, 255, 0.35)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    loadingWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 16,
      paddingHorizontal: 16,
    },
    loadingText: {
      color: "#E0E0E0",
      fontWeight: "600",
    },
    emptyText: {
      color: "#7FE7FF",
      textAlign: "center",
      marginTop: 16,
      paddingHorizontal: 16,
    },
    videoPreview: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#7C5CFF",
    },
    videoText: {
      color: "#0B0E18",
      fontWeight: "700",
      fontSize: 12,
    },
    gridContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      paddingTop: 4,
    },
    gridRow: {
      gap: 6,
      marginBottom: 6,
      justifyContent: "space-between",
    },
    gridItem: {
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      overflow: "hidden",
      borderRadius: 12,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    mediaBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(11, 14, 24, 0.7)",
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    gridImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
      backgroundColor: "#0B0E18",
    },
    emptyPreview: {
      alignItems: "center",
      justifyContent: "center",
    },
    emptyPreviewText: {
      color: "#7FE7FF",
      fontSize: 11,
      fontWeight: "600",
    },
    error: {
      color: "#F43F5E",
      fontWeight: "600",
      paddingHorizontal: 16,
      marginBottom: 8,
    },
  });
}
