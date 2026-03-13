import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createPost, uploadMediaToR2 } from "@/app/features/social/service";
import { createDailyBatch } from "@/app/features/daily/service";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

const MAX_POST_MIDIAS = 9;
const MAX_DAILY_MIDIAS = 20;
const MAX_DAILY_VIDEO_DURATION_SECONDS = 15;

type LocalMedia = {
  id: string;
  uri: string;
  type: "image" | "video";
  fileName: string;
  mimeType: string;
  fileSize?: number;
  durationMs?: number | null;
};

export default function CriarPostScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [abaAtiva, setAbaAtiva] = useState<"post" | "daily">("post");
  const [descricao, setDescricao] = useState("");
  const [midiasPost, setMidiasPost] = useState<LocalMedia[]>([]);
  const [midiasDaily, setMidiasDaily] = useState<LocalMedia[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const midiasSelecionadas = abaAtiva === "post" ? midiasPost : midiasDaily;
  const limiteAtual = abaAtiva === "post" ? MAX_POST_MIDIAS : MAX_DAILY_MIDIAS;

  const addNovasMidias = (assets: ImagePicker.ImagePickerAsset[]) => {
    const novasMidias: LocalMedia[] = [];
    let teveVideoCortado = false;

    for (const [index, asset] of assets.entries()) {
      const isVideo = asset.type === "video";
      const durationMs = isVideo ? asset.duration ?? null : null;
      const durationSeconds = durationMs ? durationMs / 1000 : 0;

      if (abaAtiva === "daily" && isVideo && durationSeconds > MAX_DAILY_VIDEO_DURATION_SECONDS) {
        teveVideoCortado = true;
      }

      novasMidias.push({
        id: `${asset.assetId ?? asset.uri}-${Date.now()}-${index}`,
        uri: asset.uri,
        type: isVideo ? "video" : "image",
        fileName: asset.fileName ?? `midia-${Date.now()}-${index}`,
        mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
        fileSize: asset.fileSize,
        durationMs,
      });
    }

    if (abaAtiva === "post") {
      setMidiasPost((current) => [...current, ...novasMidias].slice(0, MAX_POST_MIDIAS));
      return;
    }

    setMidiasDaily((current) => [...current, ...novasMidias].slice(0, MAX_DAILY_MIDIAS));

    if (teveVideoCortado) {
      Alert.alert(
        "Video ajustado",
        `Videos com mais de ${MAX_DAILY_VIDEO_DURATION_SECONDS}s vao usar apenas os primeiros ${MAX_DAILY_VIDEO_DURATION_SECONDS}s no Daily.`,
      );
    }
  };

  const handleEscolherDaGaleria = async () => {
    if (midiasSelecionadas.length >= limiteAtual) {
      Alert.alert("Limite atingido", `Esta aba permite no maximo ${limiteAtual} midias.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Autorize a galeria para selecionar midias.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: limiteAtual - midiasSelecionadas.length,
      mediaTypes: ["images", "videos"],
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    addNovasMidias(result.assets);
  };

  const handleAbrirCamera = async () => {
    if (midiasSelecionadas.length >= limiteAtual) {
      Alert.alert("Limite atingido", `Esta aba permite no maximo ${limiteAtual} midias.`);
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Autorize a camera para capturar midias.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.9,
      videoMaxDuration: abaAtiva === "daily" ? MAX_DAILY_VIDEO_DURATION_SECONDS : undefined,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    addNovasMidias(result.assets);
  };

  const handleEscolherMidias = () => {
    Alert.alert("Adicionar midia", "Escolha uma opcao", [
      { text: "Galeria", onPress: handleEscolherDaGaleria },
      { text: "Camera", onPress: handleAbrirCamera },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleRemoverMidia = (id: string) => {
    if (abaAtiva === "post") {
      setMidiasPost((current) => current.filter((item) => item.id !== id));
      return;
    }
    setMidiasDaily((current) => current.filter((item) => item.id !== id));
  };

  const handlePublicarPost = async () => {
    if (!descricao.trim() && midiasPost.length === 0) {
      setError("Adicione uma descricao ou pelo menos uma midia.");
      return;
    }

    const uploadedMedia = await Promise.all(
      midiasPost.map(async (item) => {
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
    setMidiasPost([]);
    setSuccess("Post publicado com sucesso.");
    Alert.alert("Sucesso", "Seu post foi publicado.");
  };

  const handlePublicarDaily = async () => {
    if (midiasDaily.length === 0) {
      setError("Selecione pelo menos uma midia para publicar no Daily.");
      return;
    }

    const uploadedMedia = await Promise.all(
      midiasDaily.map(async (item) => {
        const uploaded = await uploadMediaToR2(item.uri, item.fileName, item.mimeType, item.fileSize);
        return {
          type: item.type,
          url: uploaded.url,
          key: uploaded.key,
          duration_seconds:
            item.type === "video"
              ? Math.max(1, Math.min(MAX_DAILY_VIDEO_DURATION_SECONDS, Math.ceil((item.durationMs ?? 15000) / 1000)))
              : MAX_DAILY_VIDEO_DURATION_SECONDS,
        } as const;
      }),
    );

    await createDailyBatch({ midias: uploadedMedia });
    setMidiasDaily([]);
    setSuccess("Daily publicado com sucesso.");
    Alert.alert("Sucesso", "Seu Daily foi publicado.");
  };

  const handlePublicarComTratamento = async () => {
    setError("");
    setSuccess("");
    setSending(true);

    try {
      if (abaAtiva === "post") {
        await handlePublicarPost();
      } else {
        await handlePublicarDaily();
      }
    } catch (err) {
      setError(getApiErrorMessage(err, abaAtiva === "post" ? "publicar post" : "publicar Daily"));
    } finally {
      setSending(false);
    }
  };

  const trocarAba = (aba: "post" | "daily") => {
    setAbaAtiva(aba);
    setError("");
    setSuccess("");
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Criar conteudo</Text>
        <Text style={styles.subtitle}>
          {abaAtiva === "post"
            ? "Adicione imagens e videos para seu post."
            : "Daily: foto/video de ate 15 segundos e exibicao por 24 horas."}
        </Text>
      </View>

      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tabButton, abaAtiva === "post" && styles.tabButtonActive]}
          onPress={() => trocarAba("post")}
          disabled={sending}
        >
          <Text style={[styles.tabButtonText, abaAtiva === "post" && styles.tabButtonTextActive]}>Post</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, abaAtiva === "daily" && styles.tabButtonActive]}
          onPress={() => trocarAba("daily")}
          disabled={sending}
        >
          <Text style={[styles.tabButtonText, abaAtiva === "daily" && styles.tabButtonTextActive]}>Daily</Text>
        </Pressable>
      </View>

      <Pressable style={styles.addMediaButton} onPress={handleEscolherMidias} disabled={sending}>
        <Ionicons name="images-outline" size={18} color={theme.colors.buttonText} />
        <Text style={styles.addMediaButtonText}>Inserir midia</Text>
      </Pressable>

      <Text style={styles.counterText}>
        {midiasSelecionadas.length}/{limiteAtual} midias selecionadas
      </Text>

      {midiasSelecionadas.length > 0 ? (
        <FlatList
          data={midiasSelecionadas}
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
                  <Text style={styles.videoText}>Video</Text>
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
          <Text style={styles.emptyStateText}>Nenhuma midia selecionada.</Text>
        </View>
      )}

      {abaAtiva === "post" ? (
        <>
          <Text style={styles.label}>Descricao</Text>
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
        </>
      ) : null}

      <Pressable
        style={[styles.publishButton, sending && styles.buttonDisabled]}
        onPress={handlePublicarComTratamento}
        disabled={sending}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Criar post</Text>
          <Text style={styles.subtitle}>Adicione imagens e videos (maximo de 9).</Text>
        </View>

        <Pressable style={styles.addMediaButton} onPress={handleEscolherMidias} disabled={sending}>
          <Ionicons name="images-outline" size={18} color={theme.colors.buttonText} />
          <Text style={styles.addMediaButtonText}>Inserir midia</Text>
        </Pressable>

        <Text style={styles.counterText}>
          {midias.length}/{MAX_MIDIAS} midias selecionadas
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
                    <Text style={styles.videoText}>Video</Text>
                  </View>
                )}

                <Pressable style={styles.removeButton} onPress={() => handleRemoverMidia(item.id)}>
                  <Ionicons name="close" size={14} color={theme.colors.buttonText} />
                </Pressable>
              </View>
            )}
          />
        ) : (
          <Text style={styles.publishButtonText}>{abaAtiva === "post" ? "Publicar post" : "Publicar Daily"}</Text>
        )}

        <Text style={styles.label}>Descricao</Text>
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
    tabsRow: {
      flexDirection: "row",
      gap: 8,
    },
    tabButton: {
      flex: 1,
      minHeight: 42,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.button,
      borderColor: theme.colors.button,
    },
    tabButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    tabButtonTextActive: {
      color: theme.colors.buttonText,
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
      marginTop: 10,
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
