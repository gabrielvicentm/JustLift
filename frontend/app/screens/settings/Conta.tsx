import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  applyAccountChange,
  confirmAccountChangeCode,
  deleteAccount,
  getApiErrorMessage,
  requestAccountChangeCode,
} from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

export default function ContaScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(true);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestCodeMutation = useMutation({
    mutationFn: async () => {
      await requestAccountChangeCode();
    },
    onSuccess: () => {
      setError("");
      setSuccess("Codigo enviado para o email cadastrado.");
      setShowCodeInput(true);
    },
    onError: (err) => {
      setSuccess("");
      setError(getApiErrorMessage(err, "solicitar alteracao de conta"));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      await confirmAccountChangeCode(verificationCode.trim());
    },
    onSuccess: () => {
      setError("");
      setSuccess("Codigo confirmado. Agora voce pode alterar seus dados.");
      setVerificationCode("");
      setIsVerified(true);
      setShowVerificationModal(false);
    },
    onError: (err) => {
      setSuccess("");
      setError(getApiErrorMessage(err, "confirmar alteracao de conta"));
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      await applyAccountChange({
        newUsername: newUsername.trim() || undefined,
        newEmail: newEmail.trim() || undefined,
        newPassword: newPassword.trim() || undefined,
      });
    },
    onSuccess: () => {
      setError("");
      setSuccess("Conta atualizada com sucesso.");
      setNewPassword("");
    },
    onError: (err) => {
      setSuccess("");
      setError(getApiErrorMessage(err, "alterar dados da conta"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteAccount(deletePassword.trim());
    },
    onSuccess: async () => {
      setError("");
      setSuccess("");
      await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
      router.replace("/screens/auth/Register");
    },
    onError: (err) => {
      setSuccess("");
      setError(getApiErrorMessage(err, "excluir conta"));
    },
  });

  const loading =
    requestCodeMutation.isPending ||
    confirmMutation.isPending ||
    applyMutation.isPending ||
    deleteMutation.isPending;

  const handleConfirmCode = () => {
    setError("");
    setSuccess("");

    if (!verificationCode.trim()) {
      setError("Informe o codigo de verificacao.");
      return;
    }

    confirmMutation.mutate();
  };

  const handleApplyChanges = () => {
    setError("");
    setSuccess("");

    if (!newUsername.trim() && !newEmail.trim() && !newPassword.trim()) {
      setError("Preencha username, email ou senha para continuar.");
      return;
    }

    applyMutation.mutate();
  };

  const handleDeleteAccount = () => {
    setError("");
    setSuccess("");

    if (!deletePassword.trim()) {
      setError("Digite sua senha para confirmar a exclusao.");
      return;
    }

    deleteMutation.mutate();
  };

  return (
    <View style={styles.container}>
      <Modal
        visible={showVerificationModal && !isVerified}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (isVerified) setShowVerificationModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <LinearGradient
            colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.modalBorder}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Confirmar email</Text>
              <Text style={styles.modalSubtitle}>
                Para continuar, voce precisa confirmar o codigo enviado para seu email.
              </Text>

              <Pressable
                style={[styles.actionButton, loading && styles.buttonDisabled]}
                onPress={() => requestCodeMutation.mutate()}
                disabled={loading}
              >
                {requestCodeMutation.isPending ? (
                  <ActivityIndicator color="#0B0E18" />
                ) : (
                  <Text style={styles.actionButtonText}>Enviar codigo</Text>
                )}
              </Pressable>

              {showCodeInput ? (
                <View style={styles.modalSection}>
                  <Text style={styles.label}>Codigo de verificacao</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Digite o codigo recebido"
                    placeholderTextColor="#7FE7FF"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    editable={!loading}
                    keyboardType="number-pad"
                    maxLength={6}
                  />

                  <Pressable
                    style={[styles.actionButton, loading && styles.buttonDisabled]}
                    onPress={handleConfirmCode}
                    disabled={loading}
                  >
                    {confirmMutation.isPending ? (
                      <ActivityIndicator color="#0B0E18" />
                    ) : (
                      <Text style={styles.actionButtonText}>Confirmar codigo</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                style={[styles.secondaryButton, loading && styles.buttonDisabled]}
                onPress={() => router.replace("/screens/settings/Configuracoes")}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Voltar</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </Modal>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Conta</Text>
          <Text style={styles.subtitle}>
            Confirme o codigo enviado ao email para liberar a alteracao de username, email e senha.
          </Text>

          {isVerified ? (
            <LinearGradient
              colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.cardBorder}
            >
              <View style={styles.cardInner}>
                <Text style={styles.sectionTitle}>Alterar dados</Text>

                <Text style={styles.label}>Novo username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite o novo username"
                  placeholderTextColor="#7FE7FF"
                  value={newUsername}
                  onChangeText={setNewUsername}
                  editable={!loading}
                  autoCapitalize="none"
                  maxLength={255}
                />

                <Text style={styles.label}>Novo email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite o novo email"
                  placeholderTextColor="#7FE7FF"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  editable={!loading}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  maxLength={255}
                />

                <Text style={styles.label}>Nova senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite a nova senha"
                  placeholderTextColor="#7FE7FF"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  editable={!loading}
                  secureTextEntry
                  maxLength={255}
                />

                <Pressable
                  style={[styles.actionButton, loading && styles.buttonDisabled]}
                  onPress={handleApplyChanges}
                  disabled={loading}
                >
                  {applyMutation.isPending ? (
                    <ActivityIndicator color="#0B0E18" />
                  ) : (
                    <Text style={styles.actionButtonText}>Salvar alteracoes</Text>
                  )}
                </Pressable>
              </View>
            </LinearGradient>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          <LinearGradient
            colors={theme.colors.negativeGradient as [string, string, string]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.negativeBorder}
          >
            <View style={styles.cardInner}>
              <Text style={styles.sectionTitle}>Excluir conta</Text>
              <Text style={styles.deleteHint}>
                Essa acao e irreversivel. Seus dados serao removidos do app.
              </Text>

              <Pressable
                style={[styles.dangerButton, loading && styles.buttonDisabled]}
                onPress={() => setShowDeleteConfirm((prev) => !prev)}
                disabled={loading}
              >
                <Text style={styles.dangerButtonText}>
                  {showDeleteConfirm ? "Cancelar exclusao" : "Excluir conta"}
                </Text>
              </Pressable>

              {showDeleteConfirm ? (
                <View style={styles.deleteConfirm}>
                  <Text style={styles.label}>Confirmar acao</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Digite sua senha"
                    placeholderTextColor="#7FE7FF"
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    editable={!loading}
                    secureTextEntry
                    maxLength={255}
                  />

                  <Pressable
                    style={[styles.actionButton, loading && styles.buttonDisabled]}
                    onPress={handleDeleteAccount}
                    disabled={loading}
                  >
                    {deleteMutation.isPending ? (
                      <ActivityIndicator color="#0B0E18" />
                    ) : (
                      <Text style={styles.actionButtonText}>Confirmar exclusao</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#0B0E18",
    },
    keyboardContainer: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      gap: 14,
      paddingBottom: 120,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: "#E0E0E0",
      textShadowColor: "rgba(0, 255, 255, 0.75)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    subtitle: {
      color: "#7FE7FF",
      textShadowColor: "rgba(0, 255, 255, 0.45)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    cardBorder: {
      borderRadius: 18,
      padding: 1.5,
      shadowColor: "#74D3FF",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    cardInner: {
      borderRadius: 16,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      padding: 14,
      gap: 10,
    },
    sectionTitle: {
      color: "#E0E0E0",
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    label: {
      color: "#E0E0E0",
      fontWeight: "600",
      fontSize: 14,
    },
    input: {
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      color: "#E0E0E0",
      fontSize: 14,
    },
    actionButton: {
      minHeight: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#7FE7FF",
      shadowColor: "#7FE7FF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    actionButtonText: {
      color: "#0B0E18",
      fontWeight: "800",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    secondaryButton: {
      minHeight: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    secondaryButtonText: {
      color: "#E0E0E0",
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    error: {
      backgroundColor: "rgba(244, 63, 94, 0.2)",
      color: "#F43F5E",
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: "500",
    },
    success: {
      backgroundColor: "rgba(34, 197, 94, 0.2)",
      color: "#22C55E",
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: "500",
    },
    negativeBorder: {
      borderRadius: 18,
      padding: 1.5,
      shadowColor: "#FF9500",
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    deleteHint: {
      color: "#FFD60A",
      fontSize: 12,
      marginBottom: 6,
    },
    dangerButton: {
      minHeight: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      borderWidth: 1,
      borderColor: "rgba(255, 149, 0, 0.6)",
    },
    dangerButtonText: {
      color: "#FFD60A",
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    deleteConfirm: {
      marginTop: 8,
      gap: 10,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modalBorder: {
      width: "100%",
      maxWidth: 420,
      minHeight: "60%",
      borderRadius: 18,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    modalCard: {
      borderRadius: 16,
      backgroundColor: "rgba(11, 14, 24, 0.96)",
      padding: 18,
      gap: 14,
      minHeight: "60%",
      justifyContent: "center",
    },
    modalTitle: {
      color: "#E0E0E0",
      fontSize: 18,
      fontWeight: "700",
    },
    modalSubtitle: {
      color: "#7FE7FF",
      fontSize: 13,
    },
    modalSection: {
      gap: 10,
    },
  });
}
