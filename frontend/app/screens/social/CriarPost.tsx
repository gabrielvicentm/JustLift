import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createPost, uploadMediaToR2 } from "@/app/features/social/service";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

const MAX_MIDIAS = 9;

type PostMedia = {
  id: string;
  uri: string;
  type: "image" | "video";
  fileName: string;
  mimeType: string;
  fileSize?: number;
};

export default function CriarPostScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [descricao, setDescricao] = useState("");
  const [midias, setMidias] = useState<PostMedia[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const addNovasMidias = (assets: ImagePicker.ImagePickerAsset[]) => {
    const novasMidias: PostMedia[] = assets.map((asset, index) => ({
      id: `${asset.assetId ?? asset.uri}-${Date.now()}-${index}`,
      uri: asset.uri,
      type: asset.type === "video" ? "video" : "image",
      fileName: asset.fileName ?? `midia-${Date.now()}-${index}`,
      mimeType: asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      fileSize: asset.fileSize,
    }));

    setMidias((current) => {
      const merged = [...current, ...novasMidias];
      return merged.slice(0, MAX_MIDIAS);
    });
  };

  const handleEscolherDaGaleria = async () => {
    if (midias.length >= MAX_MIDIAS) {
      Alert.alert("Limite atingido", `Cada post permite no máximo ${MAX_MIDIAS} mídias.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize a galeria para selecionar mídias.");
      return;
    }

    const maxSelectable = MAX_MIDIAS - midias.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: maxSelectable,
      mediaTypes: ["images", "videos"],
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    addNovasMidias(result.assets);
  };

  const handleAbrirCamera = async () => {
    if (midias.length >= MAX_MIDIAS) {
      Alert.alert("Limite atingido", `Cada post permite no máximo ${MAX_MIDIAS} mídias.`);
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize a câmera para capturar mídias.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    addNovasMidias(result.assets);
  };

  const handleEscolherMidias = () => {
    Alert.alert("Adicionar mídia", "Escolha uma opção", [
      { text: "Galeria", onPress: handleEscolherDaGaleria },
      { text: "Câmera", onPress: handleAbrirCamera },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleRemoverMidia = (id: string) => {
    setMidias((current) => current.filter((item) => item.id !== id));
  };

  const handlePublicar = async () => {
    setError("");
    setSuccess("");

    if (!descricao.trim() && midias.length === 0) {
      setError("Adicione uma descricao ou pelo menos uma midia.");
      return;
    }

    setSending(true);
    try {
      const uploadedMedia = await Promise.all(
        midias.map(async (item) => {
          const uploaded = await uploadMediaToR2(item.uri, item.fileName, item.mimeType, item.fileSize);
          return {
            type: item.type,
            url: uploaded.url,
            key: uploaded.key,
          } as const;
        }),
      );

      await createPost({
        descricao: descricao.trim(),
        midias: uploadedMedia,
      });

      setDescricao("");
      setMidias([]);
      setSuccess("Post publicado com sucesso.");
      Alert.alert("Sucesso", "Seu post foi publicado.");
    } finally {
      setSending(false);
    }
  };

  const handlePublicarComTratamento = async () => {
    try {
      await handlePublicar();
    } catch (err) {
      setError(getApiErrorMessage(err, "publicar post"));
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Criar post</Text>
        <Text style={styles.subtitle}>Adicione imagens e vídeos (máximo de 9).</Text>
      </View>

      <Pressable style={styles.addMediaButton} onPress={handleEscolherMidias} disabled={sending}>
        <Ionicons name="images-outline" size={18} color={theme.colors.buttonText} />
        <Text style={styles.addMediaButtonText}>Inserir mídia</Text>
      </Pressable>

      <Text style={styles.counterText}>
        {midias.length}/{MAX_MIDIAS} mídias selecionadas
      </Text>

      {midias.length > 0 ? (
        <FlatList
          data={midias}
          keyExtractor={(item) => item.id}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <View style={styles.mediaCard}>
              {item.type === "image" ? (
                <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
              ) : (
                <View style={styles.videoPlaceholder}>
                  <Ionicons name="videocam" size={22} color={theme.colors.buttonText} />
                  <Text style={styles.videoText}>Vídeo</Text>
                </View>
              )}

              <Pressable style={styles.removeButton} onPress={() => handleRemoverMidia(item.id)}>
                <Ionicons name="close" size={14} color={theme.colors.buttonText} />
              </Pressable>
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="image-outline" size={20} color={theme.colors.mutedText} />
          <Text style={styles.emptyStateText}>Nenhuma mídia selecionada.</Text>
        </View>
      )}

      <Text style={styles.label}>Descrição</Text>
      <TextInput
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Escreva algo sobre seu post..."
        placeholderTextColor={theme.colors.mutedText}
        style={styles.descriptionInput}
        multiline
        textAlignVertical="top"
        editable={!sending}
        maxLength={1000}
      />

      <Pressable
        style={[styles.publishButton, sending && styles.buttonDisabled]}
        onPress={handlePublicarComTratamento}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator color={theme.colors.buttonText} />
        ) : (
          <Text style={styles.publishButtonText}>Publicar post</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <Pressable style={styles.backButton} onPress={() => router.back()} disabled={sending}>
        <Text style={styles.backButtonText}>Voltar</Text>
      </Pressable>
    </ScrollView>
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
      paddingBottom: 26,
    },
    header: {
      gap: 4,
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
    addMediaButton: {
      height: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      backgroundColor: theme.colors.button,
    },
    addMediaButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    counterText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    grid: {
      gap: 8,
    },
    gridRow: {
      gap: 8,
    },
    mediaCard: {
      flex: 1,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      minHeight: 112,
      maxWidth: "32%",
    },
    mediaPreview: {
      width: "100%",
      height: 112,
      resizeMode: "cover",
    },
    videoPlaceholder: {
      width: "100%",
      height: 112,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    videoText: {
      color: theme.colors.buttonText,
      fontSize: 12,
      fontWeight: "700",
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
    emptyState: {
      minHeight: 78,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: "dashed",
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: theme.colors.surface,
    },
    emptyStateText: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    label: {
      color: theme.colors.text,
      fontWeight: "600",
      marginTop: 2,
    },
    descriptionInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 140,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
    },
    publishButton: {
      height: 46,
      borderRadius: 10,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
    },
    publishButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 16,
    },
    backButton: {
      height: 46,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    error: {
      color: theme.colors.error,
      fontWeight: "600",
    },
    success: {
      color: theme.colors.success,
      fontWeight: "600",
    },
  });
}
