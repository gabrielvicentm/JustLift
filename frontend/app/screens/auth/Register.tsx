import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/app/config/api';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppTheme } from '@/theme/theme';
import { AxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from "expo-linear-gradient";
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { SvgXml } from "react-native-svg";

type BackendResponse = {
  message?: string;
  accessToken?: string;
  refreshToken?: string;
  google_id?: string;
};

type GoogleConfigResponse = {
  googleClientId?: string;
  message?: string;
};

const GOOGLE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><path fill='#EA4335' d='M24 9.5c3.54 0 6.7 1.23 9.2 3.25l6.86-6.86C35.98 2.57 30.39 0 24 0 14.62 0 6.5 5.38 2.44 13.22l7.98 6.2C12.36 13.09 17.69 9.5 24 9.5z'/><path fill='#4285F4' d='M46.5 24.5c0-1.57-.14-3.07-.4-4.5H24v9h12.7c-.55 2.96-2.2 5.47-4.7 7.17l7.5 5.82C43.98 37.65 46.5 31.6 46.5 24.5z'/><path fill='#34A853' d='M10.42 28.97c-.62-1.85-.62-3.85 0-5.7l-7.98-6.2C.7 20.62 0 22.49 0 24.5c0 2.01.7 3.88 2.44 6.43l7.98-6.2z'/><path fill='#FBBC05' d='M24 48c6.39 0 11.98-2.1 15.98-5.71l-7.5-5.82c-2.08 1.4-4.74 2.23-8.48 2.23-6.31 0-11.64-3.59-13.58-8.92l-7.98 6.2C6.5 42.62 14.62 48 24 48z'/></svg>";

const BACKGROUND_GRADIENT = ["#0B0E18", "#0B1022", "#120C2A"] as const;

export default function Register() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadGoogleConfig = async () => {
      try {
        const response = await api.get<GoogleConfigResponse>('/user/google/config');
        const fetchedClientId = response.data?.googleClientId?.trim() ?? '';

        if (!fetchedClientId) {
          setError('GOOGLE_CLIENT_ID vazio no backend.');
          return;
        }

        setGoogleClientId(fetchedClientId);
        GoogleSignin.configure({
          webClientId: fetchedClientId,
          scopes: ['profile', 'email'],
          offlineAccess: false,
        });
      } catch {
        setError('Nao foi possivel carregar configuracao Google do backend.');
      }
    };

    loadGoogleConfig();
  }, []);

  const saveTokens = async (accessToken?: string, refreshToken?: string) => {
    if (!accessToken) return;

    await AsyncStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      await AsyncStorage.setItem('refreshToken', refreshToken);
    }
  };

  const handleRegister = async () => {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSenha = senha.trim();

    setMessage('');
    setError('');

    if (!cleanUsername || !cleanEmail || !cleanSenha) {
      setError('Preencha username, email e senha.');
      return;
    }
    if (cleanSenha.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<BackendResponse>('/user/register', {
        username: cleanUsername,
        email: cleanEmail,
        senha: cleanSenha,
      });

      setPendingEmail(cleanEmail);
      setStep('verify');
      setMessage(response.data.message ?? 'Codigo enviado para seu email.');
    } catch (err) {
      const axiosError = err as AxiosError<BackendResponse>;
      const backendMessage = axiosError.response?.data?.message ?? 'Erro ao fazer cadastro.';
      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const cleanCode = verificationCode.trim();

    setMessage('');
    setError('');

    if (!pendingEmail || !cleanCode) {
      setError('Email e codigo sao obrigatorios.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<BackendResponse>('/user/register/verify', {
        email: pendingEmail,
        code: cleanCode,
      });

      setMessage(response.data.message ?? 'Conta criada com sucesso.');
      setTimeout(() => {
        router.replace('./Login');
      }, 800);
    } catch (err) {
      const axiosError = err as AxiosError<BackendResponse>;
      const backendMessage = axiosError.response?.data?.message ?? 'Erro ao confirmar codigo.';
      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setMessage('');
    setError('');

    if (!pendingEmail) {
      setError('Email nao encontrado para reenvio.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<BackendResponse>('/user/register/resend', {
        email: pendingEmail,
      });

      setMessage(response.data.message ?? 'Novo codigo enviado.');
    } catch (err) {
      const axiosError = err as AxiosError<BackendResponse>;
      const backendMessage = axiosError.response?.data?.message ?? 'Erro ao reenviar codigo.';
      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setMessage('');
    setError('');
    setLoading(true);

    try {
      if (!googleClientId) {
        throw new Error('GOOGLE_CLIENT_ID_MISSING');
      }

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      try {
        await GoogleSignin.signOut();
      } catch {
        // no-op
      }

      const signInResult = (await GoogleSignin.signIn()) as any;
      const idToken = signInResult?.data?.idToken ?? signInResult?.idToken;
      const googleId = signInResult?.data?.user?.id ?? signInResult?.user?.id;

      if (!idToken) {
        throw new Error('GOOGLE_TOKEN_MISSING');
      }

      const response = await api.post<BackendResponse>('/user/google/register', {
        googleIdToken: idToken,
        google_id: googleId,
        username: username.trim() || undefined,
      });

      await saveTokens(response.data.accessToken, response.data.refreshToken);
      setMessage(response.data.message ?? 'Cadastro Google realizado com sucesso.');
      router.replace('/(tabs)/home_tab');
    } catch (err: any) {
      if (err?.code === statusCodes.SIGN_IN_CANCELLED) {
        setError('Cadastro com Google cancelado.');
      } else if (err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services indisponivel.');
      } else if (err?.code === 'DEVELOPER_ERROR') {
        setError(
          'Google Sign-In mal configurado (DEVELOPER_ERROR). Verifique package name, SHA-1/SHA-256 e GOOGLE_CLIENT_ID.'
        );
      } else if (err?.message === 'GOOGLE_CLIENT_ID_MISSING') {
        setError('GOOGLE_CLIENT_ID nao configurado.');
      } else {
        const axiosError = err as AxiosError<BackendResponse>;
        const responseMessage = axiosError.response?.data?.message;
        const status = axiosError.response?.status;
        const method = axiosError.config?.method?.toUpperCase() ?? 'POST';
        const url = axiosError.config?.url ?? '/user/google/register';
        if (responseMessage) {
          setError(`${responseMessage} [${status ?? '-'} ${method} ${url}]`);
        } else if (!axiosError.response) {
          setError(`Sem conexao com o servidor (${api.defaults.baseURL}) - ${axiosError.message}.`);
        } else {
          setError(`Falha no cadastro com Google. [${status ?? '-'} ${method} ${url}]`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={BACKGROUND_GRADIENT} style={StyleSheet.absoluteFillObject} />
      <View style={styles.orbPink} />
      <View style={styles.orbBlue} />
      <View style={styles.orbPurple} />
      <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.cardBorder}
      >
      <View style={styles.card}>
        <Text style={styles.title}>Cadastrar</Text>
        <Text style={styles.subtitle}>Crie sua conta para continuar.</Text>

        {step === 'register' ? (
          <>
            <TextInput
              placeholder="Username"
              placeholderTextColor={theme.colors.mutedText}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              editable={!loading}
            />

            <TextInput
              placeholder="Email"
              placeholderTextColor={theme.colors.mutedText}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              editable={!loading}
            />

            <TextInput
              placeholder="Senha"
              placeholderTextColor={theme.colors.mutedText}
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
              style={styles.input}
              editable={!loading}
            />

            <LinearGradient
              colors={theme.colors.buttonGradient}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.buttonBorder}
            >
              <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.buttonText} />
                ) : (
                  <Text style={styles.buttonText}>Cadastrar</Text>
                )}
              </Pressable>
            </LinearGradient>

            <Pressable
              style={[styles.googleButton, loading && styles.buttonDisabled]}
              onPress={handleGoogleRegister}
              disabled={loading}
            >
              <SvgXml xml={GOOGLE_SVG} width={18} height={18} />
              <Text style={styles.googleButtonText}>Cadastrar com Google</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Digite o codigo enviado para {pendingEmail}</Text>
            <TextInput
              placeholder="Codigo de 6 digitos"
              placeholderTextColor={theme.colors.mutedText}
              keyboardType="number-pad"
              value={verificationCode}
              onChangeText={setVerificationCode}
              style={styles.input}
              editable={!loading}
            />

            <LinearGradient
              colors={theme.colors.buttonGradient}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.buttonBorder}
            >
              <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.buttonText} />
                ) : (
                  <Text style={styles.buttonText}>Confirmar codigo</Text>
                )}
              </Pressable>
            </LinearGradient>

            <Pressable
              style={[styles.secondaryButton, loading && styles.buttonDisabled]}
              onPress={handleResendCode}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Reenviar codigo</Text>
            </Pressable>

            <Pressable onPress={() => setStep('register')} disabled={loading}>
              <Text style={styles.link}>Alterar dados de cadastro</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <Pressable onPress={() => router.replace('./Login')} disabled={loading}>
          <Text style={styles.link}>Ja tem conta? Fazer login</Text>
        </Pressable>
      </View>
      </LinearGradient>
    </SafeAreaView>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
    },
    orbPink: {
      position: "absolute",
      top: -80,
      right: -50,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: "rgba(255, 75, 216, 0.25)",
    },
    orbBlue: {
      position: "absolute",
      bottom: -90,
      left: -60,
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: "rgba(91, 231, 255, 0.22)",
    },
    orbPurple: {
      position: "absolute",
      top: 120,
      left: -80,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: "rgba(124, 92, 255, 0.18)",
    },
    cardBorder: {
      borderRadius: 16,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    card: {
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      borderRadius: 14,
      padding: 20,
      gap: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
    },
    subtitle: {
      color: theme.colors.mutedText,
      marginBottom: 6,
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
    buttonBorder: {
      borderRadius: 10,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
      marginTop: 6,
    },
    button: {
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      borderRadius: 10,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderRadius: 10,
      height: 42,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: '600',
      fontSize: 14,
    },
    googleButton: {
      backgroundColor: '#ffffff',
      borderRadius: 10,
      height: 46,
      borderWidth: 1,
      borderColor: '#d9d9d9',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: "row",
      gap: 10,
    },
    googleIcon: {
      width: 18,
      height: 18,
    },
    googleButtonText: {
      color: '#1f1f1f',
      fontWeight: '700',
      fontSize: 15,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: theme.colors.buttonText,
      fontWeight: '700',
      fontSize: 16,
    },
    error: {
      color: theme.colors.error,
      fontWeight: '500',
    },
    success: {
      color: theme.colors.success,
      fontWeight: '500',
    },
    link: {
      marginTop: 6,
      textAlign: 'center',
      color: theme.colors.link,
      fontWeight: '600',
    },
  });
}
