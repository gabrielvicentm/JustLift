import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMyProfileQuery } from "@/app/features/profile/hooks";
import {
  getApiErrorMessage,
  profileKeys,
  updateMyProfile,
  uploadImageToR2,
} from "@/app/features/profile/service";
import { api } from "@/app/config/api";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

const PROGRESS_GRADIENT = ["#5BE7FF", "#7C5CFF", "#FF4BD8"] as const;
const PREMIUM_AD_PROFILE_FLAG_KEY = "show_premium_modal_after_profile_update";
const GOLD_BORDER = ["#FDE68A", "#F8C84A", "#B45309"] as const;
const GOLD_GLOW = ["rgba(253, 230, 138, 0.45)", "rgba(245, 158, 11, 0.15)", "transparent"] as const;
const BANNER_PRESETS = [
  { id: "color:#0B0E18", label: "Noite", type: "color" as const, color: "#0B0E18" },
  { id: "color:#121826", label: "Azul", type: "color" as const, color: "#121826" },
  { id: "color:#1C0F2E", label: "Roxo", type: "color" as const, color: "#1C0F2E" },
  { id: "color:#122314", label: "Verde", type: "color" as const, color: "#122314" },
  { id: "gradient:#5BE7FF,#7C5CFF", label: "Aurora", type: "gradient" as const, colors: ["#5BE7FF", "#7C5CFF"] },
  { id: "gradient:#FF4BD8,#7C5CFF", label: "Neon", type: "gradient" as const, colors: ["#FF4BD8", "#7C5CFF"] },
  { id: "gradient:#FDE68A,#F8C84A", label: "Dourado", type: "gradient" as const, colors: ["#FDE68A", "#F8C84A"] },
  { id: "gradient:#0F172A,#1E3A8A", label: "Profundo", type: "gradient" as const, colors: ["#0F172A", "#1E3A8A"] },
  { id: "gradient:#14B8A6,#0EA5E9", label: "Maresia", type: "gradient" as const, colors: ["#14B8A6", "#0EA5E9"] },
];

type PremiumStatusResponse = {
  isPremium: boolean;
  premiumUpdatedAt?: string | null;
  message?: string;
};

