import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { getApiErrorMessage } from "@/app/features/profile/service";
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/app/features/notifications/service";
import type { NotificationItem } from "@/app/features/notifications/types";
import type { AppTheme } from "@/theme/theme";

function formatNotificationMessage(item: NotificationItem) {
  if (item.type === "follow_request") {
    return "pediu para seguir voce.";
  }
  if (item.type === "follow_accepted") {
    return "aceitou seu pedido de follow.";
  }
  if (item.type === "user_follow") {
    return "comecou a seguir voce.";
  }
  if (item.type === "post_like") {
    return "curtiu seu post.";
  }
  if (item.type === "comment_like") {
    return "curtiu seu comentario.";
  }
  if (item.type === "mention") {
    return "mencionou voce.";
  }
  if (item.type === "post_save") {
    return "salvou seu post.";
  }
  return "comentou no seu post.";
}

function formatWhen(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} d`;
  }

  return date.toLocaleDateString("pt-BR");
}

export default function NotificacoesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const items = await fetchNotifications();
      setNotifications(items);
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err, "carregar notificacoes"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications]),
  );

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const handleOpenNotification = async (item: NotificationItem) => {
    try {
      if (!item.read_at) {
        await markNotificationAsRead(item.id);
        setNotifications((previous) =>
          previous.map((current) =>
            current.id === item.id ? { ...current, read_at: new Date().toISOString() } : current,
          ),
        );
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "marcar notificacao como lida"));
    } finally {
      if (item.type === "user_follow" || item.type === "follow_request" || item.type === "follow_accepted") {
        router.push(`/screens/social/${item.actor_username}` as never);
      } else if (item.post_id) {
        router.push(`/screens/social/Post/${item.post_id}` as never);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          read_at: item.read_at || new Date().toISOString(),
        })),
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "marcar notificacoes como lidas"));
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notificacoes</Text>
        <Pressable style={styles.readAllButton} onPress={handleMarkAllAsRead} disabled={unreadCount === 0}>
          <Text style={[styles.readAllText, unreadCount === 0 ? styles.readAllTextDisabled : null]}>
            Marcar tudo como lida
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.colors.button} />
          <Text style={styles.loadingText}>Carregando notificacoes...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} />}
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Sem notificacoes por enquanto</Text>
              <Text style={styles.emptyText}>
                Quando alguem interagir com voce (curtir, salvar, comentar, seguir, mencionar), aparece aqui.
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.notificationCard, !item.read_at ? styles.notificationCardUnread : null]}
                onPress={() => handleOpenNotification(item)}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.actorText}>{item.actor_nome_exibicao || item.actor_username}</Text>
                  <Text style={styles.whenText}>{formatWhen(item.created_at)}</Text>
                </View>
                <Text style={styles.messageText}>{formatNotificationMessage(item)}</Text>
                {item.post_descricao ? (
                  <Text style={styles.postPreviewText} numberOfLines={2}>
                    {item.post_descricao}
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      gap: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    readAllButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    readAllText: {
      color: theme.colors.button,
      fontWeight: "700",
      fontSize: 12,
    },
    readAllTextDisabled: {
      color: theme.colors.mutedText,
    },
    errorText: {
      color: theme.colors.error,
      marginBottom: 8,
    },
    centerBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    loadingText: {
      color: theme.colors.mutedText,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      gap: 10,
      paddingBottom: 20,
    },
    emptyBox: {
      marginTop: 32,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      gap: 6,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    emptyText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      lineHeight: 20,
    },
    notificationCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 6,
    },
    notificationCardUnread: {
      borderColor: theme.colors.button,
    },
    rowTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    actorText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 15,
      flex: 1,
    },
    whenText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    messageText: {
      color: theme.colors.text,
      fontSize: 14,
    },
    postPreviewText: {
      color: theme.colors.mutedText,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
