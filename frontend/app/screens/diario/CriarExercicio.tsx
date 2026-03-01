import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { useRouter } from "expo-router";
import { api } from "@/app/config/api";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { uploadImageToR2 } from "@/app/features/profile/service";

const EQUIPAMENTOS = ["barra", "halteres", "peso corporal", "cabo", "máquina", "elástico"];
const MUSCULOS_ALVO = [
  "peito",
  "costas",
  "ombros",
  "bíceps",
  "tríceps",
  "quadríceps",
  "posterior de coxa",
  "glúteos",
  "panturrilhas",
  "abdômen",
];

export default function CriarExercicioScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [nome, setNome] = useState("");
  const [equipamento, setEquipamento] = useState<string | null>(null);
  const [musculoAlvo, setMusculoAlvo] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("exercicio.jpg");
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [imageSize, setImageSize] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getApiErrorMessage = (err: unknown) => {
    const axiosError = err as AxiosError<{ message?: string } | string>;

    if (!axiosError.response) {
      return `Sem conexão com o servidor (${api.defaults.baseURL}).`;
    }

    const { status, data } = axiosError.response;
    if (typeof data === "string" && data.trim().length > 0) {
      return `Erro ${status}: ${data}`;
    }

    if (data && typeof data === "object" && "message" in data && data.message) {
      return String(data.message);
    }

    return `Erro ${status} ao criar exercício.`;
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Permissão da galeria não concedida.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setImageName(asset.fileName ?? `exercicio-${Date.now()}.jpg`);
    setImageMime(asset.mimeType ?? "image/jpeg");
    setImageSize(asset.fileSize);
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Permissão da câmera não concedida.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setImageName(asset.fileName ?? `camera-${Date.now()}.jpg`);
    setImageMime(asset.mimeType ?? "image/jpeg");
    setImageSize(asset.fileSize);
  };

  const handleAddImagePress = () => {
    Alert.alert("Adicionar imagem", "Escolha uma opção", [
      { text: "Escolher da galeria", onPress: pickFromGallery },
      { text: "Abrir câmera", onPress: pickFromCamera },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const uploadImageIfNeeded = async (): Promise<string | null> => {
    if (!imageUri) {
      return null;
    }

    return uploadImageToR2(imageUri, imageName, imageMime, imageSize);
  };

  const handleCreateExercise = async () => {
    setError("");
    setSuccess("");

    if (nome.trim().length < 2) {
      setError("Digite um nome de exercício válido.");
      return;
    }

    if (!equipamento) {
      setError("Selecione um equipamento.");
      return;
    }

    if (!musculoAlvo) {
      setError("Selecione o músculo alvo.");
      return;
    }

    setLoading(true);
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Faça login para criar exercícios.");
        return;
      }

      const imgUrl = await uploadImageIfNeeded();

      await api.post(
        "/diario/custom",
        {
          nome: nome.trim(),
          equipamento,
          musculo_alvo: musculoAlvo,
          img_url: imgUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      setSuccess("Exercício criado com sucesso.");
      setNome("");
      setEquipamento(null);
      setMusculoAlvo(null);
      setImageUri(null);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Criar exercício</Text>

      <Pressable style={styles.imagePicker} onPress={handleAddImagePress} disabled={loading}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.imagePickerContent}>
            <MaterialCommunityIcons name="camera-plus-outline" size={26} color={theme.colors.buttonText} />
            <Text style={styles.imagePickerText}>Adicionar imagem</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.label}>Nome do exercício</Text>
      <TextInput
        value={nome}
        onChangeText={setNome}
        editable={!loading}
        placeholder="Ex: Supino inclinado"
        placeholderTextColor={theme.colors.mutedText}
        style={styles.input}
      />

      <Text style={styles.label}>Equipamento</Text>
      <View style={styles.optionsWrap}>
        {EQUIPAMENTOS.map((item) => {
          const selected = equipamento === item;
          return (
            <Pressable
              key={item}
              onPress={() => setEquipamento(item)}
              style={[styles.chip, selected && styles.chipSelected]}
              disabled={loading}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Músculo alvo</Text>
      <View style={styles.optionsWrap}>
        {MUSCULOS_ALVO.map((item) => {
          const selected = musculoAlvo === item;
          return (
            <Pressable
              key={item}
              onPress={() => setMusculoAlvo(item)}
              style={[styles.chip, selected && styles.chipSelected]}
              disabled={loading}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <Pressable style={[styles.submitButton, loading && styles.buttonDisabled]} onPress={handleCreateExercise} disabled={loading}>
        {loading ? <ActivityIndicator color={theme.colors.buttonText} /> : <Text style={styles.submitButtonText}>Salvar exercício</Text>}
      </Pressable>

      <Pressable style={styles.backButton} onPress={() => router.back()} disabled={loading}>
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
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    imagePicker: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      minHeight: 160,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    imagePickerContent: {
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.button,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10,
    },
    imagePickerText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    previewImage: {
      width: "100%",
      height: 200,
      resizeMode: "cover",
    },
    label: {
      marginTop: 4,
      color: theme.colors.text,
      fontWeight: "600",
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
    },
    optionsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
    },
    chipSelected: {
      backgroundColor: theme.colors.button,
      borderColor: theme.colors.button,
    },
    chipText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    chipTextSelected: {
      color: theme.colors.buttonText,
    },
    submitButton: {
      marginTop: 8,
      height: 46,
      borderRadius: 10,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
    },
    submitButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 16,
    },
    backButton: {
      height: 46,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
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
