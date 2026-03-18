import {
  getApiErrorMessage,
  searchUsersByUsername,
} from "@/app/features/profile/service";
import type { SearchUserResponseItem } from "@/app/features/profile/types";
import { searchPostsByDescription } from "@/app/features/social/service";
import type { SearchPostResponseItem } from "@/app/features/social/types";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type ActiveTab = "profiles" | "posts";

export default function SearchUsersScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUserResponseItem[]>([]);
  const [postResults, setPostResults] = useState<SearchPostResponseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("profiles");
  const searchRequestIdRef = useRef(0);

  const gridSpacing = 2;
  const horizontalPadding = 0;
  const baseWidth = width && width > 0 ? width : 360;
  const tileSize = Math.floor((baseWidth - horizontalPadding * 2 - gridSpacing * 2) / 3);

  const runSearch = async (rawQuery: string) => {
    const q = rawQuery.trim();
    setError("");

    if (q.length < 1) {
      setResults([]);
      setPostResults([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    setLoading(true);
    searchRequestIdRef.current += 1;
    const requestId = searchRequestIdRef.current;

    try {
      const [usersResult, postsResult] = await Promise.allSettled([
        searchUsersByUsername(q, 20),
        searchPostsByDescription(q, 20),
      ]);

      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      let nextError = "";
      if (usersResult.status === "fulfilled") {
        setResults(usersResult.value);
      } else {
        setResults([]);
        nextError = getApiErrorMessage(usersResult.reason, "pesquisar usuarios");
      }

      if (postsResult.status === "fulfilled") {
        setPostResults(postsResult.value);
      } else {
        setPostResults([]);
        if (!nextError) {
          nextError = getApiErrorMessage(postsResult.reason, "pesquisar posts");
        }
      }

      setError(nextError);
    } catch (err) {
      if (requestId === searchRequestIdRef.current) {
        setError(getApiErrorMessage(err, "pesquisar usuarios ou posts"));
        setResults([]);
        setPostResults([]);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError("");
      setResults([]);
      setPostResults([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      runSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Procure usuários ou posts</Text>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={theme.colors.mutedText} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={activeTab === "profiles" ? "Pesquisar perfis" : "Pesquisar posts"}
            placeholderTextColor={theme.colors.mutedText}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query)}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {hasSearched && query.trim().length < 1 ? (
          <Text style={styles.hint}>Digite ao menos 1 caractere para pesquisar.</Text>
        ) : null}

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setActiveTab("profiles")}
            style={[styles.tabButton, activeTab === "profiles" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, activeTab === "profiles" && styles.tabTextActive]}>
              Perfis
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("posts")}
            style={[styles.tabButton, activeTab === "posts" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, activeTab === "posts" && styles.tabTextActive]}>
              Posts
            </Text>
          </Pressable>
        </View>
      </View>

      {activeTab === "profiles" ? (
        <FlatList
          key="profiles"
          data={results}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !loading && hasSearched && query.trim().length >= 1 ? (
              <Text style={styles.emptyText}>Nenhum perfil encontrado.</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const avatarUri = String(item.foto_perfil || "").trim();
            const displayName = item.nome_exibicao || item.username;

            return (
              <Pressable
                style={styles.resultCard}
                onPress={() => router.push(`/screens/social/${item.username}` as never)}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>
                      {String(displayName).slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.resultContent}>
                  <Text style={styles.resultDisplayName}>{displayName}</Text>
                  <Text style={styles.resultSubtle}>@{item.username}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          key="posts"
          data={postResults}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          keyboardShouldPersistTaps="handled"
          numColumns={3}
          ListEmptyComponent={
            !loading && hasSearched && query.trim().length >= 1 ? (
              <Text style={styles.emptyText}>Nenhum post encontrado.</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const mediaUri = String(item.media_url || "").trim();
            const fallbackUri = String(item.foto_perfil || "").trim();
            const displayName = item.nome_exibicao || item.username;
            const isVideo = item.media_type === "video";
            const thumbUri = mediaUri || fallbackUri;

            return (
              <Pressable
                style={[styles.gridItem, { width: tileSize, height: tileSize }]}
                onPress={() => router.push(`/screens/social/Post/${item.id}` as never)}
              >
                {mediaUri && isVideo ? (
                  <View style={[styles.gridImage, styles.videoTile]}>
                    <Text style={styles.videoText}>Video</Text>
                  </View>
                ) : thumbUri ? (
                  <Image
                    source={{ uri: thumbUri }}
                    style={styles.gridImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.gridImage, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>
                      {String(displayName || "").slice(0, 1).toUpperCase()}
                    </Text>
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
      backgroundColor: theme.colors.background,
      paddingTop: 18,
      gap: 10,
    },
    header: {
      paddingHorizontal: 16,
      gap: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: 4,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.inputBackground,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    tabRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabButtonActive: {
      borderBottomColor: theme.colors.text,
    },
    tabText: {
      color: theme.colors.mutedText,
      fontWeight: "600",
      fontSize: 14,
    },
    tabTextActive: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    input: {
      flex: 1,
      paddingHorizontal: 4,
      paddingVertical: 6,
      backgroundColor: "transparent",
      color: theme.colors.text,
    },
    error: {
      color: theme.colors.error,
      fontWeight: "500",
    },
    hint: {
      color: theme.colors.mutedText,
      fontWeight: "500",
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 8,
    },
    gridContent: {
      paddingBottom: 24,
    },
    gridRow: {
      justifyContent: "space-between",
      gap: 2,
      marginBottom: 2,
    },
    gridItem: {
      backgroundColor: theme.colors.inputBackground,
      overflow: "hidden",
    },
    gridImage: {
      width: "100%",
      height: "100%",
      backgroundColor: theme.colors.inputBackground,
    },
    videoTile: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.button,
    },
    videoText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 12,
    },
    emptyText: {
      color: theme.colors.mutedText,
      textAlign: "center",
      marginTop: 16,
    },
    resultCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      gap: 10,
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.inputBackground,
    },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    avatarFallbackText: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 16,
    },
    resultDisplayName: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    resultContent: {
      flex: 1,
      gap: 4,
    },
    resultSubtle: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
  });
}
