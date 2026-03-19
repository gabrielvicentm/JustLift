import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  deleteChatMessageForEveryone,
  deleteChatMessageForMe,
  fetchChatMessages,
  sendChatMessage,
  updateChatMessage,
} from "@/app/features/chat/service";
import type { ChatMessage, ChatTargetUser } from "@/app/features/chat/types";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 20;
const EXPAND_MESSAGE_LENGTH = 180;
const EDIT_WINDOW_MS = 5 * 60 * 1000;

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
  safeTargetUserId,
  onLongPress,
}: {
  item: ChatMessage;
  isMine: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  safeTargetUserId?: string;
  onLongPress: (message: ChatMessage) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = item.content.length > EXPAND_MESSAGE_LENGTH;
  const replyAuthor = item.reply_to_sender_id === safeTargetUserId ? "Mensagem recebida" : "Você";
  const isDeletedForEveryone = Boolean(item.deleted_for_everyone_at);

  return (
    <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
      <Pressable
        onLongPress={() => {
          if (!isDeletedForEveryone) {
            onLongPress(item);
          }
        }}
        style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}
      >
        {item.reply_to_content ? (
          <View style={[styles.replyPreview, isMine ? styles.replyPreviewMine : styles.replyPreviewOther]}>
            <Text style={[styles.replyLabel, isMine ? styles.messageTextMine : styles.messageTextOther]}>
              {replyAuthor}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.replyText, isMine ? styles.messageTextMine : styles.messageTextOther]}
            >
              {item.reply_to_content}
            </Text>
          </View>
        ) : null}

        <Text
          numberOfLines={!expanded && shouldCollapse ? 5 : undefined}
          style={[
            styles.messageText,
            isMine ? styles.messageTextMine : styles.messageTextOther,
            isDeletedForEveryone && styles.deletedMessageText,
          ]}
        >
          {item.content}
        </Text>

        {item.edited_at && !isDeletedForEveryone ? (
          <Text style={[styles.editedText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
            Editada
          </Text>
        ) : null}

        {shouldCollapse && !isDeletedForEveryone ? (
          <Pressable onPress={() => setExpanded((prev) => !prev)} hitSlop={8}>
            <Text style={[styles.expandText, { color: isMine ? theme.colors.buttonText : theme.colors.text }]}>
              {expanded ? "Ver menos" : "Ver mais"}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
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
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [messageActionLoading, setMessageActionLoading] = useState(false);
  const [inputBarHeight, setInputBarHeight] = useState(72);
  const [keyboardSpacerHeight, setKeyboardSpacerHeight] = useState(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
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

  const isMessageEditable = useCallback((message: ChatMessage) => {
    const ageMs = Date.now() - new Date(message.created_at).getTime();
    return ageMs <= EDIT_WINDOW_MS;
  }, []);

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
      setError("Chat inválido.");
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
    if (!safeTargetUserId || sending || isChatDisabled) {
      return;
    }

    const content = text.trim();
    if (!content) {
      return;
    }

    try {
      setSending(true);

      if (editingMessage) {
        const response = await updateChatMessage(safeTargetUserId, editingMessage.id, content);
        setMessages((prev) => prev.map((item) => (item.id === response.message.id ? response.message : item)));
        setTargetUser(response.targetUser);
      } else {
        const response = await sendChatMessage(safeTargetUserId, content, replyToMessage?.id ?? null);
        shouldSnapToBottomRef.current = true;
        setMessages((prev) => dedupeMessages([...prev, response.message]));
        setTargetUser(response.targetUser);
        offsetRef.current += 1;
      }

      setText("");
      setReplyToMessage(null);
      setEditingMessage(null);
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err, editingMessage ? "editar mensagem" : "enviar mensagem"));
    } finally {
      setSending(false);
      scrollToLatest(true);
    }
  };

  const title = targetUser?.nome_exibicao || targetUser?.username || safeNomeExibicao || safeUsername || "Chat";
  const subtitle = targetUser?.username || safeUsername || "";
  const avatarUri = String(targetUser?.foto_perfil || safeFotoPerfil || "").trim();
  const isBlockedByMe = Boolean(targetUser?.is_blocked_by_me);
  const hasBlockedMe = Boolean(targetUser?.has_blocked_me);
  const isChatDisabled = isBlockedByMe || hasBlockedMe;
  const chatRestrictionMessage = isBlockedByMe
    ? "Você bloqueou este usuário. Desbloqueie em Conversas para voltar a enviar mensagens."
    : hasBlockedMe
      ? "Você foi bloqueado por este usuário e não pode enviar novas mensagens."
      : "";

  const focusComposer = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const closeMessageActions = () => {
    if (messageActionLoading) {
      return;
    }

    setSelectedMessage(null);
  };

  const handleReplyMessage = () => {
    if (!selectedMessage) {
      return;
    }

    setEditingMessage(null);
    setReplyToMessage(selectedMessage);
    setSelectedMessage(null);
    focusComposer();
  };

  const handleEditMessage = () => {
    if (!selectedMessage) {
      return;
    }

    setReplyToMessage(null);
    setEditingMessage(selectedMessage);
    setText(selectedMessage.content);
    setSelectedMessage(null);
    focusComposer();
  };

  const handleCopyMessage = () => {
    if (!selectedMessage) {
      return;
    }

    Clipboard.setString(selectedMessage.content);
    setSelectedMessage(null);
  };

  const handleDeleteForMe = async () => {
    if (!selectedMessage || !safeTargetUserId) {
      return;
    }

    try {
      setMessageActionLoading(true);
      await deleteChatMessageForMe(safeTargetUserId, selectedMessage.id);
      setMessages((prev) => prev.filter((item) => item.id !== selectedMessage.id));

      if (replyToMessage?.id === selectedMessage.id) {
        setReplyToMessage(null);
      }
      if (editingMessage?.id === selectedMessage.id) {
        setEditingMessage(null);
        setText("");
      }

      setSelectedMessage(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "excluir mensagem"));
    } finally {
      setMessageActionLoading(false);
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!selectedMessage || !safeTargetUserId) {
      return;
    }

    try {
      setMessageActionLoading(true);
      await deleteChatMessageForEveryone(safeTargetUserId, selectedMessage.id);
      setMessages((prev) =>
        prev.map((item) => {
          if (item.id === selectedMessage.id) {
            return {
              ...item,
              content: "Mensagem apagada",
              deleted_for_everyone_at: new Date().toISOString(),
              reply_to_message_id: null,
              reply_to_content: null,
              reply_to_sender_id: null,
              edited_at: null,
            };
          }

          if (item.reply_to_message_id === selectedMessage.id) {
            return { ...item, reply_to_message_id: null, reply_to_content: null, reply_to_sender_id: null };
          }

          return item;
        })
      );

      if (replyToMessage?.id === selectedMessage.id) {
        setReplyToMessage(null);
      }
      if (editingMessage?.id === selectedMessage.id) {
        setEditingMessage(null);
        setText("");
      }

      setSelectedMessage(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "excluir mensagem"));
    } finally {
      setMessageActionLoading(false);
    }
  };

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
      {chatRestrictionMessage ? <Text style={styles.info}>{chatRestrictionMessage}</Text> : null}

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
              safeTargetUserId={safeTargetUserId}
              onLongPress={setSelectedMessage}
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
        {replyToMessage ? (
          <View style={styles.composerActionCard}>
            <View style={styles.composerActionTextBlock}>
              <Text style={styles.composerActionLabel}>Respondendo</Text>
              <Text numberOfLines={2} style={styles.composerActionText}>
                {replyToMessage.content}
              </Text>
            </View>
            <Pressable onPress={() => setReplyToMessage(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color={theme.colors.text} />
            </Pressable>
          </View>
        ) : null}

        {editingMessage ? (
          <View style={styles.composerActionCard}>
            <View style={styles.composerActionTextBlock}>
              <Text style={styles.composerActionLabel}>Editando mensagem</Text>
              <Text numberOfLines={2} style={styles.composerActionText}>
                {editingMessage.content}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setEditingMessage(null);
                setText("");
              }}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={theme.colors.text} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={editingMessage ? "Edite sua mensagem" : "Digite sua mensagem"}
            placeholderTextColor={theme.colors.mutedText}
            style={styles.input}
            multiline
            editable={!isChatDisabled}
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !text.trim() || isChatDisabled}
            style={[styles.sendButton, (sending || !text.trim() || isChatDisabled) && styles.disabled]}
          >
            {sending ? (
              <ActivityIndicator color={theme.colors.buttonText} />
            ) : (
              <Text style={styles.sendButtonText}>{editingMessage ? "Salvar" : "Enviar"}</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>

      <Modal visible={Boolean(selectedMessage)} transparent animationType="fade" onRequestClose={closeMessageActions}>
        <Pressable style={styles.messageModalBackdrop} onPress={closeMessageActions}>
          <Pressable style={styles.messageModalCard} onPress={() => undefined}>
            {selectedMessage ? (
              <>
                <Text style={styles.messageModalTitle}>Mensagem</Text>
                <Text style={styles.messageModalPreview}>{selectedMessage.content}</Text>

                <Pressable style={styles.messageModalAction} onPress={handleReplyMessage} disabled={messageActionLoading}>
                  <Text style={styles.messageModalActionText}>Responder</Text>
                </Pressable>

                {selectedMessage.sender_id !== safeTargetUserId && isMessageEditable(selectedMessage) ? (
                  <Pressable style={styles.messageModalAction} onPress={handleEditMessage} disabled={messageActionLoading}>
                    <Text style={styles.messageModalActionText}>Editar</Text>
                  </Pressable>
                ) : null}

                <Pressable style={styles.messageModalAction} onPress={handleDeleteForMe} disabled={messageActionLoading}>
                  <Text style={styles.messageModalActionText}>Excluir só para você</Text>
                </Pressable>

                {selectedMessage.sender_id !== safeTargetUserId ? (
                  <Pressable
                    style={styles.messageModalAction}
                    onPress={handleDeleteForEveryone}
                    disabled={messageActionLoading}
                  >
                    <Text style={styles.messageModalActionText}>Excluir para todos</Text>
                  </Pressable>
                ) : null}

                <Pressable style={styles.messageModalAction} onPress={handleCopyMessage} disabled={messageActionLoading}>
                  <Text style={styles.messageModalActionText}>Copiar mensagem</Text>
                </Pressable>

                <Pressable style={styles.messageModalCancel} onPress={closeMessageActions} disabled={messageActionLoading}>
                  {messageActionLoading ? (
                    <ActivityIndicator color={theme.colors.text} />
                  ) : (
                    <Text style={styles.messageModalCancelText}>Cancelar</Text>
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
    info: {
      color: theme.colors.mutedText,
      fontWeight: "500",
      paddingHorizontal: 16,
      paddingBottom: 8,
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
    replyPreview: {
      borderLeftWidth: 2,
      paddingLeft: 8,
      marginBottom: 8,
      opacity: 0.95,
    },
    replyPreviewMine: {
      borderLeftColor: theme.colors.buttonText,
    },
    replyPreviewOther: {
      borderLeftColor: theme.colors.text,
    },
    replyLabel: {
      fontSize: 11,
      fontWeight: "700",
      marginBottom: 2,
    },
    replyText: {
      fontSize: 12,
      opacity: 0.9,
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
    editedText: {
      marginTop: 6,
      fontSize: 11,
      opacity: 0.75,
    },
    deletedMessageText: {
      fontStyle: "italic",
      opacity: 0.8,
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
    composerActionCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    composerActionTextBlock: {
      flex: 1,
      gap: 2,
    },
    composerActionLabel: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    composerActionText: {
      color: theme.colors.mutedText,
      fontSize: 12,
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
    messageModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "flex-end",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 34,
    },
    messageModalCard: {
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      gap: 8,
    },
    messageModalTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    messageModalPreview: {
      color: theme.colors.mutedText,
      fontSize: 13,
      marginBottom: 4,
    },
    messageModalAction: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBackground,
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    messageModalActionText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "600",
    },
    messageModalCancel: {
      minHeight: 46,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    messageModalCancelText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
