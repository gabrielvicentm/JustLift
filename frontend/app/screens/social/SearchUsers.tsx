import {
  getApiErrorMessage,
  searchUsersByUsername,
} from "@/app/features/profile/service";
import type { SearchUserResponseItem } from "@/app/features/profile/types";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

export default function SearchUsersScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUserResponseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const searchRequestIdRef = useRef(0);

  const runSearch = async (rawQuery: string) => {
    const q = rawQuery.trim();
    setError("");

    if (q.length < 1) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    setLoading(true);
    searchRequestIdRef.current += 1;
    const requestId = searchRequestIdRef.current;

    try {
      const users = await searchUsersByUsername(q, 20);
      if (requestId === searchRequestIdRef.current) {
        setResults(users);
      }
    } catch (err) {
      if (requestId === searchRequestIdRef.current) {
        setError(getApiErrorMessage(err, "pesquisar usuarios"));
        setResults([]);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError("");
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      runSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Pesquisar usuarios</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Digite o username"
          placeholderTextColor={theme.colors.mutedText}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => runSearch(query)}
        />

        <Pressable
          style={[styles.searchButton, loading && styles.disabled]}
          onPress={() => runSearch(query)}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={theme.colors.buttonText} /> : <Text style={styles.searchButtonText}>Buscar</Text>}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hasSearched && query.trim().length < 1 ? (
        <Text style={styles.hint}>Digite ao menos 1 caractere para pesquisar.</Text>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading && hasSearched && query.trim().length >= 1 ? (
            <Text style={styles.emptyText}>Nenhum usuario encontrado.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const avatarUri = String(item.foto_perfil || "").trim();

          return (
            <Pressable
              style={styles.resultCard}
              onPress={() => router.push(`/screens/social/${item.username}` as never)}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {(item.nome_exibicao || item.username).slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}

              <Text style={styles.resultDisplayName}>
                {item.nome_exibicao || item.username}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 10,
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "flex-start",
    },
    backButton: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
    },
    backButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    searchRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
    },
    searchButton: {
      height: 44,
      borderRadius: 10,
      minWidth: 86,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    searchButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    disabled: {
      opacity: 0.7,
    },
    error: {
      color: theme.colors.error,
      fontWeight: "500",
    },
    hint: {
      color: theme.colors.mutedText,
      fontWeight: "500",
    },
    listContent: {
      paddingBottom: 24,
      gap: 8,
    },
    emptyText: {
      color: theme.colors.mutedText,
      textAlign: "center",
      marginTop: 16,
    },
    resultCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      gap: 10,
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.inputBackground,
    },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    avatarFallbackText: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 16,
    },
    resultDisplayName: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
  });
}
