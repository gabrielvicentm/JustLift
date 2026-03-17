import { useCallback, useEffect, useMemo, useState } from "react";
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

        <View style={styles.profileSection}>
          <View style={styles.bannerWrapper}>
            {post.foto_perfil ? (
              <Image source={{ uri: post.foto_perfil }} style={styles.bannerImage} />
            ) : (
              <View style={styles.bannerPlaceholder} />
            )}
          </View>

          <View style={styles.profileTopRow}>
            <View style={styles.avatarOverlap}>
              <View style={styles.avatarRing}>
                {post.foto_perfil ? (
                  <Image source={{ uri: post.foto_perfil }} style={styles.avatarLarge} />
                ) : (
                  <View style={[styles.avatarLarge, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>
                      {(post.nome_exibicao || post.username || "U").slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameBlock}>
                <Text style={styles.nameText}>{post.nome_exibicao || post.username}</Text>
                <Text style={styles.userText}>@{post.username}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.postCard}>
          {(post.midias ?? []).map((media) => (
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

          <View style={styles.actionsRow}>
            <Pressable onPress={handleToggleLike} disabled={togglingLike}>
              <Ionicons
                name={post.viewer_liked ? "heart" : "heart-outline"}
                size={22}
                color={post.viewer_liked ? theme.colors.error : theme.colors.text}
              />
            </Pressable>
            <Pressable onPress={() => {}}>
              <Ionicons name="chatbubble-outline" size={22} color={theme.colors.text} />
            </Pressable>
            <Pressable onPress={() => {}}>
              <Ionicons name="paper-plane-outline" size={22} color={theme.colors.text} />
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

          <>
            <Text style={styles.likesText}>{post.likes_count} curtidas</Text>
            {post.descricao ? (
              <Text style={styles.description}>
                <Text style={styles.descriptionAuthor}>
                  {post.nome_exibicao || post.username}
                </Text>{" "}
                {post.descricao}
              </Text>
            ) : null}
          </>
        </View>

        <View style={styles.commentComposer}>
          <TextInput
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
              {showAllComments
                ? "Ocultar comentários"
                : `Ver todos os ${post.comments_count} comentários`}
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
    manageButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    profileSection: {
      gap: 10,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      padding: 14,
      marginBottom: 14,
    },
    bannerWrapper: {
      width: "100%",
      height: 90,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.colors.inputBackground,
    },
    bannerImage: {
      width: "100%",
      height: "100%",
    },
    bannerPlaceholder: {
      flex: 1,
      backgroundColor: theme.colors.inputBackground,
    },
    profileTopRow: {
      flexDirection: "row",
      gap: 14,
      alignItems: "flex-end",
      marginTop: 12,
    },
    avatarOverlap: {
      marginTop: -72,
      zIndex: 2,
    },
    avatarRing: {
      width: 104,
      height: 104,
      borderRadius: 52,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.inputBackground,
      position: "relative",
    },
    avatarLarge: {
      width: 94,
      height: 94,
      borderRadius: 47,
      backgroundColor: theme.colors.inputBackground,
    },
    profileInfo: {
      flex: 1,
      minHeight: 104,
      justifyContent: "space-between",
      paddingBottom: 4,
      gap: 6,
    },
    nameBlock: {
      gap: 2,
    },
    nameText: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    userText: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    postCard: {
      borderWidth: 0,
      backgroundColor: "transparent",
      paddingHorizontal: 0,
      gap: 10,
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
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
    mediaCard: {
      borderWidth: 0,
      borderRadius: 0,
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
      marginHorizontal: -16,
    },
    media: {
      width: "100%",
      height: 320,
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
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
    },
    actionSpacer: {
      flex: 1,
    },
    likesText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 13,
      paddingHorizontal: 16,
    },
    description: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 16,
    },
    descriptionAuthor: {
      fontWeight: "700",
      color: theme.colors.text,
    },
    commentComposer: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      paddingHorizontal: 16,
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
      paddingHorizontal: 16,
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
      borderWidth: 0,
      backgroundColor: "transparent",
      borderRadius: 0,
      paddingHorizontal: 16,
      paddingVertical: 6,
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
      paddingHorizontal: 16,
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
