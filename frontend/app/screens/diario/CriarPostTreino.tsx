import { useCallback, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { createTreinoPost, fetchTreinoPostPreview, uploadMediaToR2 } from "@/app/features/social/service";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { api } from "@/app/config/api";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useI18n } from "@/providers/I18nProvider";
import type { TreinoResumo } from "@/app/features/social/types";
import type { AppTheme } from "@/theme/theme";

const MAX_MIDIAS = 9;
const NOISE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAJ0lEQVR4Ae3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAA4G8G9o0AAaI31xkAAAAASUVORK5CYII=";

const PROGRESS_GRADIENT = ["#5BE7FF", "#7C5CFF", "#FF4BD8"] as const;
const PREMIUM_AD_FLAG_KEY = "show_premium_modal_after_workout_post";

type PremiumStatusResponse = {
  isPremium: boolean;
  premiumUpdatedAt?: string | null;
  message?: string;
};

type PostMedia = {
  id: string;
  uri: string;
  type: "image" | "video";
  fileName: string;
  mimeType: string;
  fileSize?: number;
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

function formatDuration(totalSeconds: number | null) {
  if (!totalSeconds || totalSeconds <= 0) return "0min";
  const totalMinutes = Math.floor(totalSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

export default function CriarPostTreinoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ treinoId?: string }>();
  const treinoId = Number(params.treinoId);
  const { theme } = useAppTheme();
  const { language } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [descricao, setDescricao] = useState("");
  const [midias, setMidias] = useState<PostMedia[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resumo, setResumo] = useState<TreinoResumo | null>(null);
  const [loadingResumo, setLoadingResumo] = useState(true);

  const carregarResumo = useCallback(async () => {
    if (!Number.isInteger(treinoId) || treinoId <= 0) {
      setError("Treino invalido para compartilhamento.");
      setResumo(null);
      setLoadingResumo(false);
      return;
    }

    setLoadingResumo(true);
    setError("");

    try {
      const data = await fetchTreinoPostPreview(treinoId, language === "en" ? "en" : "pt");
      setResumo(data);
    } catch (err) {
      setResumo(null);
      setError(getApiErrorMessage(err, "carregar resumo do treino"));
    } finally {
      setLoadingResumo(false);
    }
  }, [language, treinoId]);

  useFocusEffect(
    useCallback(() => {
      carregarResumo().catch(() => undefined);
    }, [carregarResumo]),
  );

  const addNovasMidias = (assets: ImagePicker.ImagePickerAsset[]) => {
    const novasMidias: PostMedia[] = assets.map((asset, index) => ({
      id: `${asset.assetId ?? asset.uri}-${Date.now()}-${index}`,
      uri: asset.uri,
      type: "image",
      fileName: asset.fileName ?? `midia-${Date.now()}-${index}`,
      mimeType: asset.mimeType ?? "image/jpeg",
      fileSize: asset.fileSize,
    }));

    setMidias((current) => {
      const merged = [...current, ...novasMidias];
      return merged.slice(0, MAX_MIDIAS);
    });
  };

  const handleEscolherDaGaleria = async () => {
    if (midias.length >= MAX_MIDIAS) {
      Alert.alert("Limite atingido", `Cada post permite no maximo ${MAX_MIDIAS} midias.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Autorize a galeria para selecionar midias.");
      return;
    }

    const maxSelectable = MAX_MIDIAS - midias.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: maxSelectable,
      mediaTypes: ["images"],
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    addNovasMidias(result.assets);
  };

  const handleAbrirCamera = async () => {
    if (midias.length >= MAX_MIDIAS) {
      Alert.alert("Limite atingido", `Cada post permite no maximo ${MAX_MIDIAS} midias.`);
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Autorize a camera para capturar midias.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
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
    setError("");
    setSuccess("");

    if (!descricao.trim() && midias.length === 0) {
      setError("Adicione uma descricao ou pelo menos uma midia.");
      return;
    }

    if (!Number.isInteger(treinoId) || treinoId <= 0) {
      setError("Treino invalido para compartilhamento.");
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

      await createTreinoPost({
        treinoId,
        descricao: descricao.trim(),
        midias: uploadedMedia,
      });

      setDescricao("");
      setMidias([]);
      setSuccess("Post de treino publicado com sucesso.");
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (accessToken) {
        try {
          const response = await api.get<PremiumStatusResponse>("/premium/status", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!response.data?.isPremium) {
            await AsyncStorage.setItem(PREMIUM_AD_FLAG_KEY, "1");
          }
        } catch {
          await AsyncStorage.setItem(PREMIUM_AD_FLAG_KEY, "1");
        }
      }
      router.replace("/(tabs)/perfil_tab");
    } finally {
      setSending(false);
    }
  };

  const handlePublicarComTratamento = async () => {
    try {
      await handlePublicar();
    } catch (err) {
      setError(getApiErrorMessage(err, "publicar treino"));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Compartilhar treino</Text>
          <Text style={styles.subtitle}>Adicione imagens e um resumo do seu treino.</Text>
        </View>

        {loadingResumo ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={theme.colors.text} />
            <Text style={styles.stateText}>Carregando resumo...</Text>
          </View>
        ) : resumo ? (
          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.summaryBorder}
          >
            <View style={styles.summaryInner}>
              <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryTitle}>Resumo do treino</Text>
                  <Text style={styles.summaryDate}>{formatDate(resumo.data)}</Text>
                </View>

                <View style={styles.summaryMetrics}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Duracao</Text>
                    <Text style={styles.metricValue}>{formatDuration(resumo.duracao ?? 0)}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Peso total</Text>
                    <Text style={styles.metricValue}>{Number(resumo.peso_total ?? 0).toFixed(1)}kg</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Series</Text>
                    <Text style={styles.metricValue}>{resumo.total_series ?? 0}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Exercicios</Text>
                    <Text style={styles.metricValue}>{resumo.total_exercicios ?? resumo.exercicios?.length ?? 0}</Text>
                  </View>
                </View>

                {resumo.exercicios && resumo.exercicios.length > 0 ? (
                  <View style={styles.exerciseList}>
                    {resumo.exercicios.slice(0, 4).map((exercicio) => (
                      <View key={exercicio.exercicio_treino_id} style={styles.exerciseRow}>
                        {exercicio.imagem_url ? (
                          <Image source={{ uri: exercicio.imagem_url }} style={styles.exerciseImage} />
                        ) : (
                          <View style={[styles.exerciseImage, styles.imagePlaceholder]}>
                            <Text style={styles.imagePlaceholderText}>IMG</Text>
                          </View>
                        )}
                        <Text style={styles.exerciseItem} numberOfLines={2}>
                          {exercicio.nome}
                        </Text>
                      </View>
                    ))}
                    {resumo.exercicios.length > 4 ? (
                      <Text style={styles.exerciseMore}>+{resumo.exercicios.length - 4} exercicios</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.stateContainer}>
            <Text style={styles.errorText}>{error || "Treino nao encontrado."}</Text>
          </View>
        )}

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
                <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
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

        <Text style={styles.label}>Descricao</Text>
        <TextInput
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Compartilhe como foi seu treino..."
          placeholderTextColor={theme.colors.mutedText}
          style={styles.descriptionInput}
          multiline
          textAlignVertical="top"
          editable={!sending}
          maxLength={1000}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}

        <Pressable
          style={[styles.publishButton, sending && styles.publishButtonDisabled]}
          onPress={handlePublicarComTratamento}
          disabled={sending}
        >
          {sending ? <ActivityIndicator color={theme.colors.buttonText} /> : <Text style={styles.publishButtonText}>Publicar treino</Text>}
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={() => router.back()} disabled={sending}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
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
      gap: 16,
      paddingBottom: 40,
    },
    header: {
      gap: 6,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.mutedText,
    },
    stateContainer: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      gap: 8,
    },
    stateText: {
      color: theme.colors.mutedText,
    },
    summaryBorder: {
      borderRadius: 18,
      padding: 1.5,
      shadowColor: "#FF4BD8",
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    summaryInner: {
      borderRadius: 16,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      overflow: "hidden",
    },
    noiseOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.035,
    },
    summaryCard: {
      borderRadius: 16,
      padding: 16,
      gap: 12,
      backgroundColor: "transparent",
    },
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    summaryDate: {
      fontSize: 13,
      color: theme.colors.mutedText,
    },
    summaryMetrics: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    metricItem: {
      minWidth: "45%",
      backgroundColor: "rgba(2, 6, 23, 0.6)",
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.25)",
    },
    metricLabel: {
      fontSize: 12,
      color: theme.colors.mutedText,
    },
    metricValue: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    exerciseList: {
      gap: 8,
    },
    exerciseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    exerciseImage: {
      width: 46,
      height: 46,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
    },
    imagePlaceholder: {
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.25)",
      alignItems: "center",
      justifyContent: "center",
    },
    imagePlaceholderText: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 11,
    },
    exerciseItem: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "600",
      flex: 1,
    },
    exerciseMore: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    addMediaButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.button,
      borderRadius: 10,
      paddingVertical: 12,
    },
    addMediaButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "600",
    },
    counterText: {
      fontSize: 12,
      color: theme.colors.mutedText,
    },
    grid: {
      gap: 8,
    },
    gridRow: {
      justifyContent: "space-between",
    },
    mediaCard: {
      width: "32%",
      aspectRatio: 1,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.colors.inputBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mediaPreview: {
      width: "100%",
      height: "100%",
    },
    removeButton: {
      position: "absolute",
      top: 6,
      right: 6,
      backgroundColor: theme.colors.button,
      borderRadius: 12,
      padding: 4,
    },
    emptyState: {
      alignItems: "center",
      gap: 6,
      paddingVertical: 16,
    },
    emptyStateText: {
      color: theme.colors.mutedText,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    descriptionInput: {
      minHeight: 110,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      color: theme.colors.text,
      backgroundColor: theme.colors.inputBackground,
    },
    publishButton: {
      backgroundColor: theme.colors.button,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    publishButtonDisabled: {
      opacity: 0.7,
    },
    publishButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    cancelButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 12,
      alignItems: "center",
    },
    cancelButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 13,
    },
    successText: {
      color: theme.colors.success,
      fontSize: 13,
    },
  });
}
