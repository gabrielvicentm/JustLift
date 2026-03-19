import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  blockConversationUser,
  fetchConversas,
  hideConversation,
  pinConversation,
  unblockConversationUser,
  unpinConversation,
} from "@/app/features/chat/service";
import type { ConversaListItem } from "@/app/features/chat/types";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ConversasScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [query, setQuery] = useState("");
  const [conversas, setConversas] = useState<ConversaListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<ConversaListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const requestIdRef = useRef(0);
  const queryRef = useRef("");
  const conversasLengthRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const isNearTopRef = useRef(true);
  const skipNextPressRef = useRef(false);

  const loadConversas = useCallback(async (rawQuery: string, mode: "replace" | "append" = "replace") => {
    const safeQuery = rawQuery.trim();
    const nextOffset = mode === "append" ? conversasLengthRef.current : 0;

    if (mode === "append" && (loadingMoreRef.current || loadingRef.current || !hasMoreRef.current)) {
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    queryRef.current = safeQuery;

    if (mode === "append") {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      loadingRef.current = true;
      setLoading(true);
      setError("");
    }

    try {
      const response = await fetchConversas(safeQuery, 10, nextOffset);
      if (requestId === requestIdRef.current) {
        hasMoreRef.current = response.length === 10;
        setHasMore(hasMoreRef.current);
        setConversas((prev) => {
          const nextConversas = mode === "append" ? [...prev, ...response] : response;
          conversasLengthRef.current = nextConversas.length;
          return nextConversas;
        });
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        if (mode !== "append") {
          conversasLengthRef.current = 0;
          setConversas([]);
        }
        setError(getApiErrorMessage(err, "carregar conversas"));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        loadingMoreRef.current = false;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      hasMoreRef.current = true;
      setHasMore(true);
      loadConversas(query, "replace");
    }, 250);

    return () => clearTimeout(timer);
  }, [query, loadConversas]);

  useFocusEffect(
    useCallback(() => {
      loadConversas(queryRef.current, "replace");
      const intervalId = setInterval(() => {
        if (isNearTopRef.current && !loadingMoreRef.current) {
          loadConversas(queryRef.current, "replace");
        }
      }, 3000);

      return () => clearInterval(intervalId);
    }, [loadConversas]),
  );

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isNearTopRef.current = event.nativeEvent.contentOffset.y < 80;
  }, []);

  const closeActions = useCallback(() => {
    if (actionLoading) {
      return;
    }

    setSelectedConversation(null);
  }, [actionLoading]);

  const runConversationAction = useCallback(async (action: () => Promise<void>) => {
    try {
      setActionLoading(true);
      await action();
      setSelectedConversation(null);
      hasMoreRef.current = true;
      setHasMore(true);
      await loadConversas(queryRef.current, "replace");
    } catch (err) {
      setError(getApiErrorMessage(err, "executar acao da conversa"));
    } finally {
      setActionLoading(false);
    }
  }, [loadConversas]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Conversas</Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Pesquisar conversas"
        placeholderTextColor={theme.colors.mutedText}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={conversas}
        keyExtractor={(item) => item.user_id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReachedThreshold={0.2}
        onEndReached={() => loadConversas(queryRef.current, "append")}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              hasMoreRef.current = true;
              setHasMore(true);
              setRefreshing(true);
              loadConversas(queryRef.current, "replace");
            }}
            tintColor={theme.colors.text}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              Nenhuma conversa encontrada.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const avatarUri = String(item.foto_perfil || "").trim();
          const title = item.nome_exibicao || item.username;
          const preview = item.last_message
            ? `${item.last_message_is_mine ? "Voce: " : ""}${item.last_message}`
            : item.is_blocked
              ? "Usuario bloqueado"
            : "Toque para iniciar a conversa";
          const openChat = () =>
            router.push({
              pathname: "/screens/social/Chat",
              params: {
                targetUserId: item.user_id,
                username: item.username,
                nomeExibicao: item.nome_exibicao || "",
                fotoPerfil: item.foto_perfil || "",
              },
            });
          const handlePress = () => {
            if (skipNextPressRef.current) {
              skipNextPressRef.current = false;
              return;
            }

            openChat();
          };

          return (
            <Pressable
              style={styles.card}
              onPress={handlePress}
              onLongPress={() => {
                skipNextPressRef.current = true;
                setSelectedConversation(item);
              }}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>{title.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}

              <View style={styles.cardInfo}>
                <View style={styles.cardHeader}>
                  <View style={styles.profileMeta}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSubtitle}>@{item.username}</Text>
                  </View>
                  {item.is_pinned ? (
                    <MaterialCommunityIcons name="pin" size={13} color="#FFFFFF" style={styles.pinIcon} />
                  ) : null}
                </View>
                <Text numberOfLines={1} style={styles.preview}>
                  {preview}
                </Text>
                {item.unread_count > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread_count}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreRow}>
              <ActivityIndicator color={theme.colors.text} />
            </View>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.text} />
        </View>
      ) : null}

      <Modal
        visible={Boolean(selectedConversation)}
        transparent
        animationType="fade"
        onRequestClose={closeActions}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeActions}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {selectedConversation ? (
              <>
                <Text style={styles.modalTitle}>
                  {selectedConversation.nome_exibicao || selectedConversation.username}
                </Text>
                <Text style={styles.modalSubtitle}>@{selectedConversation.username}</Text>

                <Pressable
                  style={styles.modalPrimaryAction}
                  disabled={actionLoading}
                  onPress={() =>
                    runConversationAction(() =>
                      selectedConversation.is_pinned
                        ? unpinConversation(selectedConversation.user_id)
                        : pinConversation(selectedConversation.user_id)
                    )
                  }
                >
                  <Text style={styles.modalActionText}>
                    {selectedConversation.is_pinned ? "Desafixar" : "Fixar"}
                  </Text>
                </Pressable>

                <View style={styles.modalDivider} />

                <Pressable
                  style={styles.modalAction}
                  disabled={actionLoading}
                  onPress={() =>
                    runConversationAction(() => hideConversation(selectedConversation.user_id))
                  }
                >
                  <Text style={styles.modalActionText}>Excluir conversa</Text>
                </Pressable>

                <Pressable
                  style={styles.modalAction}
                  disabled={actionLoading}
                  onPress={() =>
                    runConversationAction(() =>
                      selectedConversation.is_blocked
                        ? unblockConversationUser(selectedConversation.user_id)
                        : blockConversationUser(selectedConversation.user_id)
                    )
                  }
                >
                  <Text style={[styles.modalActionText, styles.modalDangerText]}>
                    {selectedConversation.is_blocked ? "Desbloquear" : "Bloquear"}
                  </Text>
                </Pressable>

                <Pressable style={styles.modalCancel} disabled={actionLoading} onPress={closeActions}>
                  {actionLoading ? (
                    <ActivityIndicator color={theme.colors.text} />
                  ) : (
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  )}
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      gap: 10,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    backButton: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
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
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
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
      fontSize: 16,
      fontWeight: "700",
    },
    cardInfo: {
      flex: 1,
      gap: 2,
      minHeight: 50,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
    },
    profileMeta: {
      flex: 1,
      gap: 2,
      paddingRight: 28,
    },
    cardTitle: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    cardSubtitle: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    pinIcon: {
      marginTop: 2,
    },
    preview: {
      color: theme.colors.text,
      fontSize: 13,
      paddingRight: 28,
    },
    badge: {
      position: "absolute",
      right: 0,
      bottom: 0,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    badgeText: {
      color: theme.colors.buttonText,
      fontSize: 12,
      fontWeight: "700",
    },
    loadingRow: {
      paddingBottom: 16,
    },
    loadingMoreRow: {
      paddingVertical: 14,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "flex-end",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 34,
    },
    modalCard: {
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      gap: 8,
    },
    modalTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    modalSubtitle: {
      color: theme.colors.mutedText,
      fontSize: 13,
      marginBottom: 4,
    },
    modalAction: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBackground,
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    modalPrimaryAction: {
      minHeight: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      paddingHorizontal: 14,
      marginBottom: 6,
    },
    modalActionText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "600",
    },
    modalDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      opacity: 0.8,
      marginBottom: 6,
    },
    modalDangerText: {
      color: theme.colors.error,
    },
    modalCancel: {
      minHeight: 46,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    modalCancelText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
