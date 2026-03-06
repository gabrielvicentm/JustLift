import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { confirmAccountChange, getApiErrorMessage, requestAccountChange } from "@/app/features/profile/service";
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestMutation = useMutation({
    mutationFn: async () => {
      await requestAccountChange({
        newUsername: newUsername.trim() || undefined,
        newEmail: newEmail.trim() || undefined,
        newPassword: newPassword.trim() || undefined,
      });
    },
    onSuccess: () => {
      setError("");
      setSuccess("Codigo enviado para o email cadastrado.");
    },
    onError: (err) => {
      setSuccess("");
      setError(getApiErrorMessage(err, "solicitar alteracao de conta"));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      await confirmAccountChange(verificationCode.trim());
    },
    onSuccess: () => {
      setError("");
      setSuccess("Conta atualizada com sucesso.");
      setVerificationCode("");
      setNewPassword("");
    },
    onError: (err) => {
      setSuccess("");
      setError(getApiErrorMessage(err, "confirmar alteracao de conta"));
    },
  });

  const loading = requestMutation.isPending || confirmMutation.isPending;

  const handleRequestCode = () => {
    setError("");
    setSuccess("");

    if (!newUsername.trim() && !newEmail.trim() && !newPassword.trim()) {
      setError("Preencha username, email ou senha para continuar.");
      return;
    }

    requestMutation.mutate();
  };

  const handleConfirmCode = () => {
    setError("");
    setSuccess("");

    if (!verificationCode.trim()) {
      setError("Informe o codigo de verificacao.");
      return;
    }

    confirmMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Conta</Text>
        <Text style={styles.subtitle}>Altere username, email e senha com confirmacao por codigo.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Novo Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite o novo username"
            placeholderTextColor={theme.colors.mutedText}
            value={newUsername}
            onChangeText={setNewUsername}
            editable={!loading}
            autoCapitalize="none"
            maxLength={255}
          />

          <Text style={styles.label}>Novo Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite o novo email"
            placeholderTextColor={theme.colors.mutedText}
            value={newEmail}
            onChangeText={setNewEmail}
            editable={!loading}
            autoCapitalize="none"
            keyboardType="email-address"
            maxLength={255}
          />

          <Text style={styles.label}>Nova Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a nova senha"
            placeholderTextColor={theme.colors.mutedText}
            value={newPassword}
            onChangeText={setNewPassword}
            editable={!loading}
            secureTextEntry
            maxLength={255}
          />

          <Pressable
            style={[styles.button, styles.buttonSecondary, loading && styles.buttonDisabled]}
            onPress={handleRequestCode}
            disabled={loading}
          >
            {requestMutation.isPending ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <Text style={styles.buttonSecondaryText}>Enviar Codigo</Text>
            )}
          </Pressable>

          <Text style={styles.label}>Codigo de Verificacao</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite o codigo recebido"
            placeholderTextColor={theme.colors.mutedText}
            value={verificationCode}
            onChangeText={setVerificationCode}
            editable={!loading}
            keyboardType="number-pad"
            maxLength={6}
          />

          <Pressable
            style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}
            onPress={handleConfirmCode}
            disabled={loading}
          >
            {confirmMutation.isPending ? (
              <ActivityIndicator color={theme.colors.buttonText} />
            ) : (
              <Text style={styles.buttonPrimaryText}>Confirmar Alteracao</Text>
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <Pressable
          style={[styles.button, styles.buttonSecondary, loading && styles.buttonDisabled]}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.buttonSecondaryText}>Voltar</Text>
        </Pressable>
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
    scrollContent: {
      padding: 16,
      gap: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      color: theme.colors.mutedText,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    label: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 14,
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
