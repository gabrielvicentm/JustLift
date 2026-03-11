import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { acceptFollowRequest } from "@/app/features/profile/service";
import {
  fetchNotifications,
  fetchUnreadNotificationsCount,
  markNotificationAsRead,
  NotificationItem,
} from "@/app/features/notifications/service";

const notificationKeys = {
  list: ["notifications"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

function formatNotificationTime(rawDate: string) {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} d`;
}

function getNotificationText(item: NotificationItem) {
  const actor = item.actor_nome_exibicao || item.actor_username || "Alguem";
  if (item.type === "new_follower") {
    return `${actor} comecou a seguir voce`;
  }
  if (item.type === "follow_request") {
    return `${actor} quer seguir voce`;
  }
  return "Nova notificacao";
}

function getFollowRequestId(item: NotificationItem): number | null {
  const data = item.data;
  if (!data || typeof data !== "object") {
    return null;
  }
  const raw = (data as { followRequestId?: unknown }).followRequestId;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function NotificationRow({
  item,
  onRead,
  onAcceptRequest,
  acceptingRequestId,
  isAccepted,
  styles,
  theme,
}: {
  item: NotificationItem;
  onRead: (notificationId: number) => void;
  onAcceptRequest: (requestId: number) => void;
  acceptingRequestId: number | null;
  isAccepted: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
}) {
  const isUnread = !item.read_at;
  const followRequestId = getFollowRequestId(item);
  const canAcceptRequest = item.type === "follow_request" && followRequestId !== null && !isAccepted;

  return (
    <Pressable
      style={[styles.notificationRow, isUnread && styles.notificationRowUnread]}
      onPress={() => onRead(item.id)}
    >
      <View style={styles.notificationContent}>
        <Text style={styles.notificationText}>{getNotificationText(item)}</Text>
        <Text style={styles.notificationMeta}>
          {item.type}
          {item.actor_username ? ` • @${item.actor_username}` : ""}
        </Text>
        {canAcceptRequest ? (
          <Pressable
            style={[styles.acceptButton, acceptingRequestId === followRequestId && styles.acceptButtonDisabled]}
            disabled={acceptingRequestId === followRequestId || isAccepted}
            onPress={() => onAcceptRequest(followRequestId as number)}
          >
            {acceptingRequestId === followRequestId ? (
              <ActivityIndicator color={theme.colors.buttonText} size="small" />
            ) : (
              <Text style={styles.acceptButtonText}>Aceitar</Text>
            )}
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.notificationTime}>{formatNotificationTime(item.created_at)}</Text>
      {isUnread ? <View style={[styles.unreadDot, { backgroundColor: theme.colors.button }]} /> : null}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [acceptingRequestId, setAcceptingRequestId] = useState<number | null>(null);
  const [acceptedRequestIds, setAcceptedRequestIds] = useState<Set<number>>(new Set());

  const notificationsQuery = useQuery({
    queryKey: notificationKeys.list,
    queryFn: () => fetchNotifications(30, 0),
  });

  useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: fetchUnreadNotificationsCount,
  });

  const readMutation = useMutation({
    mutationFn: (notificationId: number) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount });
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: (requestId: number) => acceptFollowRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount });
    },
  });

  const handleAcceptRequest = async (requestId: number, notificationId: number) => {
    try {
      setAcceptingRequestId(requestId);
      await acceptRequestMutation.mutateAsync(requestId);
      await markNotificationAsRead(notificationId);
      queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount });
      setAcceptedRequestIds((prev) => new Set(prev).add(requestId));
    } finally {
      setAcceptingRequestId(null);
    }
  };

  const notifications = notificationsQuery.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Notificacoes</Text>
        <Pressable
          onPress={() => notificationsQuery.refetch()}
          disabled={notificationsQuery.isFetching}
          style={styles.refreshButton}
        >
          <Text style={styles.refreshButtonText}>Atualizar</Text>
        </Pressable>
      </View>

      {notificationsQuery.isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={theme.colors.text} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.state}>
          <Text style={styles.subtitle}>Nenhuma notificacao por enquanto.</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {notifications.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onRead={(id) => readMutation.mutate(id)}
              onAcceptRequest={(requestId) => handleAcceptRequest(requestId, item.id)}
              acceptingRequestId={acceptingRequestId}
              isAccepted={acceptedRequestIds.has(getFollowRequestId(item) ?? -1)}
              styles={styles}
              theme={theme}
            />
          ))}
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
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
    },
    refreshButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    refreshButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 12,
    },
    state: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    list: {
      flex: 1,
    },
    listContent: {
      gap: 8,
      paddingBottom: 16,
    },
    notificationRow: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.surface,
      padding: 12,
      gap: 6,
      position: "relative",
    },
    notificationRowUnread: {
      borderColor: theme.colors.button,
    },
    notificationContent: {
      gap: 4,
    },
    notificationText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    notificationMeta: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    notificationTime: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    acceptButton: {
      marginTop: 6,
      minHeight: 32,
      alignSelf: "flex-start",
      borderRadius: 8,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    acceptButtonDisabled: {
      opacity: 0.7,
    },
    acceptButtonText: {
      color: theme.colors.buttonText,
      fontSize: 12,
      fontWeight: "700",
    },
    unreadDot: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    subtitle: {
      color: theme.colors.mutedText,
      textAlign: "center",
      fontSize: 14,
    },
  });
}
