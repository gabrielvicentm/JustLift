import { useCallback, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/app/config/api";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

type PatenteProgress = {
  key: string;
  label: string;
  minPoints: number;
  pointsToNext: number;
  nextPatente: {
    key: string;
    label: string;
    minPoints: number;
  } | null;
};

type MinhaGamificacaoResponse = {
  totalPoints: number;
  global_position: number;
  patente: PatenteProgress;
};

type RankingEntry = {
  posicao: number;
  user_id: string;
  username: string;
  foto_perfil: string | null;
  total_points: number;
  patente: PatenteProgress;
};

type RankingResponse = {
  ranking: RankingEntry[];
  meta: {
    limit: number;
    count: number;
  };
};

const PODIUM_COLORS = {
  1: "#F59E0B",
  2: "#94A3B8",
  3: "#B45309",
} as const;

function getInitial(username?: string) {
  if (!username || username.trim().length === 0) return "?";
  return username.trim().charAt(0).toUpperCase();
}

export default function RankingScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myStats, setMyStats] = useState<MinhaGamificacaoResponse | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

  const loadRanking = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Faça login para visualizar o ranking.");
        setMyStats(null);
        setRanking([]);
        return;
      }

      const headers = { Authorization: `Bearer ${accessToken}` };
      const [myStatsResponse, rankingResponse] = await Promise.all([
        api.get<MinhaGamificacaoResponse>("/diario/gamificacao/me", { headers }),
        api.get<RankingResponse>("/diario/gamificacao/ranking", {
          headers,
          params: { limit: 100 },
        }),
      ]);

      setMyStats(myStatsResponse.data);
      setRanking(rankingResponse.data?.ranking ?? []);
    } catch (err) {
      console.error("Erro ao carregar ranking:", err);
      setError("Não foi possível carregar o ranking agora.");
      setMyStats(null);
      setRanking([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRanking().catch(() => undefined);
    }, [loadRanking]),
  );

  const podium = useMemo(() => {
    const first = ranking.find((item) => item.posicao === 1) ?? null;
    const second = ranking.find((item) => item.posicao === 2) ?? null;
    const third = ranking.find((item) => item.posicao === 3) ?? null;
    return { first, second, third };
  }, [ranking]);

  const rankingTop100 = useMemo(() => ranking.slice(0, 100), [ranking]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Text style={styles.title}>{t("diary_ranking_title")}</Text>

        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={theme.colors.button} />
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => loadRanking().catch(() => undefined)}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <View style={styles.myPositionCard}>
              <Text style={styles.myPositionLabel}>Sua colocação no ranking global é:</Text>
              <Text style={styles.myPositionValue}>
                #{myStats?.global_position ?? "--"}
              </Text>
              <Text style={styles.myPointsText}>
                {`Seus pontos: ${myStats?.totalPoints ?? 0}`}
              </Text>
            </View>

            <View style={styles.podiumCard}>
              <Text style={styles.sectionTitle}>Pódio</Text>
              <View style={styles.podiumRow}>
                <PodiumSlot
                  place={2}
                  entry={podium.second}
                  theme={theme}
                  height={120}
                />
                <PodiumSlot
                  place={1}
                  entry={podium.first}
                  theme={theme}
                  height={152}
                />
                <PodiumSlot
                  place={3}
                  entry={podium.third}
                  theme={theme}
                  height={106}
                />
              </View>
            </View>

            <View style={styles.listCard}>
              <Text style={styles.sectionTitle}>Top 100</Text>
              {rankingTop100.map((item) => {
                const isMe = myStats?.global_position === item.posicao;
                return (
                  <View
                    key={item.user_id}
                    style={[
                      styles.rankingRow,
                      isMe && styles.rankingRowMe,
                    ]}
                  >
                    <Text style={styles.positionText}>#{item.posicao}</Text>

                    {item.foto_perfil ? (
                      <Image source={{ uri: item.foto_perfil }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarPlaceholderText}>{getInitial(item.username)}</Text>
                      </View>
                    )}

                    <View style={styles.userBlock}>
                      <Text numberOfLines={1} style={styles.usernameText}>
                        {item.username}
                      </Text>
                      <Text style={styles.pointsText}>{`${item.total_points} pts`}</Text>
                    </View>

                    {isMe ? <Text style={styles.meBadge}>VOCÊ</Text> : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t("common_back")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type PodiumSlotProps = {
  place: 1 | 2 | 3;
  entry: RankingEntry | null;
  theme: AppTheme;
  height: number;
};

function PodiumSlot({ place, entry, theme, height }: PodiumSlotProps) {
  const medalColor = PODIUM_COLORS[place];

  return (
    <View style={stylesPodium.slot}>
      {entry?.foto_perfil ? (
        <Image source={{ uri: entry.foto_perfil }} style={stylesPodium.avatar} />
      ) : (
        <View style={[stylesPodium.avatar, stylesPodium.avatarFallback, { borderColor: theme.colors.border }]}>
          <Text style={[stylesPodium.avatarFallbackText, { color: theme.colors.text }]}>
            {getInitial(entry?.username)}
          </Text>
        </View>
      )}

      <Text style={[stylesPodium.username, { color: theme.colors.text }]} numberOfLines={1}>
        {entry?.username ?? "--"}
      </Text>

      <View style={[stylesPodium.pillar, { height, backgroundColor: medalColor }]}>
        <Text style={stylesPodium.place}>#{place}</Text>
      </View>
    </View>
  );
}

const stylesPodium = StyleSheet.create({
  slot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    maxWidth: 108,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 8,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: "700",
  },
  username: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  pillar: {
    width: "90%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  place: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 18,
  },
});

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.safeArea,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 16,
      gap: 10,
    },
    contentContainer: {
      paddingBottom: 14,
      gap: 12,
    },
    stateContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      gap: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
    },
    myPositionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      gap: 2,
      alignItems: "center",
    },
    myPositionLabel: {
      color: theme.colors.mutedText,
      fontWeight: "600",
      textAlign: "center",
    },
    myPositionValue: {
      marginTop: 2,
      fontSize: 32,
      fontWeight: "800",
      color: theme.colors.button,
    },
    myPointsText: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 13,
    },
    podiumCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      gap: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    podiumRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      minHeight: 220,
    },
    listCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      gap: 8,
    },
    rankingRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      gap: 10,
      backgroundColor: theme.colors.background,
    },
    rankingRowMe: {
      borderColor: theme.colors.button,
      backgroundColor: theme.mode === "dark" ? "#16233f" : "#eff6ff",
    },
    positionText: {
      width: 38,
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 14,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    avatarPlaceholder: {
      backgroundColor: theme.colors.inputBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarPlaceholderText: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 14,
    },
    userBlock: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    usernameText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 14,
    },
    pointsText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    meBadge: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.colors.button,
    },
    errorText: {
      color: theme.colors.error,
      textAlign: "center",
      fontWeight: "600",
    },
    retryButton: {
      height: 42,
      paddingHorizontal: 14,
      borderRadius: 9,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
    },
    retryButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    backButton: {
      marginTop: "auto",
      height: 46,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.button,
    },
    backButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
  });
}
