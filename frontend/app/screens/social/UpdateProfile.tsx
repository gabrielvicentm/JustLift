import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMyProfileQuery } from "@/app/features/profile/hooks";
import {
  getApiErrorMessage,
  profileKeys,
  updateMyProfile,
  uploadImageToR2,
} from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

export default function EditarPerfilScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [nomeExibicao, setNomeExibicao] = useState("");
  const [biografia, setBiografia] = useState("");
  const [fotoPerfilUri, setFotoPerfilUri] = useState<string | null>(null);
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [formHydrated, setFormHydrated] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const profileQuery = useMyProfileQuery();

  useEffect(() => {
    if (!formHydrated && profileQuery.data) {
      setNomeExibicao(profileQuery.data.nome_exibicao ?? "");
      setBiografia(profileQuery.data.biografia ?? "");
      setFotoPerfilUrl(profileQuery.data.foto_perfil ?? null);
      setBannerUrl(profileQuery.data.banner ?? null);
      setFormHydrated(true);
    }
  }, [formHydrated, profileQuery.data]);

  useEffect(() => {
    if (profileQuery.error) {
      setError(getApiErrorMessage(profileQuery.error, "carregar perfil"));
    }
  }, [profileQuery.error]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let finalFotoPerfilUrl = fotoPerfilUrl;
      let finalBannerUrl = bannerUrl;

      if (fotoPerfilUri) {
        setSuccess("Enviando foto de perfil...");
        finalFotoPerfilUrl = await uploadImageToR2(fotoPerfilUri, `perfil_${Date.now()}.jpg`);
      }

      if (bannerUri) {
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
      setTimeout(() => {
        router.back();
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
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredBlock}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={styles.loadingText}>Carregando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Editar Perfil</Text>

        <View style={styles.section}>
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
            onPress={handleSelectFotoPerfil}
            disabled={loading}
          >
            <Text style={styles.buttonSecondaryText}>Selecionar Foto</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Banner</Text>
          {bannerUri ? (
            <Image source={{ uri: bannerUri }} style={styles.bannerPreview} />
          ) : bannerUrl ? (
            <Image source={{ uri: bannerUrl }} style={styles.bannerPreview} />
          ) : (
            <View style={[styles.bannerPreview, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>Nenhum banner selecionado</Text>
            </View>
          )}
          <Pressable
            style={[styles.button, styles.buttonSecondary, loading && styles.buttonDisabled]}
            onPress={handleSelectBanner}
            disabled={loading}
          >
            <Text style={styles.buttonSecondaryText}>Selecionar Banner</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Nome de Exibicao</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite seu nome"
            placeholderTextColor={theme.colors.mutedText}
            value={nomeExibicao}
            onChangeText={setNomeExibicao}
            editable={!loading}
            maxLength={255}
          />
          <Text style={styles.charCount}>{nomeExibicao.length} / 255</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Biografia</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Conte um pouco sobre voce"
            placeholderTextColor={theme.colors.mutedText}
            value={biografia}
            onChangeText={setBiografia}
            editable={!loading}
            maxLength={500}
            multiline
            numberOfLines={4}
          />
          <Text style={styles.charCount}>{biografia.length} / 500</Text>
        </View>

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
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.colors.text,
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
      fontWeight: "600",
      color: theme.colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
      fontSize: 14,
    },
    textarea: {
      minHeight: 100,
      textAlignVertical: "top",
    },
    charCount: {
      fontSize: 12,
      color: theme.colors.mutedText,
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
    },
    buttonSecondaryText: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 15,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    actionButtons: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
      marginBottom: 20,
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
