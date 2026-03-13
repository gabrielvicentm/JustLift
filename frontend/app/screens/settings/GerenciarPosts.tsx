import { useCallback, useMemo, useState } from "react";
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
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { fetchMyProfile, getApiErrorMessage } from "@/app/features/profile/service";
import { deletePost, fetchPostsByUser } from "@/app/features/social/service";
import type { PostSummary } from "@/app/features/social/types";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

export default function GerenciarPostsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);

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

  const confirmDeletePost = (post: PostSummary) => {
    Alert.alert("Excluir post", "Tem certeza que deseja excluir este post?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingPostId(post.id);
            setError("");
            await deletePost(post.id);
            setPosts((current) => current.filter((item) => item.id !== post.id));
          } catch (err) {
            setError(getApiErrorMessage(err, "excluir post"));
          } finally {
            setDeletingPostId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Gerenciar posts</Text>
      <Text style={styles.subtitle}>Edite ou exclua os posts que voce publicou.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>Voce ainda nao tem posts para gerenciar.</Text>}
          renderItem={({ item }) => {
            const firstMedia = item.midias?.[0];
            const isDeleting = deletingPostId === item.id;

            return (
              <View style={styles.postCard}>
                {firstMedia ? (
                  firstMedia.type === "image" ? (
                    <Image source={{ uri: firstMedia.url }} style={styles.preview} />
                  ) : (
                    <View style={[styles.preview, styles.videoPreview]}>
                      <Text style={styles.videoText}>Video</Text>
                    </View>
                  )
                ) : null}

                <Text style={styles.description}>{item.descricao || "(sem descricao)"}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Curtidas: {item.likes_count}</Text>
                  <Text style={styles.metaText}>Comentarios: {item.comments_count}</Text>
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => router.push(`/screens/social/EditarPost?postId=${item.id}` as never)}
                  >
                    <Text style={styles.editButtonText}>Editar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.deleteButton, isDeleting && styles.disabled]}
                    onPress={() => confirmDeletePost(item)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? <ActivityIndicator color={theme.colors.buttonText} /> : <Text style={styles.deleteButtonText}>Excluir</Text>}
                  </Pressable>
                </View>
              </View>
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
      padding: 16,
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
    subtitle: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    loadingWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
    },
    loadingText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    listContent: {
      gap: 10,
      paddingBottom: 20,
    },
    emptyText: {
      color: theme.colors.mutedText,
      textAlign: "center",
      marginTop: 16,
    },
    postCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      padding: 10,
      gap: 8,
    },
    preview: {
      width: "100%",
      height: 180,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
    },
    videoPreview: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.button,
    },
    videoText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    description: {
      color: theme.colors.text,
      fontSize: 14,
    },
    metaRow: {
      flexDirection: "row",
      gap: 12,
    },
    metaText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
    },
    editButton: {
      flex: 1,
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    editButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    deleteButton: {
      flex: 1,
      height: 42,
      borderRadius: 10,
      backgroundColor: theme.colors.error,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    disabled: {
      opacity: 0.7,
    },
    error: {
      color: theme.colors.error,
      fontWeight: "600",
    },
  });
}
