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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { fetchMyProfile, getApiErrorMessage } from "@/app/features/profile/service";
import { fetchPostById, updatePost, uploadMediaToR2 } from "@/app/features/social/service";
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

  const [post, setPost] = useState<PostDetail | null>(null);
  const [descricao, setDescricao] = useState("");
  const [midias, setMidias] = useState<EditableMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const renderMediaItem = ({ item, drag, isActive }: RenderItemParams<EditableMedia>) => (
    <Pressable
      onLongPress={drag}
      disabled={saving}
      style={[styles.mediaCard, isActive && styles.mediaCardActive]}
    >
      {item.type === "image" ? (
        <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
      ) : (
        <View style={[styles.mediaPreview, styles.videoPreview]}>
          <Text style={styles.videoText}>Video</Text>
        </View>
      )}

      <Pressable style={styles.removeButton} onPress={() => handleRemoveMedia(item.id)} disabled={saving}>
        <Ionicons name="close" size={14} color={theme.colors.buttonText} />
      </Pressable>

      <View style={styles.dragHint}>
        <Ionicons name="reorder-three-outline" size={16} color={theme.colors.buttonText} />
        <Text style={styles.dragHintText}>Segure e arraste</Text>
      </View>
    </Pressable>
  );

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
        activationDistance={14}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        ListHeaderComponent={
          <>
            <View style={styles.topRow}>
              <Pressable style={styles.backButton} onPress={() => router.back()} disabled={saving}>
                <Text style={styles.backButtonText}>Voltar</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>Editar post</Text>
            <Text style={styles.subtitle}>Altere descricao e quantidade de midias (maximo de 9).</Text>

            <Pressable style={styles.addButton} onPress={handleAddMedia} disabled={saving || midias.length >= MAX_MIDIAS}>
              <Ionicons name="images-outline" size={18} color={theme.colors.buttonText} />
              <Text style={styles.addButtonText}>Adicionar midia</Text>
            </Pressable>

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

            <Pressable style={[styles.saveButton, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={theme.colors.buttonText} /> : <Text style={styles.saveButtonText}>Salvar alteracoes</Text>}
            </Pressable>
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
      backgroundColor: theme.colors.background,
    },
    container: {
      padding: 16,
      gap: 10,
      paddingBottom: 44,
    },
    center: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      gap: 8,
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
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    addButton: {
      height: 44,
      borderRadius: 10,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    addButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    counter: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    mediaCard: {
      width: "100%",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
      marginBottom: 8,
    },
    mediaCardActive: {
      opacity: 0.85,
    },
    mediaPreview: {
      width: "100%",
      height: 180,
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
      fontSize: 12,
    },
    removeButton: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "#00000099",
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
      backgroundColor: "#00000099",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    dragHintText: {
      color: theme.colors.buttonText,
      fontSize: 11,
      fontWeight: "700",
    },
    emptyMidia: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    label: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    input: {
      minHeight: 140,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    saveButton: {
      height: 46,
      borderRadius: 10,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 16,
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
