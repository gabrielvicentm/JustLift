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
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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

type PremiumStatusResponse = {
  isPremium: boolean;
  premiumUpdatedAt?: string | null;
  message?: string;
};

const PODIUM_COLORS = {
  1: "#F59E0B",
  2: "#94A3B8",
  3: "#B45309",
} as const;

const NOISE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAJ0lEQVR4Ae3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAA4G8G9o0AAaI31xkAAAAASUVORK5CYII=";

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
  const [isPremium, setIsPremium] = useState(false);

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
      const [myStatsResponse, rankingResponse, premiumResponse] = await Promise.all([
        api.get<MinhaGamificacaoResponse>("/diario/gamificacao/me", { headers }),
        api.get<RankingResponse>("/diario/gamificacao/ranking", {
          headers,
          params: { limit: 100 },
        }),
        api.get<PremiumStatusResponse>("/premium/status", { headers }),
      ]);

      setMyStats(myStatsResponse.data);
      setRanking(rankingResponse.data?.ranking ?? []);
      setIsPremium(Boolean(premiumResponse.data?.isPremium));
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
            <LinearGradient
              colors={theme.colors.buttonGradient}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.actionButtonBorder}
            >
              <Pressable style={styles.retryButton} onPress={() => loadRanking().catch(() => undefined)}>
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            </LinearGradient>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <LinearGradient
              colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.gradientBorder}
            >
              <View style={styles.gradientInner}>
                <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
                <View style={styles.myPositionCard}>
                  <View style={styles.cardGlowPrimary} />
                  <View style={styles.cardGlowSecondary} />
                  <Text style={styles.myPositionLabel}>Sua colocação no ranking global é:</Text>
                  <Text style={styles.myPositionValue}>
                    #{myStats?.global_position ?? "--"}
                  </Text>
                  <Text style={styles.myPointsText}>
                    {`Seus pontos: ${myStats?.totalPoints ?? 0}`}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <LinearGradient
              colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.gradientBorder}
            >
              <View style={styles.gradientInner}>
                <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
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
              </View>
            </LinearGradient>

            <LinearGradient
              colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.gradientBorder}
            >
              <View style={styles.gradientInner}>
                <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
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
                          <Pressable
                            style={styles.usernameRow}
                            onPress={() => router.push(`/screens/social/${encodeURIComponent(item.username)}` as never)}
                          >
                            <Text numberOfLines={1} style={styles.usernameText}>
                              {item.username}
                            </Text>
                            {isMe && isPremium ? (
                              <MaterialCommunityIcons name="crown" size={16} color="#FDE68A" />
                            ) : null}
                          </Pressable>
                          <Text style={styles.pointsText}>{`${item.total_points} pts`}</Text>
                        </View>

                        {isMe ? <Text style={styles.meBadge}>VOCÊ</Text> : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            </LinearGradient>
          </ScrollView>
        )}

        <LinearGradient
          colors={theme.colors.buttonGradient}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.actionButtonBorder}
        >
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t("common_back")}</Text>
          </Pressable>
        </LinearGradient>
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
  const pillarGradient = useMemo(() => {
    if (place === 1) return ["#FDE68A", "#F59E0B", "#B45309"];
    if (place === 2) return ["#F8FAFC", "#CBD5E1", "#94A3B8"];
    return ["#FDE68A", "#B45309", "#92400E"];
  }, [place]);

  return (
    <View style={stylesPodium.slot}>
      <View style={[stylesPodium.avatarGlow, { shadowColor: medalColor }]}>
        {entry?.foto_perfil ? (
          <Image source={{ uri: entry.foto_perfil }} style={stylesPodium.avatar} />
        ) : (
          <View style={[stylesPodium.avatar, stylesPodium.avatarFallback, { borderColor: theme.colors.border }]}>
            <Text style={[stylesPodium.avatarFallbackText, { color: theme.colors.text }]}>
              {getInitial(entry?.username)}
            </Text>
          </View>
        )}
      </View>

      <Text style={[stylesPodium.username, { color: theme.colors.text }]} numberOfLines={1}>
        {entry?.username ?? "--"}
      </Text>

      <LinearGradient
        colors={pillarGradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[
          stylesPodium.pillar,
          {
            height,
            shadowColor: medalColor,
          },
        ]}
      >
        <Text style={stylesPodium.place}>#{place}</Text>
      </LinearGradient>
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
  },
  avatarGlow: {
    padding: 2,
    borderRadius: 30,
    marginBottom: 8,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
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
      paddingBottom: 20,
      gap: 18,
    },
    gradientBorder: {
      borderRadius: 20,
      padding: 1.6,
      shadowColor: "#FF4BD8",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
    },
    gradientInner: {
      borderRadius: 18,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      overflow: "hidden",
    },
    noiseOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.035,
    },
    cardGlowPrimary: {
      position: "absolute",
      top: -26,
      right: -12,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: "rgba(124, 92, 255, 0.45)",
    },
    cardGlowSecondary: {
      position: "absolute",
      bottom: -28,
      left: -18,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: "rgba(91, 231, 255, 0.3)",
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
      backgroundColor: "transparent",
      padding: 18,
      gap: 4,
      alignItems: "center",
    },
    myPositionLabel: {
      color: "#A5B4FC",
      fontWeight: "700",
      textAlign: "center",
    },
    myPositionValue: {
      marginTop: 4,
      fontSize: 36,
      fontWeight: "900",
      color: "#FFFFFF",
      textShadowColor: "rgba(124, 92, 255, 0.7)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    myPointsText: {
      color: "#CBD5E1",
      fontWeight: "700",
      fontSize: 13,
    },
    podiumCard: {
      backgroundColor: "transparent",
      padding: 14,
      gap: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
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
      backgroundColor: "transparent",
      borderRadius: 14,
      padding: 12,
      gap: 8,
    },
    rankingRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.2)",
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      gap: 10,
      backgroundColor: "rgba(2, 6, 23, 0.7)",
    },
    rankingRowMe: {
      borderColor: "rgba(124, 92, 255, 0.85)",
      backgroundColor: "rgba(30, 27, 75, 0.35)",
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
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
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarPlaceholderText: {
      color: "#A5B4FC",
      fontWeight: "700",
      fontSize: 14,
    },
    userBlock: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    usernameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    usernameText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 14,
    },
    pointsText: {
      color: "#93C5FD",
      fontSize: 12,
      fontWeight: "600",
    },
    meBadge: {
      fontSize: 11,
      fontWeight: "800",
      color: "#7C5CFF",
    },
    errorText: {
      color: theme.colors.error,
      textAlign: "center",
      fontWeight: "600",
    },
    actionButtonBorder: {
      borderRadius: 10,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    retryButton: {
      height: 42,
      paddingHorizontal: 14,
      borderRadius: 9,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
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
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    backButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
  });
}
