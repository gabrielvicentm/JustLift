import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { getApiErrorMessage } from "@/app/features/profile/service";
import {
  createPostComment,
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

  const loadPost = useCallback(async () => {
    if (!Number.isInteger(postId) || postId <= 0) {
      setError("ID de post invalido.");
      setLoading(false);
      return;
    }

    try {
      setError("");
      setLoading(true);
      const data = await fetchPostById(postId);
      setPost(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "carregar post"));
    } finally {
      setLoading(false);
    }
  }, [postId]);

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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>
        </View>

        <View style={styles.authorRow}>
          {post.foto_perfil ? (
            <Image source={{ uri: post.foto_perfil }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{(post.nome_exibicao || post.username || "U").slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{post.nome_exibicao || post.username}</Text>
            <Text style={styles.authorUser}>@{post.username}</Text>
          </View>
        </View>

        {post.midias.map((media) => (
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
        ))}

        {post.descricao ? <Text style={styles.description}>{post.descricao}</Text> : null}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={handleToggleLike} disabled={togglingLike}>
            <Ionicons name={post.viewer_liked ? "heart" : "heart-outline"} size={18} color={theme.colors.text} />
            <Text style={styles.actionText}>Curtir ({post.likes_count})</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleToggleSave} disabled={togglingSave}>
            <Ionicons name={post.viewer_saved ? "bookmark" : "bookmark-outline"} size={18} color={theme.colors.text} />
            <Text style={styles.actionText}>Salvar</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleReport} disabled={reporting}>
            <Ionicons name="flag-outline" size={18} color={theme.colors.text} />
            <Text style={styles.actionText}>Denunciar</Text>
          </Pressable>
        </View>

        <View style={styles.commentComposer}>
          <TextInput
            value={commentInput}
            onChangeText={setCommentInput}
            style={styles.commentInput}
            placeholder="Escreva um comentario..."
            placeholderTextColor={theme.colors.mutedText}
            editable={!sendingComment}
            maxLength={400}
          />
          <Pressable style={styles.sendButton} onPress={handleCreateComment} disabled={sendingComment}>
            {sendingComment ? (
              <ActivityIndicator color={theme.colors.buttonText} />
            ) : (
              <Text style={styles.sendButtonText}>Comentar</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.commentsTitle}>Comentarios ({post.comments_count})</Text>
        {post.comentarios.length === 0 ? <Text style={styles.emptyComment}>Nenhum comentario ainda.</Text> : null}
        {post.comentarios.map((comment) => (
          <View key={comment.id} style={styles.commentCard}>
            <Text style={styles.commentAuthor}>{comment.nome_exibicao || comment.username || "Usuario"}</Text>
            <Text style={styles.commentText}>{comment.comentario}</Text>
            <Pressable
              style={styles.commentLikeButton}
              onPress={() => handleToggleCommentLike(comment.id)}
              disabled={togglingCommentLike[comment.id]}
            >
              <Ionicons
                name={comment.viewer_liked ? "heart" : "heart-outline"}
                size={16}
                color={theme.colors.text}
              />
              <Text style={styles.commentLikeText}>Curtir ({comment.likes_count})</Text>
            </Pressable>
          </View>
        ))}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </View>
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
      gap: 10,
      paddingBottom: 24,
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
    authorRow: {
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
      fontSize: 15,
    },
    authorInfo: {
      gap: 2,
    },
    authorName: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    authorUser: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    mediaCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
    },
    media: {
      width: "100%",
      height: 280,
      backgroundColor: theme.colors.inputBackground,
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
    description: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    actionText: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 13,
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
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    sendButton: {
      height: 42,
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 90,
    },
    sendButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    commentsTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    emptyComment: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    commentCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      padding: 10,
      gap: 4,
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
      marginTop: 4,
    },
    commentLikeText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    errorText: {
      color: theme.colors.error,
      fontWeight: "600",
    },
  });
}
