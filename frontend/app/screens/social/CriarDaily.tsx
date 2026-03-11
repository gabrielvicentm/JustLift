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
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { uploadMediaToR2 } from "@/app/features/social/service";
import { createDailyBatch } from "@/app/features/daily/service";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";

const MAX_DAILY_MIDIAS = 20;
const MAX_DAILY_VIDEO_DURATION_SECONDS = 15;

type DailyMedia = {
  id: string;
  uri: string;
  type: "image" | "video";
  fileName: string;
  mimeType: string;
  fileSize?: number;
  durationMs?: number | null;
};

export default function CriarDailyScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [midias, setMidias] = useState<DailyMedia[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const addNovasMidias = (assets: ImagePicker.ImagePickerAsset[]) => {
    const novasMidias: DailyMedia[] = [];
    let teveVideoCortado = false;

    for (const [index, asset] of assets.entries()) {
      const isVideo = asset.type === "video";
      const durationMs = isVideo ? asset.duration ?? null : null;
      const durationSeconds = durationMs ? durationMs / 1000 : 0;

      if (isVideo && durationSeconds > MAX_DAILY_VIDEO_DURATION_SECONDS) {
        teveVideoCortado = true;
      }

      novasMidias.push({
        id: `${asset.assetId ?? asset.uri}-${Date.now()}-${index}`,
        uri: asset.uri,
        type: isVideo ? "video" : "image",
        fileName: asset.fileName ?? `daily-${Date.now()}-${index}`,
        mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
        fileSize: asset.fileSize,
        durationMs,
      });
    }

    setMidias((current) => [...current, ...novasMidias].slice(0, MAX_DAILY_MIDIAS));

    if (teveVideoCortado) {
      Alert.alert(
        "Video ajustado",
        `Videos com mais de ${MAX_DAILY_VIDEO_DURATION_SECONDS}s vao usar apenas os primeiros ${MAX_DAILY_VIDEO_DURATION_SECONDS}s no Daily.`,
      );
    }
  };

  const handleEscolherDaGaleria = async () => {
    if (midias.length >= MAX_DAILY_MIDIAS) {
      Alert.alert("Limite atingido", `Cada envio permite no maximo ${MAX_DAILY_MIDIAS} midias.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Autorize a galeria para selecionar midias.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: MAX_DAILY_MIDIAS - midias.length,
      mediaTypes: ["images", "videos"],
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    addNovasMidias(result.assets);
  };

  const handleAbrirCamera = async () => {
    if (midias.length >= MAX_DAILY_MIDIAS) {
      Alert.alert("Limite atingido", `Cada envio permite no maximo ${MAX_DAILY_MIDIAS} midias.`);
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
      videoMaxDuration: MAX_DAILY_VIDEO_DURATION_SECONDS,
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
    setMidias((current) => current.filter((item) => item.id !== id));
  };

  const handlePublicar = async () => {
    if (midias.length === 0) {
      setError("Selecione pelo menos uma midia para publicar no Daily.");
      return;
    }

    setSending(true);
    setError("");
    setSuccess("");

    try {
      const uploadedMedia = await Promise.all(
        midias.map(async (item) => {
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

      setMidias([]);
      setSuccess("Daily publicado com sucesso.");
      Alert.alert("Sucesso", "Seu Daily foi publicado.");
    } finally {
      setSending(false);
    }
  };

  const handlePublicarComTratamento = async () => {
    try {
      await handlePublicar();
    } catch (err) {
      setError(getApiErrorMessage(err, "publicar Daily"));
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Criar Daily</Text>
        <Text style={styles.subtitle}>Foto ou video de ate 15 segundos. Some da exibicao em 24h.</Text>
      </View>

      <Pressable style={styles.addMediaButton} onPress={handleEscolherMidias} disabled={sending}>
        <Ionicons name="images-outline" size={18} color={theme.colors.buttonText} />
        <Text style={styles.addMediaButtonText}>Inserir midia</Text>
      </Pressable>

      <Text style={styles.counterText}>
        {midias.length}/{MAX_DAILY_MIDIAS} midias selecionadas
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
        <View style={styles.emptyState}>
          <Ionicons name="image-outline" size={20} color={theme.colors.mutedText} />
          <Text style={styles.emptyStateText}>Nenhuma midia selecionada.</Text>
        </View>
      )}

      <Pressable
        style={[styles.publishButton, sending && styles.buttonDisabled]}
        onPress={handlePublicarComTratamento}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator color={theme.colors.buttonText} />
        ) : (
          <Text style={styles.publishButtonText}>Publicar Daily</Text>
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
