import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  fetchFollowers,
  fetchFollowing,
  getApiErrorMessage,
  removeFollower,
  removeFollowing,
} from "@/app/features/profile/service";
import type { FollowListItem } from "@/app/features/profile/types";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

type ActiveTab = "followers" | "following";

export default function FollowersFollowingScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeTab, setActiveTab] = useState<ActiveTab>("followers");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FollowListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const runFetch = async (rawQuery: string, tab: ActiveTab) => {
    setLoading(true);
    setError("");
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    try {
      const q = rawQuery.trim();
      const response = tab === "followers" ? await fetchFollowers(q) : await fetchFollowing(q);
      if (requestId === requestIdRef.current) {
        setItems(response);
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setItems([]);
        setError(getApiErrorMessage(err, "carregar lista"));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      runFetch(query, activeTab);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  const handleRemove = (user: FollowListItem) => {
    const label = activeTab === "followers" ? "remover seguidor" : "deixar de seguir";

    Alert.alert(
      "Confirmar",
      `Deseja ${label} @${user.username}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              setRemovingUserId(user.user_id);
              if (activeTab === "followers") {
                await removeFollower(user.user_id);
              } else {
                await removeFollowing(user.user_id);
              }
              setItems((prev) => prev.filter((item) => item.user_id !== user.user_id));
            } catch (err) {
              setError(getApiErrorMessage(err, "remover usuario"));
            } finally {
              setRemovingUserId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Seguindo e seguidores</Text>

      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setActiveTab("followers")}
          style={[styles.tabButton, activeTab === "followers" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabText, activeTab === "followers" && styles.tabTextActive]}>
            Seguidores
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("following")}
          style={[styles.tabButton, activeTab === "following" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabText, activeTab === "following" && styles.tabTextActive]}>
            Seguindo
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={
          activeTab === "followers"
            ? "Pesquisar nos seguidores"
            : "Pesquisar em quem voce segue"
        }
        placeholderTextColor={theme.colors.mutedText}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              {activeTab === "followers"
                ? "Nenhum seguidor encontrado."
                : "Nenhum usuario encontrado em seguindo."}
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const isRemoving = removingUserId === item.user_id;

          return (
            <View style={styles.card}>
              {item.foto_perfil ? (
                <Image source={{ uri: item.foto_perfil }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {(item.nome_exibicao || item.username).slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.cardInfo}>
                <Text style={styles.username}>@{item.username}</Text>
                {item.nome_exibicao ? <Text style={styles.displayName}>{item.nome_exibicao}</Text> : null}
              </View>

              <Pressable
                disabled={isRemoving}
                onPress={() => handleRemove(item)}
                style={[styles.removeButton, isRemoving && styles.disabled]}
              >
                {isRemoving ? (
                  <ActivityIndicator color={theme.colors.buttonText} />
                ) : (
                  <Text style={styles.removeButtonText}>Remover</Text>
                )}
              </Pressable>
            </View>
          );
        }}
      />

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.text} />
        </View>
      ) : null}
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
    headerRow: {
      flexDirection: "row",
      justifyContent: "flex-start",
    },
    backButton: {
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
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    tabRow: {
      flexDirection: "row",
      gap: 8,
    },
    tabButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    tabButtonActive: {
      backgroundColor: theme.colors.button,
      borderColor: theme.colors.button,
    },
    tabText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    tabTextActive: {
      color: theme.colors.buttonText,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
    },
    error: {
      color: theme.colors.error,
      fontWeight: "500",
    },
    listContent: {
      paddingBottom: 24,
      gap: 8,
    },
    emptyText: {
      color: theme.colors.mutedText,
      textAlign: "center",
      marginTop: 20,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
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
    cardInfo: {
      flex: 1,
      gap: 2,
    },
    username: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    displayName: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    removeButton: {
      minWidth: 88,
      minHeight: 36,
      borderRadius: 8,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    removeButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    disabled: {
      opacity: 0.7,
    },
    loadingRow: {
      paddingBottom: 16,
    },
  });
}
