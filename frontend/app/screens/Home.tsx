import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptFollowRequest,
  fetchNotifications,
  fetchUnreadNotificationsCount,
  markNotificationAsRead,
} from "@/app/features/profile/service";
import type { NotificationItem } from "@/app/features/profile/types";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

const notificationKeys = {
  list: ["home", "notifications"] as const,
  unreadCount: ["home", "notifications", "unread-count"] as const,
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

function NotificationRow({
  item,
  onRead,
  onAcceptRequest,
  acceptingRequestId,
  theme,
  styles,
}: {
  item: NotificationItem;
  onRead: (notificationId: number) => void;
  onAcceptRequest: (requestId: number) => void;
  acceptingRequestId: number | null;
  theme: AppTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const isUnread = !item.read_at;
  const isFollowRequestPending =
    item.type === "follow_request" &&
    item.follow_request_id !== null &&
    item.follow_request_status === "pending";

  return (
    <Pressable
      style={[styles.notificationRow, isUnread && styles.notificationRowUnread]}
      onPress={() => {
        if (!isFollowRequestPending) {
          onRead(item.id);
        }
      }}
    >
      {item.actor_foto_perfil ? (
        <Image source={{ uri: item.actor_foto_perfil }} style={styles.notificationAvatar} />
      ) : (
        <View style={[styles.notificationAvatar, styles.notificationAvatarFallback]}>
          <Text style={styles.notificationAvatarFallbackText}>
            {(item.actor_nome_exibicao || item.actor_username).slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.notificationTextWrap}>
        <Text style={styles.notificationText}>
          <Text style={styles.notificationUsername}>@{item.actor_username}</Text>{" "}
          {item.type === "follow_request" ? "quer seguir voce" : "comecou a seguir voce"}
        </Text>
        <Text style={styles.notificationTime}>{formatNotificationTime(item.created_at)}</Text>
        {isFollowRequestPending ? (
          <Pressable
            style={[styles.acceptButton, acceptingRequestId === item.follow_request_id && styles.acceptButtonDisabled]}
            disabled={acceptingRequestId === item.follow_request_id}
            onPress={() => onAcceptRequest(item.follow_request_id as number)}
          >
            {acceptingRequestId === item.follow_request_id ? (
              <ActivityIndicator color={theme.colors.buttonText} size="small" />
            ) : (
              <Text style={styles.acceptButtonText}>Aceitar</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {isUnread ? <View style={[styles.unreadDot, { backgroundColor: theme.colors.button }]} /> : null}
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState<number | null>(null);

  const notificationsQuery = useQuery({
    queryKey: notificationKeys.list,
    queryFn: () => fetchNotifications(30, 0),
  });

  const unreadCountQuery = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: fetchUnreadNotificationsCount,
  });

  const readOneMutation = useMutation({
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

  const unreadCount = unreadCountQuery.data ?? 0;
  const notifications = notificationsQuery.data ?? [];

  const handleBellPress = () => {
    setShowNotifications((prev) => !prev);
  };

  const handleAcceptRequest = async (requestId: number) => {
    try {
      setAcceptingRequestId(requestId);
      await acceptRequestMutation.mutateAsync(requestId);
    } finally {
      setAcceptingRequestId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("home_title")}</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconButton}
            onPress={handleBellPress}
            accessibilityRole="button"
            accessibilityLabel="Abrir notificacoes"
          >
            <Ionicons name={showNotifications ? "notifications" : "notifications-outline"} size={22} color={theme.colors.text} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : String(unreadCount)}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            style={styles.iconButton}
            onPress={() => router.push("/screens/social/CriarPost")}
            accessibilityRole="button"
            accessibilityLabel="Criar post"
          >
            <Ionicons name="add-circle-outline" size={22} color={theme.colors.text} />
          </Pressable>

          <Pressable
            style={styles.iconButton}
            onPress={() => router.push("/screens/social/SearchUsers")}
            accessibilityRole="button"
            accessibilityLabel="Pesquisar usuarios"
          >
            <Ionicons name="search" size={22} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>

      {showNotifications ? (
        <View style={styles.notificationsCard}>
          <View style={styles.notificationsHeaderRow}>
            <Text style={styles.notificationsTitle}>Notificacoes</Text>
            <Pressable
              onPress={() => notificationsQuery.refetch()}
              disabled={notificationsQuery.isFetching}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshButtonText}>Atualizar</Text>
            </Pressable>
          </View>

          {notificationsQuery.isLoading ? (
            <View style={styles.notificationsState}>
              <ActivityIndicator color={theme.colors.text} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.notificationsState}>
              <Text style={styles.subtitle}>Nenhuma notificacao por enquanto.</Text>
            </View>
          ) : (
            <ScrollView style={styles.notificationsList} contentContainerStyle={styles.notificationsListContent}>
              {notifications.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onRead={(id) => readOneMutation.mutate(id)}
                  onAcceptRequest={handleAcceptRequest}
                  acceptingRequestId={acceptingRequestId}
                  theme={theme}
                  styles={styles}
                />
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.subtitle}>Explore o app e encontre outros usuarios.</Text>
        </View>
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
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    badge: {
      position: "absolute",
      top: -6,
      right: -6,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: theme.colors.error,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.surface,
    },
    badgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "700",
    },
    notificationsCard: {
      marginTop: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
      flex: 1,
    },
    notificationsHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    notificationsTitle: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 16,
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
    notificationsState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    notificationsList: {
      flex: 1,
    },
    notificationsListContent: {
      padding: 10,
      gap: 8,
    },
    notificationRow: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      padding: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    notificationRowUnread: {
      borderColor: theme.colors.button,
    },
    notificationAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.inputBackground,
    },
    notificationAvatarFallback: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    notificationAvatarFallbackText: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 14,
    },
    notificationTextWrap: {
      flex: 1,
      gap: 2,
    },
    notificationText: {
      color: theme.colors.text,
      fontSize: 14,
    },
    notificationUsername: {
      fontWeight: "700",
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
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    body: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    subtitle: {
      color: theme.colors.mutedText,
      textAlign: "center",
      fontSize: 14,
    },
  });
}
