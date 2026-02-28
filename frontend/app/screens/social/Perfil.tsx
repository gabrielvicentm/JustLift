import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useDeleteMyPostMutation,
  useMyPostsQuery,
  useMyProfileQuery,
  useUpdateMyPostMutation,
} from "@/app/features/profile/hooks";
import { getApiErrorMessage } from "@/app/features/profile/service";
import type { MyPost } from "@/app/features/profile/types";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { useRouter } from "expo-router";

export default function PerfilScreen() {
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();

  const [actionError, setActionError] = useState("");

  const profileQuery = useMyProfileQuery();
  const postsQuery = useMyPostsQuery();
  const updatePostMutation = useUpdateMyPostMutation();
  const deletePostMutation = useDeleteMyPostMutation();

  const loading = profileQuery.isLoading || postsQuery.isLoading;
  const refreshing = profileQuery.isRefetching || postsQuery.isRefetching;

  const errorMessage = profileQuery.error
    ? getApiErrorMessage(profileQuery.error, "carregar perfil")
    : postsQuery.error
      ? getApiErrorMessage(postsQuery.error, "carregar posts")
      : actionError;

  const profile = profileQuery.data;
  const posts = postsQuery.data ?? [];

  const handleRefresh = async () => {
    await Promise.all([profileQuery.refetch(), postsQuery.refetch()]);
  };

  const handleToggleFinished = async (item: MyPost) => {
    setActionError("");
    try {
      await updatePostMutation.mutateAsync({
        postId: item.id,
        payload: { finalizado: !item.finalizado },
      });
    } catch (err) {
      setActionError(getApiErrorMessage(err, "atualizar post"));
    }
  };

  const handleDeletePost = (postId: number) => {
    Alert.alert(
      "Remover post",
      "Tem certeza que deseja remover este post de treino?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            setActionError("");
            try {
              await deletePostMutation.mutateAsync(postId);
            } catch (err) {
              setActionError(getApiErrorMessage(err, "remover post"));
            }
          },
        },
      ],
    );
  };

  const renderPostItem = ({ item }: { item: MyPost }) => {
    const totalExercicios = Number(item.total_exercicios ?? 0);
    const totalSeries = Number(item.total_series ?? 0);

    return (
      <View style={styles.postCard}>
        <Text style={styles.postTitle}>Treino #{item.id}</Text>
        <Text style={styles.postText}>Data: {item.data}</Text>
        <Text style={styles.postText}>Exercicios: {totalExercicios}</Text>
        <Text style={styles.postText}>Series: {totalSeries}</Text>
        <Text style={styles.postText}>Duracao: {item.duracao ?? 0} min</Text>
        <Text style={styles.postText}>Peso total: {item.peso_total ?? 0} kg</Text>
        <Text style={styles.postText}>Status: {item.finalizado ? "Concluido" : "Em andamento"}</Text>

        <View style={styles.postActionsRow}>
          <Pressable
            style={[styles.postActionButton, styles.postActionPrimary]}
            disabled={updatePostMutation.isPending || deletePostMutation.isPending}
            onPress={() => handleToggleFinished(item)}
          >
            <Text style={styles.postActionPrimaryText}>
              {item.finalizado ? "Marcar pendente" : "Marcar concluido"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.postActionButton, styles.postActionDanger]}
            disabled={updatePostMutation.isPending || deletePostMutation.isPending}
            onPress={() => handleDeletePost(item.id)}
          >
            <Text style={styles.postActionDangerText}>Apagar</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.containerCentered}>
        <ActivityIndicator color={theme.colors.text} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.contentContainer}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.title}>{t("profile_title")}</Text>

            <View style={styles.profileCard}>
              {profile?.banner ? <Image source={{ uri: profile.banner }} style={styles.banner} /> : null}

              <View style={styles.profileBody}>
                {profile?.foto_perfil ? (
                  <Image source={{ uri: profile.foto_perfil }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarPlaceholderText}>Sem foto</Text>
                  </View>
                )}

                <Text style={styles.nameText}>{profile?.nome_exibicao || profile?.username || "Seu perfil"}</Text>

                {profile?.biografia ? <Text style={styles.bioText}>{profile.biografia}</Text> : null}
              </View>

              <View style={styles.actionsRow}>
                <Pressable style={styles.button} onPress={handleRefresh}>
                  <Text style={styles.buttonText}>Atualizar</Text>
                </Pressable>

                <Pressable style={styles.button} onPress={() => router.push("/screens/social/UpdateProfile")}>
                  <Text style={styles.buttonText}>Editar Perfil</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Meus posts de treino</Text>
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            {!errorMessage && posts.length === 0 ? (
              <Text style={styles.emptyText}>Voce ainda nao tem posts de treino.</Text>
            ) : null}
          </View>
        }
        renderItem={renderPostItem}
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    containerCentered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      gap: 8,
    },
    loadingText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "500",
    },
    contentContainer: {
      padding: 16,
      gap: 12,
      paddingBottom: 30,
    },
    headerBlock: {
      gap: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    profileCard: {
      width: "100%",
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 12,
      overflow: "hidden",
    },
    banner: {
      width: "100%",
      height: 120,
      backgroundColor: theme.colors.inputBackground,
    },
    profileBody: {
      alignItems: "center",
      padding: 14,
      gap: 8,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.colors.inputBackground,
    },
    avatarPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    avatarPlaceholderText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    nameText: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
    },
    bioText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      textAlign: "center",
    },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    button: {
      backgroundColor: theme.colors.button,
      borderRadius: 10,
      minHeight: 42,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    buttonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 14,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 6,
    },
    postCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      padding: 12,
      backgroundColor: theme.colors.surface,
      gap: 4,
    },
    postTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 4,
    },
    postText: {
      color: theme.colors.text,
      fontSize: 13,
    },
    postActionsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    postActionButton: {
      minHeight: 38,
      borderRadius: 8,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
    },
    postActionPrimary: {
      backgroundColor: theme.colors.button,
    },
    postActionPrimaryText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 12,
      textAlign: "center",
    },
    postActionDanger: {
      backgroundColor: `${theme.colors.error}22`,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    postActionDangerText: {
      color: theme.colors.error,
      fontWeight: "700",
      fontSize: 12,
    },
    emptyText: {
      color: theme.colors.mutedText,
      fontSize: 13,
      fontStyle: "italic",
    },
    error: {
      color: theme.colors.error,
      fontWeight: "500",
    },
  });
}
