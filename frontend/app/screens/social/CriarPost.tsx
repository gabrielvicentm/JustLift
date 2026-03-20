import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { LinearGradient } from "expo-linear-gradient";
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

type PermissionKind = "gallery" | "camera";
type PermissionState = "checking" | "granted" | "denied";

export default function CriarPostScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [abaAtiva, setAbaAtiva] = useState<"post" | "daily">("post");
  const [descricao, setDescricao] = useState("");
  const [midiasPost, setMidiasPost] = useState<LocalMedia[]>([]);
  const [midiasDaily, setMidiasDaily] = useState<LocalMedia[]>([]);
  const [midiaAtivaId, setMidiaAtivaId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [galleryPermission, setGalleryPermission] = useState<PermissionState>("checking");
  const [cameraPermission, setCameraPermission] = useState<PermissionState>("checking");

  const midiasSelecionadas = abaAtiva === "post" ? midiasPost : midiasDaily;
  const limiteAtual = abaAtiva === "post" ? MAX_POST_MIDIAS : MAX_DAILY_MIDIAS;
  const midiaAtiva =
    midiasSelecionadas.find((item) => item.id === midiaAtivaId) ?? midiasSelecionadas[0] ?? null;

  useEffect(() => {
    let active = true;

    async function syncPermissions() {
      try {
        const [gallery, camera] = await Promise.all([
          ImagePicker.requestMediaLibraryPermissionsAsync(),
          ImagePicker.requestCameraPermissionsAsync(),
        ]);

        if (!active) {
          return;
        }

        setGalleryPermission(gallery.granted ? "granted" : "denied");
        setCameraPermission(camera.granted ? "granted" : "denied");
      } catch {
        if (!active) {
          return;
        }

        setGalleryPermission("denied");
        setCameraPermission("denied");
      }
    }

    syncPermissions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!midiasSelecionadas.length) {
      setMidiaAtivaId(null);
      return;
    }

    if (!midiaAtivaId || !midiasSelecionadas.some((item) => item.id === midiaAtivaId)) {
      setMidiaAtivaId(midiasSelecionadas[0].id);
    }
  }, [abaAtiva, midiaAtivaId, midiasSelecionadas]);

  const atualizarPermissao = (kind: PermissionKind, granted: boolean) => {
    if (kind === "gallery") {
      setGalleryPermission(granted ? "granted" : "denied");
      return;
    }

    setCameraPermission(granted ? "granted" : "denied");
  };

  const abrirConfiguracoes = () => {
    Linking.openSettings().catch(() => {
      Alert.alert("Permissao bloqueada", "Abra as configuracoes do aparelho e libere o acesso manualmente.");
    });
  };

  const garantirPermissao = async (kind: PermissionKind) => {
    const permission =
      kind === "gallery"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();

    atualizarPermissao(kind, permission.granted);

    if (permission.granted) {
      return true;
    }

    const label = kind === "gallery" ? "galeria" : "camera";

    if (permission.canAskAgain === false) {
      Alert.alert(
        "Permissao bloqueada",
        `Ative a ${label} nas configuracoes para continuar.`,
        [
          { text: "Agora nao", style: "cancel" },
          { text: "Abrir configuracoes", onPress: abrirConfiguracoes },
        ],
      );
      return false;
    }

    Alert.alert("Permissao necessaria", `Autorize a ${label} para continuar.`);
    return false;
  };

  const addNovasMidias = (assets: ImagePicker.ImagePickerAsset[]) => {
    const novasMidias: LocalMedia[] = [];
    let teveVideoCortado = false;
    const now = Date.now();

    for (const [index, asset] of assets.entries()) {
      const isVideo = asset.type === "video";
      const durationMs = isVideo ? asset.duration ?? null : null;
      const durationSeconds = durationMs ? durationMs / 1000 : 0;

      if (abaAtiva === "daily" && isVideo && durationSeconds > MAX_DAILY_VIDEO_DURATION_SECONDS) {
        teveVideoCortado = true;
      }

      novasMidias.push({
        id: `${asset.assetId ?? asset.uri}-${now}-${index}`,
        uri: asset.uri,
        type: isVideo ? "video" : "image",
        fileName: asset.fileName ?? `midia-${now}-${index}`,
        mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
        fileSize: asset.fileSize,
        durationMs,
      });
    }

    if (abaAtiva === "post") {
      setMidiasPost((current) => [...current, ...novasMidias].slice(0, MAX_POST_MIDIAS));
    } else {
      setMidiasDaily((current) => [...current, ...novasMidias].slice(0, MAX_DAILY_MIDIAS));
    }

    if (novasMidias[0]) {
      setMidiaAtivaId(novasMidias[0].id);
    }

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

    const granted = await garantirPermissao("gallery");
    if (!granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: limiteAtual - midiasSelecionadas.length,
      mediaTypes: ["images", "videos"],
      quality: 0.9,
      orderedSelection: true,
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

    const granted = await garantirPermissao("camera");
    if (!granted) {
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

  const handleRemoverMidia = (id: string) => {
    const proximaLista = midiasSelecionadas.filter((item) => item.id !== id);

    if (abaAtiva === "post") {
      setMidiasPost(proximaLista);
    } else {
      setMidiasDaily(proximaLista);
    }

    if (midiaAtivaId === id) {
      setMidiaAtivaId(proximaLista[0]?.id ?? null);
    }
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
    setMidiaAtivaId(null);
    setSuccess("Post publicado com sucesso.");
    Alert.alert("Sucesso", "Seu post foi publicado.", [{ text: "OK", onPress: () => router.back() }]);
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
    setMidiaAtivaId(null);
    setSuccess("Daily publicado com sucesso.");
    Alert.alert("Sucesso", "Seu Daily foi publicado.", [{ text: "OK", onPress: () => router.back() }]);
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

  const renderPermissionBadge = (kind: PermissionKind) => {
    const status = kind === "gallery" ? galleryPermission : cameraPermission;
    const label = status === "granted" ? "Liberado" : status === "denied" ? "Pendente" : "Verificando";
    const badgeStyle =
      status === "granted"
        ? styles.permissionBadgeGranted
        : status === "denied"
          ? styles.permissionBadgeDenied
          : styles.permissionBadgeNeutral;

    return (
      <View style={[styles.permissionBadge, badgeStyle]}>
        <Text style={styles.permissionBadgeText}>{label}</Text>
      </View>
    );
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()} disabled={sending}>
            <Ionicons name="close" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>{abaAtiva === "post" ? "Novo post" : "Novo daily"}</Text>
          <Pressable
            style={[styles.shareButton, sending && styles.buttonDisabled]}
            onPress={handlePublicarComTratamento}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={theme.colors.buttonText} />
            ) : (
              <Text style={styles.shareButtonText}>Compartilhar</Text>
            )}
          </Pressable>
        </View>

        <LinearGradient colors={theme.colors.buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroEyebrow}>Criador JustLift</Text>
              <Text style={styles.heroTitle}>Monte seu conteudo antes de publicar</Text>
            </View>
            <View style={styles.heroCounter}>
              <Text style={styles.heroCounterText}>{midiasSelecionadas.length}/{limiteAtual}</Text>
            </View>
          </View>

          <Text style={styles.heroSubtitle}>
            {abaAtiva === "post"
              ? "Escolha fotos ou videos, ajuste a legenda e publique em poucos toques."
              : "Daily aceita varias midias e limita videos em ate 15 segundos por item."}
          </Text>
        </LinearGradient>

        <View style={styles.tabsRow}>
          <Pressable
            style={[styles.tabButton, abaAtiva === "post" && styles.tabButtonActive]}
            onPress={() => trocarAba("post")}
            disabled={sending}
          >
            <Ionicons name="grid-outline" size={16} color={abaAtiva === "post" ? theme.colors.buttonText : theme.colors.text} />
            <Text style={[styles.tabButtonText, abaAtiva === "post" && styles.tabButtonTextActive]}>Post</Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, abaAtiva === "daily" && styles.tabButtonActive]}
            onPress={() => trocarAba("daily")}
            disabled={sending}
          >
            <Ionicons name="flash-outline" size={16} color={abaAtiva === "daily" ? theme.colors.buttonText : theme.colors.text} />
            <Text style={[styles.tabButtonText, abaAtiva === "daily" && styles.tabButtonTextActive]}>Daily</Text>
          </Pressable>
        </View>

        <View style={styles.previewCard}>
          {midiaAtiva ? (
            <>
              {midiaAtiva.type === "image" ? (
                <Image source={{ uri: midiaAtiva.uri }} style={styles.activePreviewImage} />
              ) : (
                <View style={styles.activePreviewVideo}>
                  <Ionicons name="play-circle" size={42} color={theme.colors.buttonText} />
                  <Text style={styles.activePreviewVideoText}>Preview de video</Text>
                  <Text style={styles.activePreviewVideoHint}>
                    {abaAtiva === "daily" ? "Daily limita o video em 15 segundos" : "Video pronto para upload"}
                  </Text>
                </View>
              )}

              <LinearGradient colors={["#00000010", "#000000A6"]} style={styles.previewOverlay}>
                <Text style={styles.previewOverlayTitle}>
                  {midiaAtiva.type === "image" ? "Foto selecionada" : "Video selecionado"}
                </Text>
                <Text style={styles.previewOverlayText}>
                  Toque nas miniaturas abaixo para trocar a capa em destaque.
                </Text>
              </LinearGradient>
            </>
          ) : (
            <View style={styles.emptyPreview}>
              <Ionicons name="camera-outline" size={36} color={theme.colors.text} />
              <Text style={styles.emptyPreviewTitle}>Comece pelo visual</Text>
              <Text style={styles.emptyPreviewText}>
                Abra a camera ou puxe algo da galeria para montar seu post do jeito que voce imaginou.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionCard} onPress={handleEscolherDaGaleria} disabled={sending}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="images-outline" size={22} color={theme.colors.text} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Galeria</Text>
              <Text style={styles.actionText}>Selecione uma ou varias midias.</Text>
            </View>
            {renderPermissionBadge("gallery")}
          </Pressable>

          <Pressable style={styles.actionCard} onPress={handleAbrirCamera} disabled={sending}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="camera-outline" size={22} color={theme.colors.text} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Camera</Text>
              <Text style={styles.actionText}>Capture agora sem sair da tela.</Text>
            </View>
            {renderPermissionBadge("camera")}
          </Pressable>
        </View>

        <View style={styles.infoStrip}>
          <Ionicons name="sparkles-outline" size={16} color={theme.colors.mutedText} />
          <Text style={styles.infoStripText}>
            {abaAtiva === "post"
              ? "Posts aceitam ate 9 itens entre foto e video."
              : "Daily aceita ate 20 itens e expira em 24h."}
          </Text>
        </View>

        {midiasSelecionadas.length > 0 ? (
          <FlatList
            data={midiasSelecionadas}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailList}
            renderItem={({ item, index }) => {
              const ativo = item.id === midiaAtiva?.id;

              return (
                <Pressable style={[styles.thumbnailCard, ativo && styles.thumbnailCardActive]} onPress={() => setMidiaAtivaId(item.id)}>
                  <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
                  <View style={styles.thumbnailBadge}>
                    <Text style={styles.thumbnailBadgeText}>{index + 1}</Text>
                  </View>
                  {item.type === "video" ? (
                    <View style={styles.thumbnailVideoIcon}>
                      <Ionicons name="videocam" size={12} color={theme.colors.buttonText} />
                    </View>
                  ) : null}
                  <Pressable style={styles.removeButton} onPress={() => handleRemoverMidia(item.id)}>
                    <Ionicons name="close" size={12} color={theme.colors.buttonText} />
                  </Pressable>
                </Pressable>
              );
            }}
          />
        ) : null}

        {abaAtiva === "post" ? (
          <View style={styles.captionCard}>
            <Text style={styles.sectionTitle}>Legenda</Text>
            <TextInput
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Escreva algo sobre esse momento..."
              placeholderTextColor={theme.colors.mutedText}
              style={styles.descriptionInput}
              multiline
              textAlignVertical="top"
              editable={!sending}
              maxLength={1000}
            />
            <View style={styles.captionFooter}>
              <Text style={styles.captionHint}>Conte uma historia, destaque o treino ou marque o contexto.</Text>
              <Text style={styles.captionCount}>{descricao.length}/1000</Text>
            </View>
          </View>
        ) : (
          <View style={styles.captionCard}>
            <Text style={styles.sectionTitle}>Como funciona o Daily</Text>
            <Text style={styles.dailyInfoText}>
              Cada foto fica visivel por 24 horas. Se houver video, o app considera no maximo os primeiros 15 segundos.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
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
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 40,
      gap: 14,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: "#FFFFFF14",
      alignItems: "center",
      justifyContent: "center",
    },
    topBarTitle: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
    },
    shareButton: {
      minWidth: 122,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.button,
      paddingHorizontal: 16,
    },
    shareButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "800",
      fontSize: 14,
    },
    heroCard: {
      borderRadius: 24,
      padding: 18,
      gap: 10,
    },
    heroHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    heroEyebrow: {
      color: "#071017",
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    heroTitle: {
      color: "#FFFFFF",
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "900",
      maxWidth: 240,
    },
    heroSubtitle: {
      color: "#F4F7FB",
      fontSize: 14,
      lineHeight: 20,
      maxWidth: 300,
    },
    heroCounter: {
      minWidth: 58,
      height: 34,
      borderRadius: 17,
      backgroundColor: "#08101833",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    heroCounterText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 14,
    },
    tabsRow: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      padding: 6,
      gap: 8,
      borderWidth: 1,
      borderColor: "#FFFFFF12",
    },
    tabButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.button,
    },
    tabButtonText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    tabButtonTextActive: {
      color: theme.colors.buttonText,
    },
    previewCard: {
      minHeight: 360,
      borderRadius: 28,
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: "#FFFFFF12",
      position: "relative",
    },
    activePreviewImage: {
      width: "100%",
      height: 360,
      resizeMode: "cover",
    },
    activePreviewVideo: {
      height: 360,
      backgroundColor: "#0B1020",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 24,
    },
    activePreviewVideoText: {
      color: theme.colors.buttonText,
      fontSize: 18,
      fontWeight: "800",
    },
    activePreviewVideoHint: {
      color: "#D6E4FF",
      fontSize: 13,
      textAlign: "center",
    },
    previewOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 18,
      paddingTop: 30,
      paddingBottom: 18,
      gap: 4,
    },
    previewOverlayTitle: {
      color: "#FFFFFF",
      fontSize: 18,
      fontWeight: "800",
    },
    previewOverlayText: {
      color: "#F3F4F6",
      fontSize: 13,
      lineHeight: 18,
    },
    emptyPreview: {
      minHeight: 360,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 28,
      backgroundColor: "#0C1018",
    },
    emptyPreviewTitle: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: "800",
    },
    emptyPreviewText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    actionsRow: {
      gap: 12,
    },
    actionCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: "#FFFFFF12",
    },
    actionIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: "#FFFFFF0E",
      alignItems: "center",
      justifyContent: "center",
    },
    actionContent: {
      flex: 1,
      gap: 3,
    },
    actionTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    actionText: {
      color: theme.colors.mutedText,
      fontSize: 13,
      lineHeight: 18,
    },
    permissionBadge: {
      minWidth: 80,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    permissionBadgeGranted: {
      backgroundColor: "#22C55E22",
    },
    permissionBadgeDenied: {
      backgroundColor: "#F43F5E22",
    },
    permissionBadgeNeutral: {
      backgroundColor: "#FFFFFF14",
    },
    permissionBadgeText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    infoStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: "#0E1623",
      borderWidth: 1,
      borderColor: "#1B2A40",
    },
    infoStripText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
    thumbnailList: {
      gap: 10,
      paddingRight: 6,
    },
    thumbnailCard: {
      width: 90,
      height: 118,
      borderRadius: 18,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "#FFFFFF12",
      backgroundColor: theme.colors.surface,
    },
    thumbnailCardActive: {
      borderColor: theme.colors.button,
      transform: [{ scale: 1.02 }],
    },
    thumbnailImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    thumbnailBadge: {
      position: "absolute",
      left: 8,
      bottom: 8,
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#00000099",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    thumbnailBadgeText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
    },
    thumbnailVideoIcon: {
      position: "absolute",
      left: 8,
      top: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#00000099",
      alignItems: "center",
      justifyContent: "center",
    },
    removeButton: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "#00000099",
      alignItems: "center",
      justifyContent: "center",
    },
    captionCard: {
      borderRadius: 24,
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: "#FFFFFF12",
      gap: 12,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    descriptionInput: {
      minHeight: 144,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: "#FFFFFF10",
      fontSize: 15,
      lineHeight: 22,
    },
    captionFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    captionHint: {
      flex: 1,
      color: theme.colors.mutedText,
      fontSize: 12,
      lineHeight: 17,
    },
    captionCount: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    dailyInfoText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      lineHeight: 21,
    },
    error: {
      color: theme.colors.error,
      fontSize: 13,
      fontWeight: "700",
    },
    success: {
      color: theme.colors.success,
      fontSize: 13,
      fontWeight: "700",
    },
    buttonDisabled: {
      opacity: 0.7,
    },
  });
}