export default function EditarPerfilScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [nomeExibicao, setNomeExibicao] = useState("");
  const [biografia, setBiografia] = useState("");
  const [fotoPerfilUri, setFotoPerfilUri] = useState<string | null>(null);
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [selectedBannerPreset, setSelectedBannerPreset] = useState<string | null>(null);
  const [formHydrated, setFormHydrated] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [checkingPremium, setCheckingPremium] = useState(false);
  const [showBannerPremiumModal, setShowBannerPremiumModal] = useState(false);

  const profileQuery = useMyProfileQuery();

  useEffect(() => {
    if (!formHydrated && profileQuery.data) {
      setNomeExibicao(profileQuery.data.nome_exibicao ?? "");
      setBiografia(profileQuery.data.biografia ?? "");
      setFotoPerfilUrl(profileQuery.data.foto_perfil ?? null);
      setBannerUrl(profileQuery.data.banner ?? null);
      if (profileQuery.data.banner?.startsWith("color:") || profileQuery.data.banner?.startsWith("gradient:")) {
        setSelectedBannerPreset(profileQuery.data.banner);
      }
      setFormHydrated(true);
    }
  }, [formHydrated, profileQuery.data]);

  useEffect(() => {
    if (profileQuery.error) {
      setError(getApiErrorMessage(profileQuery.error, "carregar perfil"));
    }
  }, [profileQuery.error]);

  useEffect(() => {
    let active = true;
    const loadPremium = async () => {
      setCheckingPremium(true);
      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        if (!accessToken) {
          if (active) setIsPremium(false);
          return;
        }
        const response = await api.get<PremiumStatusResponse>("/premium/status", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (active) setIsPremium(Boolean(response.data?.isPremium));
      } catch {
        if (active) setIsPremium(false);
      } finally {
        if (active) setCheckingPremium(false);
      }
    };
    loadPremium().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let finalFotoPerfilUrl = fotoPerfilUrl;
      let finalBannerUrl = bannerUrl;

      if (fotoPerfilUri) {
        setSuccess("Enviando foto de perfil...");
        finalFotoPerfilUrl = await uploadImageToR2(fotoPerfilUri, `perfil_${Date.now()}.jpg`);
      }

      if (bannerUri && isPremium) {
        setSuccess("Enviando banner...");
        finalBannerUrl = await uploadImageToR2(bannerUri, `banner_${Date.now()}.jpg`);
      }

      setSuccess("Salvando perfil...");
      await updateMyProfile({
        nome_exibicao: nomeExibicao.trim(),
        biografia: biografia.trim(),
        foto_perfil: finalFotoPerfilUrl,
        banner: finalBannerUrl,
      });

      return {
        foto_perfil: finalFotoPerfilUrl,
        banner: finalBannerUrl,
      };
    },
    onSuccess: async (result) => {
      setFotoPerfilUrl(result.foto_perfil ?? null);
      setBannerUrl(result.banner ?? null);
      setFotoPerfilUri(null);
      setBannerUri(null);
      setSuccess("Perfil atualizado com sucesso!");

      await queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      setTimeout(async () => {
        try {
          const accessToken = await AsyncStorage.getItem("accessToken");
          if (accessToken) {
            const response = await api.get<PremiumStatusResponse>("/premium/status", {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!response.data?.isPremium) {
              await AsyncStorage.setItem(PREMIUM_AD_PROFILE_FLAG_KEY, "1");
            }
          }
        } catch {
          await AsyncStorage.setItem(PREMIUM_AD_PROFILE_FLAG_KEY, "1");
        } finally {
          router.replace("/(tabs)/perfil_tab");
        }
      }, 1000);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, "atualizar perfil"));
    },
  });

  const handleSelectFotoPerfil = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Permissao de galeria nao concedida");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setFotoPerfilUri(asset.uri);
      }
    } catch {
      setError("Erro ao selecionar foto de perfil");
    }
  };

  const handleRemoveFotoPerfil = () => {
    setFotoPerfilUri(null);
    setFotoPerfilUrl(null);
  };

  const handleFotoPerfilAction = () => {
    const hasFoto = Boolean(fotoPerfilUri || fotoPerfilUrl);
    Alert.alert("Foto de perfil", "O que deseja fazer?", [
      { text: "Selecionar imagem", onPress: handleSelectFotoPerfil },
      ...(hasFoto ? [{ text: "Remover foto", onPress: handleRemoveFotoPerfil, style: "destructive" as const }] : []),
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleSelectBanner = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Permissao de galeria nao concedida");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [3, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setBannerUri(asset.uri);
      }
    } catch {
      setError("Erro ao selecionar banner");
    }
  };

  const handleRemoveBanner = () => {
    setBannerUri(null);
    setBannerUrl(null);
  };

  const handleBannerAction = () => {
    if (checkingPremium) {
      return;
    }
    if (!isPremium) {
      setShowBannerPremiumModal(true);
    if (!isPremium) {
      Alert.alert(
        "Banner Premium",
        "Apenas usuários Premium podem fazer upload de banner. Escolha uma cor ou gradiente.",
        [
          { text: "Ver Premium", onPress: () => router.push("/screens/settings/Premium") },
          { text: "Fechar", style: "cancel" },
        ],
      );
      return;
    }
    const hasBanner = Boolean(bannerUri || bannerUrl);
    Alert.alert("Banner", "O que deseja fazer?", [
      { text: "Selecionar imagem", onPress: handleSelectBanner },
      ...(hasBanner ? [{ text: "Remover banner", onPress: handleRemoveBanner, style: "destructive" as const }] : []),
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleSaveProfile = () => {
    setError("");
    setSuccess("");

    if (!nomeExibicao.trim()) {
      setError("Nome de exibicao e obrigatorio");
      return;
    }

    if (nomeExibicao.trim().length < 2) {
      setError("Nome de exibicao deve ter pelo menos 2 caracteres");
      return;
    }

    if (biografia.length > 500) {
      setError("Biografia nao pode ter mais de 500 caracteres");
      return;
    }

    updateMutation.mutate();
  };

  const loading = profileQuery.isLoading || updateMutation.isPending;

  if (profileQuery.isLoading && !formHydrated) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.centeredBlock}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={styles.loadingText}>Carregando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}>
        <Text style={styles.title}>Editar Perfil</Text>

        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.inputBorder}
        >
          <View style={styles.inputCard}>
            <Text style={styles.sectionTitle}>Foto de Perfil</Text>
            {fotoPerfilUri ? (
              <Image source={{ uri: fotoPerfilUri }} style={styles.imagePreview} />
            ) : fotoPerfilUrl ? (
              <Image source={{ uri: fotoPerfilUrl }} style={styles.imagePreview} />
            ) : (
              <View style={[styles.imagePreview, styles.placeholderImage]}>
                <Text style={styles.placeholderText}>Nenhuma foto selecionada</Text>
              </View>
            )}
            <Pressable
              style={[styles.button, styles.buttonSecondary, loading && styles.buttonDisabled]}
              onPress={handleFotoPerfilAction}
              disabled={loading}
            >
              <Ionicons name="image-outline" size={18} color="#7FE7FF" />
              <Text style={styles.buttonSecondaryText}>Selecionar foto</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.inputBorder}
        >
          <View style={styles.inputCard}>
            <Text style={styles.sectionTitle}>Banner</Text>
            {bannerUri ? (
              <Image source={{ uri: bannerUri }} style={styles.bannerPreview} />
            ) : bannerUrl && bannerUrl.startsWith("color:") ? (
              <View style={[styles.bannerPreview, { backgroundColor: bannerUrl.replace("color:", "") }]} />
            ) : bannerUrl && bannerUrl.startsWith("gradient:") ? (
              <LinearGradient
                colors={bannerUrl.replace("gradient:", "").split(",").map((color) => color.trim())}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerPreview}
              />
            ) : bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={styles.bannerPreview} />
            ) : (
              <View style={[styles.bannerPreview, styles.placeholderImage]}>
                <Text style={styles.placeholderText}>Nenhum banner selecionado</Text>
              </View>
            )}
            <Pressable
              style={[styles.button, styles.buttonSecondary, loading && styles.buttonDisabled]}
              onPress={handleBannerAction}
              disabled={loading || checkingPremium}
            >
              <Ionicons name="images-outline" size={18} color="#7FE7FF" />
              <Text style={styles.buttonSecondaryText}>Selecionar banner</Text>
            </Pressable>

            <View style={styles.presetSection}>
              <Text style={styles.presetTitle}>Cores e gradientes</Text>
              <View style={styles.presetGrid}>
                {BANNER_PRESETS.map((preset) => {
                  const selected = selectedBannerPreset === preset.id;
                  return (
                    <Pressable
                      key={preset.id}
                      style={[styles.presetItem, selected && styles.presetItemSelected]}
                      onPress={() => {
                        setSelectedBannerPreset(preset.id);
                        setBannerUrl(preset.id);
                        setBannerUri(null);
                      }}
                    >
                      {preset.type === "color" ? (
                        <View style={[styles.presetSwatch, { backgroundColor: preset.color }]} />
                      ) : (
                        <LinearGradient
                          colors={preset.colors}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.presetSwatch}
                        />
                      )}
                      <Text style={styles.presetLabel}>{preset.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {!isPremium ? (
                <Text style={styles.presetHint}>Usuários gratuitos só podem escolher cores/gradientes.</Text>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.inputBorder}
        >
          <View style={styles.inputCard}>
            <Text style={styles.label}>Nome de Exibicao</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite seu nome"
              placeholderTextColor="rgba(127, 231, 255, 0.75)"
              value={nomeExibicao}
              onChangeText={setNomeExibicao}
              editable={!loading}
              maxLength={255}
            />
            <Text style={styles.charCount}>{nomeExibicao.length} / 255</Text>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.inputBorder}
        >
          <View style={styles.inputCard}>
            <Text style={styles.label}>Biografia</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Conte um pouco sobre voce"
              placeholderTextColor="rgba(127, 231, 255, 0.75)"
              value={biografia}
              onChangeText={setBiografia}
              editable={!loading}
              maxLength={500}
              multiline
              numberOfLines={4}
            />
            <Text style={styles.charCount}>{biografia.length} / 500</Text>
          </View>
        </LinearGradient>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <View style={styles.actionButtons}>
          <Pressable
            style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}
            onPress={handleSaveProfile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.buttonText} />
            ) : (
              <Text style={styles.buttonPrimaryText}>Salvar Perfil</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.button, styles.buttonSecondary, loading && styles.buttonDisabled]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.buttonSecondaryText}>Voltar</Text>
          </Pressable>
        </View>
      </ScrollView>
      <Modal
        visible={showBannerPremiumModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBannerPremiumModal(false)}
      >
        <View style={styles.premiumBackdrop}>
          <LinearGradient colors={GOLD_BORDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premiumBorder}>
            <View style={styles.premiumCard}>
              <LinearGradient
                colors={GOLD_GLOW}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumGlow}
              />

              <Pressable onPress={() => setShowBannerPremiumModal(false)} style={styles.premiumCloseButton}>
                <Text style={styles.premiumCloseText}>×</Text>
              </Pressable>

              <Text style={styles.premiumKicker}>PREMIUM</Text>
              <Text style={styles.premiumTitle}>Banner exclusivo</Text>
              <Text style={styles.premiumSubtitle}>
                Apenas usuários Premium podem fazer upload de banner. Escolha uma cor ou gradiente, ou assine Premium.
              </Text>

              <LinearGradient
                colors={GOLD_BORDER}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumCtaBorder}
              >
                <Pressable
                  style={styles.premiumCtaButton}
                  onPress={() => {
                    setShowBannerPremiumModal(false);
                    router.push("/screens/settings/Premium");
                  }}
                >
                  <Text style={styles.premiumCtaText}>Ver Premium</Text>
                </Pressable>
              </LinearGradient>

              <Pressable style={styles.premiumGhostButton} onPress={() => setShowBannerPremiumModal(false)}>
                <Text style={styles.premiumGhostText}>Continuar com cores</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#0B0E18",
    },
    centeredBlock: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    loadingText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "500",
    },
    scrollContent: {
      padding: 16,
      gap: 16,
      paddingBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: "#E0E0E0",
      textShadowColor: "rgba(0, 255, 255, 0.75)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
      marginBottom: 8,
    },
    section: {
      gap: 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    label: {
      fontSize: 14,
      fontWeight: "700",
      color: "#7FE7FF",
      letterSpacing: 0.4,
    },
    inputBorder: {
      borderRadius: 18,
      padding: 1.5,
      shadowColor: "#74D3FF",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    inputCard: {
      borderRadius: 16,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      padding: 16,
      gap: 10,
    },
    input: {
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: "rgba(9, 12, 20, 0.95)",
      color: "#E0E0E0",
      fontSize: 14,
      borderWidth: 1,
      borderColor: "rgba(127, 231, 255, 0.25)",
    },
    textarea: {
      minHeight: 100,
      textAlignVertical: "top",
    },
    charCount: {
      fontSize: 12,
      color: "rgba(127, 231, 255, 0.75)",
      textAlign: "right",
    },
    imagePreview: {
      width: "100%",
      height: 200,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    bannerPreview: {
      width: "100%",
      height: 120,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    placeholderImage: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
    },
    placeholderText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      textAlign: "center",
    },
    button: {
      borderRadius: 10,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    buttonPrimary: {
      backgroundColor: theme.colors.button,
      flex: 1,
    },
    buttonPrimaryText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 15,
    },
    buttonSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      gap: 8,
    },
    buttonSecondaryText: {
      color: "#E0E0E0",
      fontWeight: "600",
      fontSize: 15,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    presetSection: {
      marginTop: 6,
      gap: 8,
    },
    presetTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: "#7FE7FF",
      letterSpacing: 0.2,
    },
    presetGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      justifyContent: "space-between",
    },
    presetItem: {
      width: "30%",
      borderRadius: 10,
      padding: 8,
      borderWidth: 1,
      borderColor: "rgba(127, 231, 255, 0.25)",
      backgroundColor: "rgba(9, 12, 20, 0.75)",
      gap: 6,
      alignItems: "center",
    },
    presetItemSelected: {
      borderColor: "#7FE7FF",
      shadowColor: "#7FE7FF",
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    presetSwatch: {
      width: "100%",
      height: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.12)",
      overflow: "hidden",
    },
    presetLabel: {
      color: "#E0E0E0",
      fontSize: 11,
      fontWeight: "600",
    },
    presetHint: {
      fontSize: 12,
      color: "rgba(127, 231, 255, 0.75)",
    },
    actionButtons: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
      marginBottom: 20,
    },
    premiumBackdrop: {
      flex: 1,
      backgroundColor: "rgba(5, 5, 8, 0.78)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    premiumBorder: {
      width: "90%",
      borderRadius: 24,
      padding: 2,
      shadowColor: "#FDE68A",
      shadowOpacity: 0.55,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    premiumCard: {
      borderRadius: 22,
      padding: 20,
      overflow: "hidden",
      backgroundColor: "#120804",
      gap: 12,
    },
    premiumGlow: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.9,
    },
    premiumCloseButton: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(253, 230, 138, 0.18)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(253, 230, 138, 0.4)",
      zIndex: 2,
    },
    premiumCloseText: {
      color: "#FDE68A",
      fontSize: 24,
      fontWeight: "800",
      marginTop: -2,
    },
    premiumKicker: {
      color: "#FDE68A",
      letterSpacing: 2.5,
      fontWeight: "800",
      fontSize: 12,
    },
    premiumTitle: {
      color: "#FFF7E0",
      fontSize: 24,
      fontWeight: "800",
    },
    premiumSubtitle: {
      color: "#F8D37A",
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20,
    },
    premiumCtaBorder: {
      marginTop: 6,
      borderRadius: 16,
      padding: 1.5,
      shadowColor: "#FDE68A",
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    premiumCtaButton: {
      borderRadius: 14,
      backgroundColor: "#2B1404",
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    premiumCtaText: {
      color: "#FDE68A",
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    premiumGhostButton: {
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(253, 230, 138, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(253, 230, 138, 0.25)",
    },
    premiumGhostText: {
      color: "#FDE68A",
      fontWeight: "700",
      fontSize: 14,
    },
    error: {
      backgroundColor: `${theme.colors.error}20`,
      color: theme.colors.error,
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: "500",
    },
    success: {
      backgroundColor: `${theme.colors.success}20`,
      color: theme.colors.success,
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: "500",
    },
  });
}
