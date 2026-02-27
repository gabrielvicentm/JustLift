import { useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AxiosError } from "axios";
import { api } from "@/app/config/api";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { useRouter } from "expo-router";

type PresignResponse = {
  key: string;
  uploadUrl: string;
  expiresIn: number;
  publicUrl: string | null;
};

export default function PerfilScreen() {
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePickAndUpload = async () => {
    setError("");
    setStatus("");

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Permissão da galeria não concedida.");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });

    if (pickerResult.canceled || pickerResult.assets.length === 0) {
      return;
    }

    const asset = pickerResult.assets[0];
    const filename = asset.fileName ?? `foto-${Date.now()}.jpg`;
    const contentType = asset.mimeType ?? "image/jpeg";
    const size = asset.fileSize;

    setSelectedImageUri(asset.uri);
    setLoading(true);
    setStatus("Gerando URL de upload...");

    try {
      const presign = await api.post<PresignResponse>("/media/presign", {
        filename,
        contentType,
        size,
      });

      const uploadUrl = presign.data.uploadUrl;
      const key = presign.data.key;
      const publicUrl = presign.data.publicUrl;

      setStatus("Enviando arquivo para R2...");
      const fileResponse = await fetch(asset.uri);
      const fileBlob = await fileResponse.blob();

      const putResult = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: fileBlob,
      });

      if (!putResult.ok) {
        throw new Error(`Falha no upload para R2 (HTTP ${putResult.status})`);
      }

      setStatus("Confirmando upload no backend...");
      await api.post("/media/complete", { key, contentType, size });

      setUploadedImageUrl(publicUrl);
      setStatus("Upload concluído com sucesso.");
    } catch (err) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      const backendMessage = axiosError.response?.data?.message;

      if (backendMessage) {
        setError(backendMessage);
      } else if (!axiosError.response) {
        setError(`Sem conexão com o backend (${api.defaults.baseURL}).`);
      } else {
        setError("Não foi possível concluir o upload da imagem.");
      }

      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("profile_title")}</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Teste de Upload (R2)</Text>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handlePickAndUpload}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.buttonText} />
          ) : (
            <Text style={styles.buttonText}>Selecionar foto e enviar</Text>
          )}
        </Pressable>

        {status ? <Text style={styles.success}>{status}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {selectedImageUri ? (
          <View style={styles.previewBlock}>
            <Text style={styles.previewTitle}>Prévia local</Text>
            <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
          </View>
        ) : null}

        {uploadedImageUrl ? (
          <View style={styles.previewBlock}>
            <Text style={styles.previewTitle}>URL pública no R2</Text>
            <Text selectable style={styles.urlText}>
              {uploadedImageUrl}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={styles.button}
          onPress={() => router.push("/screens/social/UpdateProfile")}
        >
          <Text style={styles.buttonText}>Editar Perfil</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      padding: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 16,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    button: {
      backgroundColor: theme.colors.button,
      borderRadius: 10,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 15,
    },
    success: {
      color: theme.colors.success,
      fontWeight: "500",
    },
    error: {
      color: theme.colors.error,
      fontWeight: "500",
    },
    previewBlock: {
      gap: 6,
      marginTop: 8,
    },
    previewTitle: {
      color: theme.colors.mutedText,
      fontWeight: "600",
    },
    previewImage: {
      width: "100%",
      height: 220,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBackground,
    },
    urlText: {
      color: theme.colors.link,
      fontSize: 12,
    },
  });
}
