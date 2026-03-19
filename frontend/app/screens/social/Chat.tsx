import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchChatMessages, sendChatMessage } from "@/app/features/chat/service";
import type { ChatMessage, ChatTargetUser } from "@/app/features/chat/types";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 20;
const EXPAND_MESSAGE_LENGTH = 180;
const dedupeMessages = (items: ChatMessage[]) => {
  const seen = new Set<number>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
};

const hasSameMessages = (left: ChatMessage[], right: ChatMessage[]) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const other = right[index];
    return other && item.id === other.id && item.updated_at === other.updated_at;
  });
};

function MessageBubble({
  item,
  isMine,
  styles,
  theme,
}: {
  item: ChatMessage;
  isMine: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = item.content.length > EXPAND_MESSAGE_LENGTH;

  return (
    <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
      <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
        <Text
          numberOfLines={!expanded && shouldCollapse ? 5 : undefined}
          style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}
        >
          {item.content}
        </Text>
        {shouldCollapse ? (
          <Pressable onPress={() => setExpanded((prev) => !prev)} hitSlop={8}>
            <Text style={[styles.expandText, { color: isMine ? theme.colors.buttonText : theme.colors.text }]}>
              {expanded ? "Ver menos" : "Ver mais"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { targetUserId, username, nomeExibicao, fotoPerfil } = useLocalSearchParams<{
    targetUserId?: string;
    username?: string;
    nomeExibicao?: string;
    fotoPerfil?: string;
  }>();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const safeTargetUserId = Array.isArray(targetUserId) ? targetUserId[0] : targetUserId;
  const safeUsername = Array.isArray(username) ? username[0] : username;
  const safeNomeExibicao = Array.isArray(nomeExibicao) ? nomeExibicao[0] : nomeExibicao;
  const safeFotoPerfil = Array.isArray(fotoPerfil) ? fotoPerfil[0] : fotoPerfil;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [targetUser, setTargetUser] = useState<ChatTargetUser | null>(
    safeTargetUserId
      ? {
          user_id: safeTargetUserId,
          username: safeUsername || "",
          nome_exibicao: safeNomeExibicao || null,
          foto_perfil: safeFotoPerfil || null,
        }
      : null,
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [inputBarHeight, setInputBarHeight] = useState(72);
  const [keyboardSpacerHeight, setKeyboardSpacerHeight] = useState(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const offsetRef = useRef(0);
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const hasAnchoredToBottomRef = useRef(false);
  const keyboardOpenRef = useRef(false);
  const shouldSnapToBottomRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const preserveScrollOnNextContentChangeRef = useRef(false);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const displayedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
      setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated });
      }, 80);
    });
  }, []);

  const loadMessages = useCallback(async (mode: "replace" | "append-older" = "replace", showLoading = false) => {
    if (!safeTargetUserId) {
      setLoading(false);
      setError("Chat invalido.");
      return;
    }

    if (mode === "append-older" && (loadingMoreRef.current || !hasMoreRef.current)) {
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
    if (mode === "append-older") {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    try {
      const nextOffset = mode === "append-older" ? offsetRef.current : 0;
      const response = await fetchChatMessages(safeTargetUserId, PAGE_SIZE, nextOffset);
      setTargetUser(response.targetUser);
      setError("");
      hasMoreRef.current = response.messages.length === PAGE_SIZE;
      setHasMore(hasMoreRef.current);

      if (mode === "append-older") {
        preserveScrollOnNextContentChangeRef.current = response.messages.length > 0;
        shouldSnapToBottomRef.current = false;
        offsetRef.current += response.messages.length;
        setMessages((prev) => dedupeMessages([...response.messages, ...prev]));
      } else {
        offsetRef.current = response.messages.length;
        const nextMessages = dedupeMessages(response.messages);
        setMessages((prev) => (hasSameMessages(prev, nextMessages) ? prev : nextMessages));
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "carregar mensagens"));
    } finally {
      setLoading(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [safeTargetUserId]);

  useEffect(() => {
    hasAnchoredToBottomRef.current = false;
    shouldSnapToBottomRef.current = true;
    hasMoreRef.current = true;
    loadingMoreRef.current = false;
    setHasMore(true);
    setLoadingMore(false);
    loadMessages("replace", true);
  }, [loadMessages]);

  useEffect(() => {
    if (!safeTargetUserId) {
      return;
    }

    setTargetUser(
      safeTargetUserId
        ? {
            user_id: safeTargetUserId,
            username: safeUsername || "",
            nome_exibicao: safeNomeExibicao || null,
            foto_perfil: safeFotoPerfil || null,
          }
        : null,
    );
  }, [safeFotoPerfil, safeNomeExibicao, safeTargetUserId, safeUsername]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboardOpenRef.current = true;
      shouldSnapToBottomRef.current = true;
      const height = Math.max(0, event.endCoordinates.height - insets.bottom + 54);
      setKeyboardSpacerHeight(height);
      Animated.timing(keyboardOffset, {
        toValue: height,
        duration: 180,
        useNativeDriver: true,
      }).start();

      scrollToLatest(true);
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpenRef.current = false;
      shouldSnapToBottomRef.current = false;
      setKeyboardSpacerHeight(0);
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom, keyboardOffset, scrollToLatest]);

  const handleSend = async () => {
    if (!safeTargetUserId || sending) {
      return;
    }

    const content = text.trim();
    if (!content) {
      return;
    }

    try {
      setSending(true);
      const response = await sendChatMessage(safeTargetUserId, content);
      shouldSnapToBottomRef.current = true;
      setMessages((prev) => dedupeMessages([...prev, response.message]));
      setTargetUser(response.targetUser);
      offsetRef.current += 1;
      setText("");
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err, "enviar mensagem"));
    } finally {
      setSending(false);
      scrollToLatest(true);
    }
  };

  const title = targetUser?.nome_exibicao || targetUser?.username || safeNomeExibicao || safeUsername || "Chat";
  const subtitle = targetUser?.username || safeUsername || "";
  const avatarUri = String(targetUser?.foto_perfil || safeFotoPerfil || "").trim();
  const handleOpenProfile = () => {
    const targetUsername = targetUser?.username || safeUsername;
    if (!targetUsername) {
      return;
    }

    router.push({
      pathname: "/screens/social/[username]",
      params: { username: targetUsername },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Pressable onPress={handleOpenProfile} style={styles.headerProfile} hitSlop={8}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarText}>{title.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>@{subtitle}</Text> : null}
          </View>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.text} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={displayedMessages}
          inverted
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingTop: inputBarHeight + keyboardSpacerHeight + 8 }]}
          maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 40 }}
          onContentSizeChange={() => {
            if (preserveScrollOnNextContentChangeRef.current) {
              preserveScrollOnNextContentChangeRef.current = false;
              return;
            }

            requestAnimationFrame(() => {
              const shouldSnapToBottom =
                !hasAnchoredToBottomRef.current
                || (
                  shouldSnapToBottomRef.current
                  && (isNearBottomRef.current || keyboardOpenRef.current)
                );

              if (shouldSnapToBottom) {
                listRef.current?.scrollToOffset({ offset: 0, animated: hasAnchoredToBottomRef.current });
                hasAnchoredToBottomRef.current = true;
                shouldSnapToBottomRef.current = false;
              }
            });
          }}
          onScroll={({ nativeEvent }) => {
            isNearBottomRef.current = nativeEvent.contentOffset.y < 80;
          }}
          scrollEventThrottle={16}
          onEndReachedThreshold={0.2}
          onEndReached={() => loadMessages("append-older", false)}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma mensagem ainda.</Text>}
          renderItem={({ item }) => (
            <MessageBubble
              item={item}
              isMine={item.sender_id !== safeTargetUserId}
              styles={styles}
              theme={theme}
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.listLoaderTop}>
                <ActivityIndicator color={theme.colors.text} />
              </View>
            ) : null
          }
        />
      )}

      <Animated.View
        style={[
          styles.inputWrapper,
          {
            paddingBottom: Math.max(insets.bottom, 0),
            transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }],
          },
        ]}
        onLayout={(event) => {
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);
          setInputBarHeight((prev) => (prev === nextHeight ? prev : nextHeight));
        }}
      >
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Digite sua mensagem"
            placeholderTextColor={theme.colors.mutedText}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !text.trim()}
            style={[styles.sendButton, (sending || !text.trim()) && styles.disabled]}
          >
            {sending ? (
              <ActivityIndicator color={theme.colors.buttonText} />
            ) : (
              <Text style={styles.sendButtonText}>Enviar</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    backButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    headerInfo: {
      flex: 1,
    },
    headerProfile: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    headerAvatarFallback: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    headerAvatarText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    title: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "700",
    },
    subtitle: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    error: {
      color: theme.colors.error,
      fontWeight: "500",
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    listContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    listLoaderTop: {
      paddingVertical: 8,
    },
    emptyText: {
      color: theme.colors.mutedText,
      textAlign: "center",
      marginTop: 20,
    },
    messageRow: {
      flexDirection: "row",
    },
    messageRowMine: {
      justifyContent: "flex-end",
    },
    messageRowOther: {
      justifyContent: "flex-start",
    },
    messageBubble: {
      maxWidth: "80%",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
    },
    messageBubbleMine: {
      backgroundColor: theme.colors.button,
    },
    messageBubbleOther: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    messageText: {
      fontSize: 14,
    },
    messageTextMine: {
      color: theme.colors.buttonText,
    },
    messageTextOther: {
      color: theme.colors.text,
    },
    expandText: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: "700",
    },
    inputWrapper: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: theme.colors.background,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 110,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
    },
    sendButton: {
      minWidth: 82,
      height: 44,
      borderRadius: 10,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    sendButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    disabled: {
      opacity: 0.7,
    },
  });
}
