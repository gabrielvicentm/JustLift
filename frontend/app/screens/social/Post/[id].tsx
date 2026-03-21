import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

const HERO_GRADIENT = ["#07101D", "#16112F", "#290F35"] as const;
const SURFACE_GRADIENT = ["rgba(91, 231, 255, 0.22)", "rgba(124, 92, 255, 0.18)", "rgba(255, 75, 216, 0.2)"] as const;
const GLOW_GRADIENT = ["rgba(91, 231, 255, 0.28)", "rgba(255, 75, 216, 0.16)", "transparent"] as const;
const ACTION_GRADIENT = ["rgba(91, 231, 255, 0.16)", "rgba(124, 92, 255, 0.14)"] as const;
const COMMENT_CARD_GRADIENT = ["rgba(12, 16, 28, 0.96)", "rgba(19, 12, 37, 0.96)"] as const;

export default function PostDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postIdRaw = Array.isArray(params.id) ? params.id[0] : params.id;
  const postId = Number(postIdRaw);
  const mediaIndexParam = useLocalSearchParams<{ mediaIndex?: string | string[] }>();
  const mediaIndexRaw = Array.isArray(mediaIndexParam.mediaIndex)
    ? mediaIndexParam.mediaIndex[0]
    : mediaIndexParam.mediaIndex;
  const initialMediaIndex = Math.max(0, Number(mediaIndexRaw) || 0);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width: windowWidth } = useWindowDimensions();
  const mediaWidth = Math.max(windowWidth - 30, 280);

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
  const [activeMediaIndex, setActiveMediaIndex] = useState(initialMediaIndex);
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

  useEffect(() => {
    setActiveMediaIndex(0);
  }, [post?.id]);

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

  const handleMediaScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!post?.midias?.length) {
      return;
    }

    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / mediaWidth);
    setActiveMediaIndex(Math.max(0, Math.min(nextIndex, post.midias.length - 1)));
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
  const visibleComments = showAllComments ? post.comentarios : post.comentarios.slice(0, 2);

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
        <View pointerEvents="none" style={styles.orbPrimary} />
        <View pointerEvents="none" style={styles.orbSecondary} />
        <View pointerEvents="none" style={styles.gridOverlay} />

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

        <LinearGradient colors={SURFACE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.authorCard}>
          <LinearGradient colors={GLOW_GRADIENT} style={styles.authorGlow} />
          <Pressable style={styles.authorShellCompact} onPress={handleOpenProfile}>
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
        </LinearGradient>

        <LinearGradient colors={SURFACE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.postCardBorder}>
          <View style={styles.postCard}>
            <View style={styles.mediaFrame}>
              <LinearGradient colors={HERO_GRADIENT} style={styles.mediaBackdrop} />
              {(post.midias ?? []).length === 0 ? (
                <View style={[styles.media, styles.mediaEmpty]}>
                  <Ionicons name="images-outline" size={26} color={theme.colors.mutedText} />
                  <Text style={styles.mediaEmptyText}>Sem midia</Text>
                </View>
              ) : (
                <>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onMomentumScrollEnd={handleMediaScroll}
                    scrollEnabled={(post.midias?.length ?? 0) > 1}
                    style={styles.mediaCarousel}
                  >
                    {(post.midias ?? []).map((media) => (
                      <View key={media.id} style={[styles.mediaCard, { width: mediaWidth }]}> 
                        {media.type === "image" ? (
                          <Image source={{ uri: media.url }} style={styles.media} />
                        ) : (
                          <View style={[styles.media, styles.videoPlaceholder]}>
                            <Ionicons name="videocam" size={28} color={theme.colors.buttonText} />
                            <Text style={styles.videoPlaceholderText}>Video</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>

                  {(post.midias?.length ?? 0) > 1 ? (
                    <>
                      <View style={styles.mediaCounterBadge}>
                        <Ionicons name="images-outline" size={12} color="#FFFFFF" />
                        <Text style={styles.mediaCounterText}>{activeMediaIndex + 1}/{post.midias.length}</Text>
                      </View>
                      <View style={styles.mediaDots}>
                        {(post.midias ?? []).map((media, index) => (
                          <View
                            key={media.id}
                            style={[styles.mediaDot, index === activeMediaIndex && styles.mediaDotActive]}
                          />
                        ))}
                      </View>
                    </>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.postBody}>
              <View style={styles.actionsRow}>
                <Pressable style={styles.actionButton} onPress={handleToggleLike} disabled={togglingLike}>
                  <LinearGradient
                    colors={post.viewer_liked ? (["rgba(244, 63, 94, 0.32)", "rgba(255, 75, 216, 0.22)"] as const) : ACTION_GRADIENT}
                    style={styles.actionButtonInner}
                  >
                    <Ionicons
                      name={post.viewer_liked ? "heart" : "heart-outline"}
                      size={17}
                      color={post.viewer_liked ? "#FF6CAB" : theme.colors.text}
                    />
                  </LinearGradient>
                </Pressable>
                <Pressable style={[styles.actionButton, styles.commentActionButton]} onPress={() => commentInputRef.current?.focus()}>
                  <LinearGradient colors={ACTION_GRADIENT} style={[styles.actionButtonInner, styles.commentActionInner]}>
                    <Ionicons name="chatbubble-outline" size={17} color={theme.colors.text} />
                    <Text style={styles.commentActionCount}>{post.comments_count}</Text>
                  </LinearGradient>
                </Pressable>
                <View style={styles.actionSpacer} />
                <Pressable style={styles.actionButton} onPress={handleToggleSave} disabled={togglingSave}>
                  <LinearGradient
                    colors={post.viewer_saved ? (["rgba(255, 214, 10, 0.28)", "rgba(255, 149, 0, 0.18)"] as const) : ACTION_GRADIENT}
                    style={styles.actionButtonInner}
                  >
                    <Ionicons
                      name={post.viewer_saved ? "bookmark" : "bookmark-outline"}
                      size={17}
                      color={post.viewer_saved ? "#FFD60A" : theme.colors.text}
                    />
                  </LinearGradient>
                </Pressable>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.likesText}>{post.likes_count} curtidas</Text>
                <Text style={styles.commentsMeta}>{post.comments_count} comentarios</Text>
              </View>

              {post.descricao ? (
                <View style={styles.descriptionCard}>
                  <Text style={styles.descriptionEyebrow}>Legenda</Text>
                  <Text style={styles.description}>
                    <Text style={styles.descriptionAuthor}>{post.nome_exibicao || post.username}</Text>{" "}
                    {post.descricao}
                  </Text>
                </View>
              ) : null}

              {hasTreino ? (
                <View style={styles.treinoResumo}>
                  <View style={styles.treinoHeader}>
                    <Text style={styles.treinoBadge}>Treino compartilhado</Text>
                    <Ionicons name="flame" size={16} color="#FF8A00" />
                  </View>
                  <View style={styles.treinoMetrics}>
                    <View style={styles.metricChip}>
                      <Text style={styles.metricChipText}>
                        Duracao {post.treino?.duracao ? Math.round(post.treino.duracao / 60) : 0} min
                      </Text>
                    </View>
                    <View style={styles.metricChip}>
                      <Text style={styles.metricChipText}>Peso {Number(post.treino?.peso_total ?? 0).toFixed(1)}kg</Text>
                    </View>
                    <View style={styles.metricChip}>
                      <Text style={styles.metricChipText}>Series {post.treino?.total_series ?? 0}</Text>
                    </View>
                    <View style={styles.metricChip}>
                      <Text style={styles.metricChipText}>Exercicios {post.treino?.total_exercicios ?? 0}</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        <View style={styles.commentsSection}>
          <LinearGradient colors={SURFACE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.commentsHeaderCard}>
            <View style={styles.commentsHeaderShell}>
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>Comentarios</Text>
                <Text style={styles.commentsCountBadge}>{post.comments_count}</Text>
              </View>
            </View>
          </LinearGradient>

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
            <Pressable onPress={handleCreateComment} disabled={sendingComment} style={styles.sendButton}>
              <LinearGradient colors={theme.colors.buttonGradient as [string, string, ...string[]]} style={styles.sendButtonInner}>
                {sendingComment ? (
                  <ActivityIndicator color={theme.colors.buttonText} />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={14} color={theme.colors.buttonText} />
                    <Text style={styles.sendButtonText}>Publicar</Text>
                  </>
                )}
              </LinearGradient>
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

          {visibleComments.map((comment) => (
            <LinearGradient key={comment.id} colors={COMMENT_CARD_GRADIENT} style={styles.commentCard}>
              {comment.foto_perfil ? (
                <Image source={{ uri: comment.foto_perfil }} style={styles.commentAvatar} />
              ) : (
                <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
                  <Text style={styles.commentAvatarFallbackText}>
                    {(comment.nome_exibicao || comment.username || "U").slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.commentBody}>
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
                      color={comment.viewer_liked ? "#FF6CAB" : theme.colors.text}
                    />
                    <Text style={styles.commentLikeText}>{comment.likes_count}</Text>
                  </Pressable>
                </View>
                {comment.username ? <Text style={styles.commentUser}>@{comment.username}</Text> : null}
                <Text style={styles.commentText}>{comment.comentario}</Text>
              </View>
            </LinearGradient>
          ))}

          <View style={styles.extraActions}>
            <Pressable style={styles.reportButton} onPress={handleReport} disabled={reporting}>
              <Ionicons name="flag-outline" size={16} color={theme.colors.text} />
              <Text style={styles.reportText}>Denunciar</Text>
            </Pressable>
          </View>
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
      paddingHorizontal: 14,
      paddingTop: 16,
      gap: 16,
      paddingBottom: 52,
      position: "relative",
      overflow: "hidden",
    },
    orbPrimary: {
      position: "absolute",
      top: 36,
      right: -54,
      width: 180,
      height: 180,
      borderRadius: 999,
      backgroundColor: "rgba(91, 231, 255, 0.14)",
    },
    orbSecondary: {
      position: "absolute",
      top: 212,
      left: -76,
      width: 220,
      height: 220,
      borderRadius: 999,
      backgroundColor: "rgba(255, 75, 216, 0.12)",
    },
    gridOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.14,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: "rgba(91, 231, 255, 0.08)",
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
      marginBottom: 6,
      zIndex: 2,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(10, 16, 28, 0.84)",
      borderWidth: 1,
      borderColor: "rgba(91, 231, 255, 0.26)",
    },
    backButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    manageButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(10, 16, 28, 0.84)",
      borderWidth: 1,
      borderColor: "rgba(255, 75, 216, 0.26)",
    },
    authorCard: {
      borderRadius: 26,
      padding: 1,
      position: "relative",
      overflow: "hidden",
    },
    authorGlow: {
      position: "absolute",
      top: -36,
      right: -26,
      width: 180,
      height: 180,
      borderRadius: 999,
    },
    authorShellCompact: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 25,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: "rgba(7, 10, 18, 0.94)",
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.colors.inputBackground,
      borderWidth: 2,
      borderColor: "rgba(91, 231, 255, 0.32)",
    },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(91, 231, 255, 0.28)",
    },
    avatarFallbackText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 17,
    },
    authorInfo: {
      gap: 2,
      flex: 1,
    },
    authorName: {
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 16,
    },
    authorUser: {
      color: "rgba(229, 231, 235, 0.72)",
      fontSize: 12,
    },
    postDate: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      backgroundColor: "rgba(255, 75, 216, 0.14)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(255, 75, 216, 0.24)",
    },
    postCardBorder: {
      borderRadius: 28,
      padding: 1,
    },
    postCard: {
      borderRadius: 27,
      backgroundColor: "#080C14",
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOpacity: 0.32,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
    mediaFrame: {
      backgroundColor: "#05070B",
      position: "relative",
    },
    mediaBackdrop: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.9,
    },
    mediaCarousel: {
      width: "100%",
    },
    mediaCard: {
      overflow: "hidden",
      backgroundColor: "#05070B",
    },
    mediaWrapper: {
      position: "relative",
      marginHorizontal: -16,
    },
    media: {
      width: "100%",
      height: 460,
      backgroundColor: "#05070B",
    },
    mediaCounterBadge: {
      position: "absolute",
      top: 14,
      right: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: "rgba(7, 10, 18, 0.78)",
      borderWidth: 1,
      borderColor: "rgba(91, 231, 255, 0.24)",
    },
    mediaCounterText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    mediaDots: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 14,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
    },
    mediaDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: "rgba(255, 255, 255, 0.38)",
    },
    mediaDotActive: {
      width: 18,
      backgroundColor: "#5BE7FF",
    },
    mediaEmpty: {
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(91, 231, 255, 0.22)",
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
    postBody: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 20,
      gap: 14,
      backgroundColor: "#080C14",
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    actionButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    actionButtonInner: {
      flex: 1,
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
    },
    commentActionButton: {
      width: 62,
    },
    commentActionInner: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 10,
    },
    commentActionCount: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: "800",
    },
    actionSpacer: {
      flex: 1,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingHorizontal: 2,
    },
    likesText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 14,
    },
    descriptionCard: {
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 22,
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
    },
    commentsMeta: {
      color: "rgba(229, 231, 235, 0.7)",
      fontSize: 12,
      fontWeight: "700",
    },
    descriptionEyebrow: {
      color: theme.colors.mutedText,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
    },
    description: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 22,
    },
    descriptionAuthor: {
      fontWeight: "700",
      color: theme.colors.text,
    },
    treinoResumo: {
      gap: 8,
      padding: 16,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "rgba(255, 149, 0, 0.2)",
      backgroundColor: "rgba(255, 138, 0, 0.08)",
    },
    treinoHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    treinoBadge: {
      fontSize: 12,
      fontWeight: "800",
      color: "#FFD7A1",
    },
    treinoMetrics: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    metricChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: "rgba(0, 0, 0, 0.22)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
    },
    metricChipText: {
      fontSize: 11,
      color: "#FFF1D6",
      fontWeight: "700",
    },
    commentsSection: {
      borderWidth: 1,
      borderColor: "rgba(91, 231, 255, 0.14)",
      borderRadius: 28,
      backgroundColor: "#090D16",
      padding: 14,
      gap: 12,
      shadowColor: "#000000",
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    commentsHeaderCard: {
      borderRadius: 22,
      padding: 1,
    },
    commentsHeaderShell: {
      borderRadius: 21,
      backgroundColor: "rgba(7, 10, 18, 0.92)",
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    commentsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    commentsTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "900",
    },
    commentsCountBadge: {
      minWidth: 34,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(255, 75, 216, 0.16)",
      color: theme.colors.text,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "800",
      borderWidth: 1,
      borderColor: "rgba(255, 75, 216, 0.22)",
    },
    commentComposer: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: "rgba(91, 231, 255, 0.16)",
      borderRadius: 18,
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      color: theme.colors.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 50,
    },
    sendButton: {
      height: 50,
      borderRadius: 18,
      minWidth: 104,
      overflow: "hidden",
    },
    sendButtonInner: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 16,
    },
    sendButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    viewAll: {
      paddingTop: 2,
    },
    viewAllText: {
      color: theme.colors.mutedText,
      fontSize: 13,
      fontWeight: "700",
    },
    emptyComment: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    commentCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
      borderRadius: 22,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: "rgba(91, 231, 255, 0.22)",
    },
    commentAvatarFallback: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(91, 231, 255, 0.18)",
    },
    commentAvatarFallbackText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "800",
    },
    commentBody: {
      flex: 1,
      gap: 4,
    },
    commentTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    commentAuthor: {
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 14,
    },
    commentUser: {
      color: "rgba(229, 231, 235, 0.62)",
      fontSize: 11,
    },
    commentText: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    commentLikeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(255, 255, 255, 0.04)",
    },
    commentLikeText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    extraActions: {
      alignItems: "flex-start",
      paddingTop: 4,
    },
    reportButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 75, 216, 0.22)",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255, 75, 216, 0.1)",
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
