import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { fetchMyProfile, getApiErrorMessage } from "@/app/features/profile/service";
import {
  createPostComment,
  deletePost,
  fetchPostById,
  reportPost,
  toggleCommentLike,
  togglePostLike,
  togglePostSave,
} from "@/app/features/social/service";
import type { PostDetail } from "@/app/features/social/types";

export default function PostDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postIdRaw = Array.isArray(params.id) ? params.id[0] : params.id;
  const postId = Number(postIdRaw);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [togglingLike, setTogglingLike] = useState(false);
  const [togglingSave, setTogglingSave] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [togglingCommentLike, setTogglingCommentLike] = useState<Record<number, boolean>>({});
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const commentInputRef = useRef<TextInput | null>(null);

  const loadPost = useCallback(async () => {
    if (!Number.isInteger(postId) || postId <= 0) {
      setError("ID de post invalido.");
      setLoading(false);
      return;
    }

    try {
      setError("");
      setLoading(true);
      const [data, myProfile] = await Promise.all([fetchPostById(postId), fetchMyProfile()]);
      setPost(data);
      setViewerUserId(myProfile.user_id);
    } catch (err) {
      setError(getApiErrorMessage(err, "carregar post"));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const isOwner = Boolean(post && viewerUserId && post.user_id === viewerUserId);

  const createdAtLabel = useMemo(() => {
    if (!post?.created_at) {
      return "";
    }

    const parsed = new Date(post.created_at);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return parsed.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [post?.created_at]);

  useEffect(() => {
    loadPost();
  }, [loadPost, postIdRaw]);

  const handleToggleLike = async () => {
    if (!post || togglingLike) return;
    try {
      setTogglingLike(true);
      const result = await togglePostLike(post.id);
      setPost({
        ...post,
        viewer_liked: result.liked,
        likes_count: result.likes_count,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "curtir post"));
    } finally {
      setTogglingLike(false);
    }
  };

  const handleToggleSave = async () => {
    if (!post || togglingSave) return;
    try {
      setTogglingSave(true);
      const result = await togglePostSave(post.id);
      setPost({
        ...post,
        viewer_saved: result.saved,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "salvar post"));
    } finally {
      setTogglingSave(false);
    }
  };

  const handleReport = async () => {
    if (!post || reporting) return;
    try {
      setReporting(true);
      await reportPost(post.id, "conteudo_inadequado");
      Alert.alert("Denuncia enviada", "Obrigado por reportar este post.");
    } catch (err) {
      setError(getApiErrorMessage(err, "denunciar post"));
    } finally {
      setReporting(false);
    }
  };

  const handleCreateComment = async () => {
    if (!post || sendingComment) return;

    const comentario = commentInput.trim();
    if (!comentario) {
      return;
    }

    try {
      setSendingComment(true);
      const createdComment = await createPostComment(post.id, comentario);
      setPost({
        ...post,
        comments_count: post.comments_count + 1,
        comentarios: [createdComment, ...post.comentarios],
      });
      setCommentInput("");
    } catch (err) {
      setError(getApiErrorMessage(err, "comentar post"));
    } finally {
      setSendingComment(false);
    }
  };

  const handleToggleCommentLike = async (commentId: number) => {
    if (!post || togglingCommentLike[commentId]) return;
    try {
      setTogglingCommentLike((prev) => ({ ...prev, [commentId]: true }));
      const result = await toggleCommentLike(post.id, commentId);
      setPost({
        ...post,
        comentarios: post.comentarios.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                viewer_liked: result.liked,
                likes_count: result.likes_count,
              }
            : comment,
        ),
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "curtir comentario"));
    } finally {
      setTogglingCommentLike((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  const handleDeletePost = async () => {
    if (!post || deleting || !isOwner) return;
    Alert.alert("Excluir post", "Tem certeza que deseja excluir este post?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await deletePost(post.id);
            Alert.alert("Post excluido", "Seu post foi removido.");
            router.back();
          } catch (err) {
            setError(getApiErrorMessage(err, "excluir post"));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const openOwnerActions = () => {
    if (!post || !isOwner) return;
    Alert.alert("Gerenciar post", "Escolha uma acao", [
      { text: "Editar", onPress: () => router.push(`/screens/social/EditarPost?postId=${post.id}` as never) },
      { text: "Excluir", style: "destructive", onPress: handleDeletePost },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleOpenProfile = () => {
    if (!post?.username) {
      return;
    }

    router.push({ pathname: "/screens/social/[username]", params: { username: post.username } } as never);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.text} />
        <Text style={styles.loadingText}>Carregando post...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || "Post nao encontrado."}</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const hasTreino = post.tipo === "treino" && post.treino;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>

          {isOwner ? (
            <Pressable onPress={openOwnerActions} style={styles.manageButton} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.text} />
              )}
            </Pressable>
          ) : null}
        </View>

        <Pressable style={styles.authorRow} onPress={handleOpenProfile}>
          {post.foto_perfil ? (
            <Image source={{ uri: post.foto_perfil }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {(post.nome_exibicao || post.username || "U").slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{post.nome_exibicao || post.username}</Text>
            <Text style={styles.authorUser}>@{post.username}</Text>
          </View>
          {createdAtLabel ? <Text style={styles.postDate}>{createdAtLabel}</Text> : null}
        </Pressable>

        <View style={styles.postCard}>
          {(post.midias ?? []).length === 0 ? (
            <View style={[styles.media, styles.mediaEmpty]}>
              <Ionicons name="images-outline" size={26} color={theme.colors.mutedText} />
              <Text style={styles.mediaEmptyText}>Sem midia</Text>
            </View>
          ) : (
            (post.midias ?? []).map((media) => (
              <View key={media.id} style={styles.mediaCard}>
                {media.type === "image" ? (
                  <Image source={{ uri: media.url }} style={styles.media} />
                ) : (
                  <View style={[styles.media, styles.videoPlaceholder]}>
                    <Ionicons name="videocam" size={24} color={theme.colors.buttonText} />
                    <Text style={styles.videoPlaceholderText}>Video</Text>
                  </View>
                )}
              </View>
            ))
          )}

          <View style={styles.actionsRow}>
            <Pressable onPress={handleToggleLike} disabled={togglingLike}>
              <Ionicons
                name={post.viewer_liked ? "heart" : "heart-outline"}
                size={22}
                color={post.viewer_liked ? theme.colors.error : theme.colors.text}
              />
            </Pressable>
            <Pressable onPress={() => commentInputRef.current?.focus()}>
              <Ionicons name="chatbubble-outline" size={22} color={theme.colors.text} />
            </Pressable>
            <View style={styles.actionSpacer} />
            <Pressable onPress={handleToggleSave} disabled={togglingSave}>
              <Ionicons
                name={post.viewer_saved ? "bookmark" : "bookmark-outline"}
                size={22}
                color={theme.colors.text}
              />
            </Pressable>
          </View>

          <Text style={styles.likesText}>{post.likes_count} curtidas</Text>
          {post.descricao ? (
            <Text style={styles.description}>
              <Text style={styles.descriptionAuthor}>{post.nome_exibicao || post.username}</Text>{" "}
              {post.descricao}
            </Text>
          ) : null}

          {hasTreino ? (
            <View style={styles.treinoResumo}>
              <Text style={styles.treinoBadge}>Treino compartilhado</Text>
              <View style={styles.treinoMetrics}>
                <Text style={styles.treinoMetricText}>
                  Duracao {post.treino?.duracao ? Math.round(post.treino.duracao / 60) : 0} min
                </Text>
                <Text style={styles.treinoMetricText}>Peso {Number(post.treino?.peso_total ?? 0).toFixed(1)}kg</Text>
                <Text style={styles.treinoMetricText}>Series {post.treino?.total_series ?? 0}</Text>
                <Text style={styles.treinoMetricText}>Exercicios {post.treino?.total_exercicios ?? 0}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.commentComposer}>
          <TextInput
            ref={commentInputRef}
            value={commentInput}
            onChangeText={setCommentInput}
            style={styles.commentInput}
            placeholder="Adicione um comentario..."
            placeholderTextColor={theme.colors.mutedText}
            editable={!sendingComment}
            maxLength={400}
          />
          <Pressable style={styles.sendButton} onPress={handleCreateComment} disabled={sendingComment}>
            {sendingComment ? (
              <ActivityIndicator color={theme.colors.buttonText} />
            ) : (
              <Text style={styles.sendButtonText}>Publicar</Text>
            )}
          </Pressable>
        </View>

        {post.comments_count > 0 ? (
          <Pressable style={styles.viewAll} onPress={() => setShowAllComments((prev) => !prev)}>
            <Text style={styles.viewAllText}>
              {showAllComments ? "Ocultar comentarios" : `Ver todos os ${post.comments_count} comentarios`}
            </Text>
          </Pressable>
        ) : null}

        {post.comentarios.length === 0 ? <Text style={styles.emptyComment}>Nenhum comentario ainda.</Text> : null}

        {(showAllComments ? post.comentarios : post.comentarios.slice(0, 2)).map((comment) => (
          <View key={comment.id} style={styles.commentCard}>
            <View style={styles.commentTop}>
              <Text style={styles.commentAuthor}>{comment.nome_exibicao || comment.username || "Usuario"}</Text>
              <Pressable
                style={styles.commentLikeButton}
                onPress={() => handleToggleCommentLike(comment.id)}
                disabled={togglingCommentLike[comment.id]}
              >
                <Ionicons
                  name={comment.viewer_liked ? "heart" : "heart-outline"}
                  size={14}
                  color={theme.colors.text}
                />
                <Text style={styles.commentLikeText}>{comment.likes_count}</Text>
              </Pressable>
            </View>
            <Text style={styles.commentText}>{comment.comentario}</Text>
          </View>
        ))}

        <View style={styles.extraActions}>
          <Pressable style={styles.reportButton} onPress={handleReport} disabled={reporting}>
            <Ionicons name="flag-outline" size={16} color={theme.colors.text} />
            <Text style={styles.reportText}>Denunciar</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      padding: 16,
      gap: 12,
      paddingBottom: 44,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.background,
      padding: 16,
    },
    loadingText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    manageButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 2,
      paddingVertical: 4,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
      fontSize: 14,
    },
    authorInfo: {
      gap: 2,
      flex: 1,
    },
    authorName: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 15,
    },
    authorUser: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    postDate: {
      color: theme.colors.mutedText,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    postCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      padding: 12,
      gap: 10,
    },
    mediaCard: {
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.colors.inputBackground,
    },
    media: {
      width: "100%",
      height: 320,
      backgroundColor: theme.colors.inputBackground,
    },
    mediaEmpty: {
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mediaEmptyText: {
      color: theme.colors.mutedText,
      fontSize: 13,
      fontWeight: "600",
    },
    videoPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.button,
      gap: 4,
    },
    videoPlaceholderText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 2,
    },
    actionSpacer: {
      flex: 1,
    },
    likesText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 13,
      paddingHorizontal: 2,
    },
    description: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 2,
    },
    descriptionAuthor: {
      fontWeight: "700",
      color: theme.colors.text,
    },
    treinoResumo: {
      gap: 6,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBackground,
    },
    treinoBadge: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.text,
    },
    treinoMetrics: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    treinoMetricText: {
      fontSize: 11,
      color: theme.colors.mutedText,
      fontWeight: "600",
    },
    commentComposer: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 44,
    },
    sendButton: {
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 92,
    },
    sendButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    viewAll: {
      paddingTop: 6,
    },
    viewAllText: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    emptyComment: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    commentCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    commentTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    commentAuthor: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 13,
    },
    commentText: {
      color: theme.colors.text,
      fontSize: 14,
    },
    commentLikeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    commentLikeText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    extraActions: {
      alignItems: "flex-start",
    },
    reportButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 0,
      paddingHorizontal: 0,
      paddingVertical: 6,
      backgroundColor: "transparent",
    },
    reportText: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 12,
    },
    errorText: {
      color: theme.colors.error,
      fontWeight: "600",
    },
  });
}
