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

const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
  '1095255863830-ftbv7flv5une920gav2ppm2fmnjno9ho.apps.googleusercontent.com';

const maskToken = (token?: string) => {
  if (!token) return null;
  if (token.length <= 20) return token;
  return `${token.slice(0, 10)}...${token.slice(-10)}`;
};

export default function Login() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [identifier, setIdentifier] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('[GoogleAuth][Frontend][Login] configure:start', {
      googleClientId: GOOGLE_CLIENT_ID,
      apiBaseUrl: api.defaults.baseURL,
    });
    GoogleSignin.configure({
      webClientId: GOOGLE_CLIENT_ID,
      scopes: ['profile', 'email'],
      offlineAccess: false,
    });
    console.log('[GoogleAuth][Frontend][Login] configure:done');
  }, []);

  const saveTokens = async (accessToken?: string, refreshToken?: string) => {
    if (!accessToken) {
      return;
    }

    await AsyncStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      await AsyncStorage.setItem('refreshToken', refreshToken);
    }
  };

  const handleLogin = async () => {
    const cleanIdentifier = identifier.trim();
    const cleanSenha = senha.trim();

    setMessage('');
    setError('');

    if (!cleanIdentifier || !cleanSenha) {
      setError(t('login_error_required'));
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<BackendResponse>('/user/login', {
        identifier: cleanIdentifier,
        senha: cleanSenha,
      });

      await saveTokens(response.data.accessToken, response.data.refreshToken);

      setMessage(response.data.message ?? t('login_success_default'));
      router.replace('/(tabs)/home_tab');
    } catch (err) {
      const axiosError = err as AxiosError<BackendResponse>;
      const backendMessage =
        axiosError.response?.data?.message ??
        (!axiosError.response
          ? `Sem conexao com o servidor (${api.defaults.baseURL}).`
          : t('login_error_default'));
      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setMessage('');
    setError('');
    setLoading(true);

    try {
      console.log('[GoogleAuth][Frontend][Login] flow:start');
      if (!GOOGLE_CLIENT_ID) {
        throw new Error('GOOGLE_CLIENT_ID_MISSING');
      }

      console.log('[GoogleAuth][Frontend][Login] hasPlayServices:start');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log('[GoogleAuth][Frontend][Login] hasPlayServices:ok');

      // Forca exibicao do seletor de conta em vez de login silencioso.
      try {
        await GoogleSignin.signOut();
      } catch (signOutErr) {
        console.log('[GoogleAuth][Frontend][Login] signOut:skip', signOutErr);
      }

      console.log('[GoogleAuth][Frontend][Login] signIn:start');
      const signInResult = (await GoogleSignin.signIn()) as any;
      console.log('[GoogleAuth][Frontend][Login] signIn:rawResult', signInResult);
      const idToken = signInResult?.data?.idToken ?? signInResult?.idToken;
      const googleId = signInResult?.data?.user?.id ?? signInResult?.user?.id;
      console.log('[GoogleAuth][Frontend][Login] signIn:parsed', {
        googleId,
        idTokenLength: idToken?.length ?? 0,
        idTokenMasked: maskToken(idToken),
      });

      if (!idToken) {
        throw new Error('GOOGLE_TOKEN_MISSING');
      }

      console.log('[GoogleAuth][Frontend][Login] api:/user/google/login:start', { googleId });
      const response = await api.post<BackendResponse>('/user/google/login', {
        googleIdToken: idToken,
        google_id: googleId,
      });
      console.log('[GoogleAuth][Frontend][Login] api:/user/google/login:success', response.data);

      await saveTokens(response.data.accessToken, response.data.refreshToken);
      setMessage(response.data.message ?? 'Login Google efetuado com sucesso.');
      router.replace('/(tabs)/home_tab');
    } catch (err: any) {
      console.error('[GoogleAuth][Frontend][Login] flow:error', {
        code: err?.code,
        message: err?.message,
        stack: err?.stack,
        responseStatus: err?.response?.status,
        responseData: err?.response?.data,
      });
      if (err?.code === statusCodes.SIGN_IN_CANCELLED) {
        setError('Login com Google cancelado.');
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
        const backendMessage =
          axiosError.response?.data?.message ??
          (!axiosError.response
            ? `Sem conexao com o servidor (${api.defaults.baseURL}) - ${axiosError.message}.`
            : 'Falha no login com Google.');
        setError(backendMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('login_title')}</Text>
        <Text style={styles.subtitle}>{t('login_subtitle')}</Text>

        <TextInput
          placeholder={t('login_identifier_placeholder')}
          placeholderTextColor={theme.colors.mutedText}
          autoCapitalize="none"
          value={identifier}
          onChangeText={setIdentifier}
          style={styles.input}
          editable={!loading}
        />

        <TextInput
          placeholder={t('login_password_placeholder')}
          placeholderTextColor={theme.colors.mutedText}
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          style={styles.input}
          editable={!loading}
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.buttonText} />
          ) : (
            <Text style={styles.buttonText}>{t('login_button')}</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.googleButton, loading && styles.buttonDisabled]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          <Text style={styles.googleButtonText}>Continuar com Google</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <Pressable onPress={() => router.push('./Register')} disabled={loading}>
          <Text style={styles.link}>{t('login_no_account')}</Text>
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
