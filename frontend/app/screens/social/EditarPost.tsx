import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { LinearGradient } from "expo-linear-gradient";
import { fetchMyProfile, getApiErrorMessage } from "@/app/features/profile/service";
import { deletePost, deletePostComment, fetchPostById, updatePost, uploadMediaToR2 } from "@/app/features/social/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import type { PostDetail } from "@/app/features/social/types";

const MAX_MIDIAS = 9;

type EditableMedia = {
  id: string;
  type: "image" | "video";
  uri: string;
  key: string | null;
  isLocal: boolean;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
};

export default function EditarPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postIdRaw = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const postId = Number(postIdRaw);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [descricao, setDescricao] = useState("");
  const [midias, setMidias] = useState<EditableMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingPost, setDeletingPost] = useState(false);
  const [deletingComment, setDeletingComment] = useState<Record<number, boolean>>({});

  const gridSpacing = 6;
  const horizontalPadding = 16;
  const baseWidth = width && width > 0 ? width : 360;
  const tileSize = Math.floor((baseWidth - horizontalPadding * 2 - gridSpacing * 2) / 3);

  const mapExistingMedia = (data: PostDetail) => {
    return data.midias.map((item) => ({
      id: `existing-${item.id}`,
      type: item.type,
      uri: item.url,
      key: item.key,
      isLocal: false,
    })) as EditableMedia[];
  };

  const loadPost = useCallback(async () => {
    if (!Number.isInteger(postId) || postId <= 0) {
      setError("Post invalido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [data, myProfile] = await Promise.all([fetchPostById(postId), fetchMyProfile()]);
      if (data.user_id !== myProfile.user_id) {
        setError("Voce nao pode editar este post.");
        setPost(null);
        return;
      }

      setPost(data);
      setDescricao(data.descricao || "");
      setMidias(mapExistingMedia(data));
    } catch (err) {
      setError(getApiErrorMessage(err, "carregar post para edicao"));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const addLocalAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const novos = assets.map((asset, idx) => ({
      id: `local-${Date.now()}-${idx}-${asset.assetId ?? "x"}`,
      type: asset.type === "video" ? "video" : "image",
      uri: asset.uri,
      key: null,
      isLocal: true,
      fileName: asset.fileName ?? `midia-${Date.now()}-${idx}`,
      mimeType: asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      fileSize: asset.fileSize,
    })) as EditableMedia[];

    setMidias((current) => [...current, ...novos].slice(0, MAX_MIDIAS));
  };

  const handleFromGallery = async () => {
    if (midias.length >= MAX_MIDIAS) {
      Alert.alert("Limite atingido", `No maximo ${MAX_MIDIAS} midias por post.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Autorize a galeria para adicionar midias.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: MAX_MIDIAS - midias.length,
      mediaTypes: ["images", "videos"],
      quality: 0.9,
    });

    if (!result.canceled && result.assets.length > 0) {
      addLocalAssets(result.assets);
    }
  };

  const handleFromCamera = async () => {
    if (midias.length >= MAX_MIDIAS) {
      Alert.alert("Limite atingido", `No maximo ${MAX_MIDIAS} midias por post.`);
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Autorize a camera para adicionar midias.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.9,
    });

    if (!result.canceled && result.assets.length > 0) {
      addLocalAssets(result.assets);
    }
  };

  const handleAddMedia = () => {
    Alert.alert("Adicionar midia", "Escolha uma opcao", [
      { text: "Galeria", onPress: handleFromGallery },
      { text: "Camera", onPress: handleFromCamera },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleRemoveMedia = (id: string) => {
    setMidias((current) => current.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    if (!post || saving) return;

    const safeDescricao = descricao.trim();
    if (!safeDescricao && midias.length === 0) {
      setError("O post nao pode ficar vazio.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payloadMidias = await Promise.all(
        midias.map(async (item) => {
          if (!item.isLocal) {
            return {
              type: item.type,
              url: item.uri,
              key: item.key,
            } as const;
          }

          const uploaded = await uploadMediaToR2(
            item.uri,
            item.fileName || `midia-${Date.now()}`,
            item.mimeType || (item.type === "video" ? "video/mp4" : "image/jpeg"),
            item.fileSize,
          );

          return {
            type: item.type,
            url: uploaded.url,
            key: uploaded.key,
          } as const;
        }),
      );

      await updatePost(post.id, {
        descricao: safeDescricao,
        midias: payloadMidias,
      });

      Alert.alert("Sucesso", "Post atualizado com sucesso.");
      router.back();
    } catch (err) {
      setError(getApiErrorMessage(err, "salvar alteracoes do post"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post || deletingPost) return;
    Alert.alert("Excluir post", "Tem certeza que deseja excluir este post?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingPost(true);
            await deletePost(post.id);
            Alert.alert("Post excluido", "Seu post foi removido.");
            router.back();
          } catch (err) {
            setError(getApiErrorMessage(err, "excluir post"));
          } finally {
            setDeletingPost(false);
          }
        },
      },
    ]);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!post || deletingComment[commentId]) return;
    Alert.alert("Excluir comentario", "Deseja remover este comentario?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingComment((prev) => ({ ...prev, [commentId]: true }));
            await deletePostComment(post.id, commentId);
            setPost((current) =>
              current
                ? {
                    ...current,
                    comments_count: Math.max(0, current.comments_count - 1),
                    comentarios: current.comentarios.filter((comment) => comment.id !== commentId),
                  }
                : current,
            );
          } catch (err) {
            setError(getApiErrorMessage(err, "excluir comentario"));
          } finally {
            setDeletingComment((prev) => ({ ...prev, [commentId]: false }));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.text} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "Post nao encontrado."}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const renderMediaItem = ({ item, drag, isActive, getIndex }: RenderItemParams<EditableMedia>) => {
    const index = getIndex?.() ?? 0;
    return (
    <Pressable
      onPress={() => {
        if (!post) return;
        router.push(`/screens/social/Post/${post.id}?mediaIndex=${index}` as never);
      }}
      onLongPress={drag}
      disabled={saving}
      style={[
        styles.mediaCard,
        { width: tileSize, height: tileSize },
        isActive && styles.mediaCardActive,
      ]}
    >
      {item.type === "image" ? (
        <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
      ) : (
        <View style={[styles.mediaPreview, styles.videoPreview]}>
          <Text style={styles.videoText}>Video</Text>
        </View>
      )}

      <View style={styles.mediaBadge}>
        <Ionicons name="play" size={12} color="#E0E0E0" />
      </View>

      <Pressable style={styles.removeButton} onPress={() => handleRemoveMedia(item.id)} disabled={saving}>
        <Ionicons name="close" size={14} color="#E0E0E0" />
      </Pressable>

      <View style={styles.dragHint}>
        <Ionicons name="reorder-three-outline" size={16} color="#E0E0E0" />
        <Text style={styles.dragHintText}>Segure e arraste</Text>
      </View>
    </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <DraggableFlatList
        data={midias}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => setMidias(data)}
        renderItem={renderMediaItem}
        numColumns={3}
        activationDistance={14}
        contentContainerStyle={styles.container}
        columnWrapperStyle={styles.gridRow}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        ListHeaderComponent={
          <>
            <View style={styles.topRow}>
              <LinearGradient
                colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
                start={{ x: 0, y: 0.2 }}
                end={{ x: 1, y: 0.8 }}
                style={styles.backBorder}
              >
                <Pressable style={styles.backButton} onPress={() => router.back()} disabled={saving}>
                  <Text style={styles.backButtonText}>Voltar</Text>
                </Pressable>
              </LinearGradient>
            </View>

            <LinearGradient
              colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.heroBorder}
            >
              <View style={styles.heroCard}>
                <Text style={styles.title}>Editar post</Text>
                <Text style={styles.subtitle}>Altere descricao e quantidade de midias (maximo de 9).</Text>
              </View>
            </LinearGradient>

            <LinearGradient
              colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.addBorder}
            >
              <Pressable style={styles.addButton} onPress={handleAddMedia} disabled={saving || midias.length >= MAX_MIDIAS}>
                <Ionicons name="images-outline" size={18} color="#E0E0E0" />
                <Text style={styles.addButtonText}>Adicionar midia</Text>
              </Pressable>
            </LinearGradient>

            <Text style={styles.counter}>{midias.length}/{MAX_MIDIAS} midias</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyMidia}>Nenhuma midia selecionada.</Text>}
        ListFooterComponent={
          <>
            <Text style={styles.label}>Descricao</Text>
            <TextInput
              value={descricao}
              onChangeText={setDescricao}
              style={styles.input}
              multiline
              textAlignVertical="top"
              maxLength={1000}
              editable={!saving}
              placeholder="Escreva a descricao do post..."
              placeholderTextColor={theme.colors.mutedText}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <LinearGradient
              colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.saveBorder}
            >
              <Pressable style={[styles.saveButton, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#E0E0E0" /> : <Text style={styles.saveButtonText}>Salvar alteracoes</Text>}
              </Pressable>
            </LinearGradient>

            <Pressable
              style={[styles.deletePostButton, deletingPost && styles.disabled]}
              onPress={handleDeletePost}
              disabled={deletingPost}
            >
              {deletingPost ? (
                <ActivityIndicator color="#E0E0E0" />
              ) : (
                <Text style={styles.deletePostButtonText}>Excluir post</Text>
              )}
            </Pressable>

            <Text style={styles.sectionTitle}>Comentarios</Text>
            {post.comentarios.length === 0 ? (
              <Text style={styles.emptyComments}>Sem comentarios neste post.</Text>
            ) : (
              post.comentarios.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>
                      {comment.nome_exibicao || comment.username || "Usuario"}
                    </Text>
                    <Pressable
                      style={[styles.commentDeleteButton, deletingComment[comment.id] && styles.disabled]}
                      onPress={() => handleDeleteComment(comment.id)}
                      disabled={deletingComment[comment.id]}
                    >
                      {deletingComment[comment.id] ? (
                        <ActivityIndicator color={theme.colors.buttonText} />
                      ) : (
                        <Text style={styles.commentDeleteText}>Excluir</Text>
                      )}
                    </Pressable>
                  </View>
                  <Text style={styles.commentText}>{comment.comentario}</Text>
                </View>
              ))
            )}
          </>
        }
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: "#0B0E18",
    },
    container: {
      padding: 16,
      gap: 10,
      paddingBottom: 44,
    },
    center: {
      flex: 1,
      backgroundColor: "#0B0E18",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      gap: 8,
    },
    loadingText: {
      color: "#E0E0E0",
      fontWeight: "600",
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "flex-start",
    },
    backBorder: {
      borderRadius: 12,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    backButton: {
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    backButtonText: {
      color: "#E0E0E0",
      fontWeight: "700",
    },
    heroBorder: {
      borderRadius: 18,
      padding: 1.5,
      shadowColor: "#74D3FF",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
      marginTop: 10,
    },
    heroCard: {
      borderRadius: 16,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      padding: 16,
      gap: 6,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: "#E0E0E0",
      textShadowColor: "rgba(0, 255, 255, 0.65)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    subtitle: {
      color: "#7FE7FF",
      fontSize: 13,
      textShadowColor: "rgba(0, 255, 255, 0.35)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    addBorder: {
      borderRadius: 14,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
      marginTop: 10,
    },
    addButton: {
      height: 46,
      borderRadius: 12,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    addButtonText: {
      color: "#E0E0E0",
      fontWeight: "800",
    },
    counter: {
      color: "#7FE7FF",
      fontSize: 12,
      fontWeight: "600",
    },
    mediaCard: {
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    mediaCardActive: {
      opacity: 0.85,
    },
    mediaPreview: {
      width: "100%",
      height: "100%",
      backgroundColor: "#0B0E18",
    },
    videoPreview: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#7C5CFF",
    },
    videoText: {
      color: "#0B0E18",
      fontWeight: "700",
      fontSize: 12,
    },
    removeButton: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(124, 92, 255, 0.9)",
      alignItems: "center",
      justifyContent: "center",
    },
    mediaBadge: {
      position: "absolute",
      top: 6,
      left: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(11, 14, 24, 0.7)",
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    dragHint: {
      position: "absolute",
      left: 6,
      bottom: 6,
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      backgroundColor: "rgba(124, 92, 255, 0.85)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    dragHintText: {
      color: "#E0E0E0",
      fontSize: 11,
      fontWeight: "700",
    },
    emptyMidia: {
      color: "#7FE7FF",
      fontSize: 13,
    },
    label: {
      color: "#E0E0E0",
      fontWeight: "700",
    },
    input: {
      minHeight: 140,
      borderRadius: 10,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      color: "#E0E0E0",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
    },
    saveBorder: {
      borderRadius: 14,
      padding: 1.5,
      shadowColor: "#74D3FF",
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 7,
      marginTop: 8,
    },
    saveButton: {
      height: 48,
      borderRadius: 12,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonText: {
      color: "#E0E0E0",
      fontWeight: "800",
      fontSize: 16,
    },
    deletePostButton: {
      height: 46,
      borderRadius: 12,
      backgroundColor: "rgba(255, 75, 216, 0.25)",
      borderWidth: 1,
      borderColor: "rgba(255, 75, 216, 0.7)",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    deletePostButtonText: {
      color: "#FF4BD8",
      fontWeight: "800",
      fontSize: 16,
    },
    sectionTitle: {
      color: "#E0E0E0",
      fontWeight: "700",
      fontSize: 16,
      marginTop: 8,
    },
    emptyComments: {
      color: "#7FE7FF",
      fontSize: 13,
    },
    commentCard: {
      borderRadius: 10,
      padding: 10,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      gap: 6,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
    },
    commentHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    commentAuthor: {
      color: "#E0E0E0",
      fontWeight: "700",
      fontSize: 13,
      flex: 1,
    },
    commentText: {
      color: "#E0E0E0",
      fontSize: 14,
    },
    commentDeleteButton: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: "rgba(255, 75, 216, 0.2)",
      borderWidth: 1,
      borderColor: "rgba(255, 75, 216, 0.6)",
    },
    commentDeleteText: {
      color: "#FF4BD8",
      fontWeight: "800",
      fontSize: 12,
    },
    disabled: {
      opacity: 0.7,
    },
    error: {
      color: "#F43F5E",
      fontWeight: "600",
    },
    gridRow: {
      gap: 6,
      marginBottom: 6,
      justifyContent: "space-between",
    },
  });
}
