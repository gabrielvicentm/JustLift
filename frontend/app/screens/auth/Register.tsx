import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/app/config/api';
import { useI18n } from '@/providers/I18nProvider';
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
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

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

export default function Register() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t } = useI18n();
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
      setError(t('register_error_required'));
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
      const backendMessage = axiosError.response?.data?.message ?? t('register_error_default');
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
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('register_title')}</Text>
        <Text style={styles.subtitle}>{t('register_subtitle')}</Text>

        {step === 'register' ? (
          <>
            <TextInput
              placeholder={t('register_username_placeholder')}
              placeholderTextColor={theme.colors.mutedText}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              editable={!loading}
            />

            <TextInput
              placeholder={t('register_email_placeholder')}
              placeholderTextColor={theme.colors.mutedText}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              editable={!loading}
            />

            <TextInput
              placeholder={t('register_password_placeholder')}
              placeholderTextColor={theme.colors.mutedText}
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
              style={styles.input}
              editable={!loading}
            />

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.buttonText} />
              ) : (
                <Text style={styles.buttonText}>Enviar codigo</Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.googleButton, loading && styles.buttonDisabled]}
              onPress={handleGoogleRegister}
              disabled={loading}
            >
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
          <Text style={styles.link}>{t('register_has_account')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: 20,
      gap: 12,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
    button: {
      backgroundColor: theme.colors.button,
      borderRadius: 10,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
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
