import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
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

type PatenteRoadmapItem = {
  key: string;
  label: string;
  minPoints: number;
  pointsToNextFromHere: number;
  pointsRemaining: number;
  reached: boolean;
  isCurrent: boolean;
};

type SeasonInfo = {
  temporadaId: number;
  seasonNumber: number;
  startsAt: string;
  endsAt: string;
  remainingMs: number;
  remainingSeconds: number;
};

type PatentesResponse = {
  totalPoints: number;
  global_position: number;
  season: SeasonInfo;
  patente: PatenteProgress;
  patentes: PatenteRoadmapItem[];
  maxPointsPerWorkout: number;
  seasonDurationMonths: number;
};

type SeasonTopResult = {
  posicao: number;
  username: string;
  foto_perfil: string | null;
  total_points: number;
};

type SeasonHistoryEntry = {
  temporadaId: number;
  seasonNumber: number;
  startsAt: string;
  endsAt: string;
  myPosition: number | null;
  myPoints: number;
  top3: SeasonTopResult[];
};

type SeasonHistoryResponse = {
  temporadas: SeasonHistoryEntry[];
  meta: {
    limit: number;
    offset: number;
    count: number;
  };
};

const PATENTE_COLORS: Record<string, string> = {
  ferro: "#4B5563",
  bronze: "#B45309",
  prata: "#94A3B8",
  ouro: "#D97706",
  safira: "#1D4ED8",
  rubi: "#BE123C",
  esmeralda: "#047857",
  diamante: "#0EA5E9",
};

const NOISE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAJ0lEQVR4Ae3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAA4G8G9o0AAaI31xkAAAAASUVORK5CYII=";

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatRemainingTime(ms: number) {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}min`;
  }

  return `${hours}h ${minutes}min`;
}

function getInitial(username?: string) {
  if (!username || username.trim().length === 0) return "?";
  return username.trim().charAt(0).toUpperCase();
}

type Tab = "current" | "history";

export default function PatentesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeTab, setActiveTab] = useState<Tab>("current");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<PatentesResponse | null>(null);
  const [history, setHistory] = useState<SeasonHistoryEntry[]>([]);
  const [remainingMs, setRemainingMs] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Faça login para visualizar suas patentes.");
        setCurrent(null);
        setHistory([]);
        return;
      }

      const headers = { Authorization: `Bearer ${accessToken}` };
      const [currentResponse, historyResponse] = await Promise.all([
        api.get<PatentesResponse>("/diario/gamificacao/patentes", { headers }),
        api.get<SeasonHistoryResponse>("/diario/gamificacao/temporadas", {
          headers,
          params: { limit: 10 },
        }),
      ]);

      setCurrent(currentResponse.data);
      setHistory(historyResponse.data?.temporadas ?? []);
      setRemainingMs(Number(currentResponse.data?.season?.remainingMs || 0));
    } catch (err) {
      console.error("Erro ao carregar tela de patentes:", err);
      setError("Não foi possível carregar seus dados de patentes agora.");
      setCurrent(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => undefined);
    }, [loadData]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!current?.season?.endsAt) return undefined;

      const interval = setInterval(() => {
        const endsAtMs = new Date(current.season.endsAt).getTime();
        setRemainingMs(Math.max(endsAtMs - Date.now(), 0));
      }, 1000);

      return () => clearInterval(interval);
    }, [current?.season?.endsAt]),
  );

  const progressToNext = useMemo(() => {
    if (!current?.patentes || current.patentes.length === 0) {
      return 0;
    }

    const currentIdx = current.patentes.findIndex((item) => item.isCurrent);
    if (currentIdx < 0) return 0;

    const currentPatente = current.patentes[currentIdx];
    const nextPatente = current.patentes[currentIdx + 1] ?? null;

    if (!nextPatente) return 1;

    const range = nextPatente.minPoints - currentPatente.minPoints;
    if (range <= 0) return 0;

    const currentProgress = current.totalPoints - currentPatente.minPoints;
    return Math.min(Math.max(currentProgress / range, 0), 1);
  }, [current]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressToNext,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progressAnim, progressToNext]);

  const seasonProgress = useMemo(() => {
    if (!current?.season?.startsAt || !current?.season?.endsAt) return 0;
    const startMs = new Date(current.season.startsAt).getTime();
    const endMs = new Date(current.season.endsAt).getTime();
    const total = endMs - startMs;
    if (total <= 0) return 0;
    return Math.min(Math.max(1 - remainingMs / total, 0), 1);
  }, [current?.season?.startsAt, current?.season?.endsAt, remainingMs]);

  const seasonProgressColor = useMemo(() => {
    if (seasonProgress >= 0.75) return "#22D3EE";
    if (seasonProgress >= 0.4) return "#FBBF24";
    return "#F43F5E";
  }, [seasonProgress]);

  const seasonDateLabel = useMemo(() => {
    if (!current?.season) return "--";

    const startLabel = new Date(current.season.startsAt).toLocaleDateString("pt-BR");
    const endLabel = new Date(current.season.endsAt).toLocaleDateString("pt-BR");
    return `${startLabel} - ${endLabel}`;
  }, [current?.season]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("diary_patents_title")}</Text>
          <Pressable style={styles.infoButton} onPress={() => setShowInfo(true)}>
            <MaterialCommunityIcons name="information" size={18} color="#7FE7FF" />
          </Pressable>
        </View>

        <View style={styles.tabsRow}>
          <Pressable
            style={[styles.tabButton, activeTab === "current" && styles.tabButtonActive]}
            onPress={() => setActiveTab("current")}
          >
            <Text style={[styles.tabText, activeTab === "current" && styles.tabTextActive]}>
              Temporada Atual
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabButton, activeTab === "history" && styles.tabButtonActive]}
            onPress={() => setActiveTab("history")}
          >
            <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>
              Temporadas Passadas
            </Text>
          </Pressable>
        </View>

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
              <Pressable style={styles.retryButton} onPress={() => loadData().catch(() => undefined)}>
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            </LinearGradient>
          </View>
        ) : activeTab === "current" ? (
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <LinearGradient
              colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.gradientBorder}
            >
              <View style={styles.gradientInner}>
                <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
                <View style={styles.heroCard}>
                  <View style={styles.heroGlowPrimary} />
                  <View style={styles.heroGlowSecondary} />

                  <View style={styles.heroHeader}>
                    <View style={styles.heroIconWrap}>
                      <MaterialCommunityIcons
                        name="diamond-stone"
                        size={46}
                        color={PATENTE_COLORS[current?.patente?.key ?? ""] ?? "#A78BFA"}
                      />
                    </View>
                    <View style={styles.heroTitleBlock}>
                      <Text style={styles.heroBadge}>Temporada {current?.season?.seasonNumber ?? "--"}</Text>
                      <Text style={styles.heroTitle}>{current?.patente?.label ?? "--"}</Text>
                    </View>
                    <View style={styles.currentChip}>
                      <Text style={styles.currentChipText}>ATUAL</Text>
                    </View>
                  </View>
                  <Text style={styles.heroSubtitle}>{`Seus pontos: ${formatPoints(current?.totalPoints ?? 0)} pts`}</Text>
                  <Text style={styles.heroSubtitle}>{`Sua posição global: #${current?.global_position ?? "--"}`}</Text>

                  <View style={styles.progressBlock}>
                    <View style={styles.progressTrack}>
                      <Animated.View
                        style={[
                          styles.progressBar,
                          {
                            width: progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0%", "100%"],
                            }),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {current?.patente?.nextPatente
                        ? `${formatPoints(current.patente.pointsToNext)} pts para ${current.patente.nextPatente.label}`
                        : "Patente máxima atingida"}
                    </Text>
                  </View>

                  <View style={styles.seasonBarBlock}>
                    <View style={styles.seasonBarTrack}>
                      <View
                        style={[
                          styles.seasonBarFill,
                          {
                            width: `${seasonProgress * 100}%`,
                            backgroundColor: seasonProgressColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.seasonBarText}>Progresso da temporada</Text>
                  </View>

                  <Text style={styles.countdownText}>
                    {`Faltam ${formatRemainingTime(remainingMs)} para a Temporada ${current?.season?.seasonNumber ?? "--"} acabar`}
                  </Text>
                  <Text style={styles.seasonDateText}>{seasonDateLabel}</Text>
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
                  <Text style={styles.sectionTitle}>Escada de Patentes</Text>
                  {(current?.patentes ?? []).map((item) => {
                    const badgeColor = PATENTE_COLORS[item.key] || theme.colors.button;
                    return (
                      <View
                        key={item.key}
                        style={[
                          styles.patenteRow,
                          item.isCurrent && styles.patenteRowCurrent,
                        ]}
                      >
                        <View style={[styles.patenteColorMark, { backgroundColor: badgeColor }]} />

                        <MaterialCommunityIcons
                          name="diamond-stone"
                          size={22}
                          color={badgeColor}
                          style={styles.patenteIcon}
                        />

                        <View style={styles.patenteTextBlock}>
                          <Text style={styles.patenteLabel}>{item.label}</Text>
                          <Text style={styles.patenteThreshold}>{`A partir de ${formatPoints(item.minPoints)} pts`}</Text>
                        </View>

                        <Text style={styles.patenteStatus}>
                          {item.isCurrent
                            ? "ATUAL"
                            : item.reached
                              ? "ALCANÇADA"
                              : `${formatPoints(item.pointsRemaining)} pts`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </LinearGradient>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <LinearGradient
              colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.gradientBorder}
            >
              <View style={styles.gradientInner}>
                <View style={styles.listCard}>
                  <Text style={styles.sectionTitle}>Resultados de Temporadas</Text>
                  {history.length === 0 ? (
                    <Text style={styles.emptyText}>Ainda não há temporadas finalizadas.</Text>
                  ) : (
                    history.map((season) => (
                      <View key={season.temporadaId} style={styles.historyCard}>
                        <Text style={styles.historyTitle}>{`Temporada ${season.seasonNumber}`}</Text>
                        <Text style={styles.historyDates}>
                          {`${new Date(season.startsAt).toLocaleDateString("pt-BR")} - ${new Date(season.endsAt).toLocaleDateString("pt-BR")}`}
                        </Text>

                        <Text style={styles.historyMyResult}>
                          {season.myPosition
                            ? `Seu resultado: #${season.myPosition} • ${formatPoints(season.myPoints)} pts`
                            : "Você não pontuou nesta temporada"}
                        </Text>

                        <View style={styles.top3Block}>
                          {season.top3.map((entry) => (
                            <View key={`${season.temporadaId}_${entry.posicao}`} style={styles.top3Row}>
                              <Text style={styles.top3Position}>{`#${entry.posicao}`}</Text>

                              {entry.foto_perfil ? (
                                <Image source={{ uri: entry.foto_perfil }} style={styles.top3Avatar} />
                              ) : (
                                <View style={[styles.top3Avatar, styles.top3AvatarPlaceholder]}>
                                  <Text style={styles.top3AvatarPlaceholderText}>{getInitial(entry.username)}</Text>
                                </View>
                              )}

                              <Text style={styles.top3Username} numberOfLines={1}>{entry.username}</Text>
                              <Text style={styles.top3Points}>{`${formatPoints(entry.total_points)} pts`}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))
                  )}
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
      <Modal transparent visible={showInfo} animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <View style={styles.infoBackdrop}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Regras de Pontos</Text>
            <Text style={styles.infoText}>Cada treino soma pontos pelo volume total.</Text>
            <Text style={styles.infoText}>Regra base: 1 ponto a cada 100 de volume.</Text>
            <Text style={styles.infoText}>Teto por treino: 300 pontos.</Text>
            <Text style={styles.infoText}>Premium: 2x pontos e teto de 600 por treino.</Text>
            <Text style={styles.infoText}>As patentes são definidas pela soma total de pontos.</Text>
            <Text style={styles.infoText}>As temporadas reiniciam o ranking no fim do período.</Text>
            <Pressable style={styles.infoClose} onPress={() => setShowInfo(false)}>
              <Text style={styles.infoCloseText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
    title: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.text,
      textAlign: "center",
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    infoButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.9)",
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
    },
    tabsRow: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 4,
      gap: 4,
    },
    tabButton: {
      flex: 1,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    tabButtonActive: {
      backgroundColor: theme.colors.button,
    },
    tabText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 12,
      textAlign: "center",
    },
    tabTextActive: {
      color: theme.colors.buttonText,
    },
    stateContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      gap: 10,
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
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    retryButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
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
    heroCard: {
      backgroundColor: "transparent",
      padding: 20,
      overflow: "hidden",
      gap: 6,
    },
    heroGlowPrimary: {
      position: "absolute",
      top: -30,
      right: -22,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: "rgba(124, 92, 255, 0.45)",
    },
    heroGlowSecondary: {
      position: "absolute",
      bottom: -46,
      left: -24,
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: "rgba(91, 231, 255, 0.32)",
    },
    heroHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    heroIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 18,
      backgroundColor: "rgba(15, 23, 42, 0.7)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.2)",
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    heroTitleBlock: {
      flex: 1,
      gap: 4,
    },
    heroBadge: {
      alignSelf: "flex-start",
      backgroundColor: "rgba(255,255,255,0.12)",
      color: "#E2E8F0",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      fontWeight: "700",
      fontSize: 12,
    },
    heroTitle: {
      color: "#FFFFFF",
      fontSize: 32,
      fontWeight: "900",
      marginTop: 4,
    },
    currentChip: {
      alignSelf: "flex-start",
      backgroundColor: "rgba(124, 92, 255, 0.22)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.5)",
    },
    currentChipText: {
      color: "#EDE9FE",
      fontWeight: "800",
      fontSize: 11,
      letterSpacing: 0.6,
    },
    heroSubtitle: {
      color: "#CBD5E1",
      fontSize: 14,
      fontWeight: "600",
    },
    progressBlock: {
      marginTop: 8,
      gap: 6,
    },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.18)",
      overflow: "hidden",
    },
    progressBar: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: "#7C5CFF",
    },
    progressText: {
      color: "#E2E8F0",
      fontWeight: "700",
      fontSize: 12,
    },
    seasonBarBlock: {
      marginTop: 10,
      gap: 6,
    },
    seasonBarTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: "rgba(148, 163, 184, 0.2)",
      overflow: "hidden",
    },
    seasonBarFill: {
      height: "100%",
      borderRadius: 999,
    },
    seasonBarText: {
      color: "#A5B4FC",
      fontWeight: "700",
      fontSize: 12,
    },
    countdownText: {
      marginTop: 6,
      color: "#FDE68A",
      fontWeight: "800",
      fontSize: 13,
    },
    seasonDateText: {
      color: "#93C5FD",
      fontSize: 12,
      fontWeight: "600",
    },
    listCard: {
      backgroundColor: "transparent",
      borderRadius: 14,
      padding: 12,
      gap: 10,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    patenteRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.2)",
      backgroundColor: "rgba(2, 6, 23, 0.7)",
      paddingVertical: 12,
      paddingHorizontal: 10,
      gap: 10,
    },
    patenteRowCurrent: {
      borderColor: "rgba(124, 92, 255, 0.85)",
      borderWidth: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    patenteColorMark: {
      width: 6,
      alignSelf: "stretch",
      borderRadius: 999,
    },
    patenteIcon: {
      marginLeft: 2,
    },
    patenteTextBlock: {
      flex: 1,
      gap: 2,
    },
    patenteLabel: {
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 16,
    },
    patenteThreshold: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    patenteStatus: {
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 12,
    },
    emptyText: {
      color: theme.colors.mutedText,
      fontWeight: "600",
    },
    historyCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      padding: 12,
      gap: 8,
    },
    historyTitle: {
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 16,
    },
    historyDates: {
      color: theme.colors.mutedText,
      fontWeight: "600",
      fontSize: 12,
    },
    historyMyResult: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 13,
    },
    top3Block: {
      gap: 8,
    },
    top3Row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    top3Position: {
      width: 30,
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 13,
    },
    top3Avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    top3AvatarPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    top3AvatarPlaceholderText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 12,
    },
    top3Username: {
      flex: 1,
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 13,
    },
    infoBackdrop: {
      flex: 1,
      backgroundColor: "rgba(5, 5, 8, 0.8)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    infoCard: {
      width: "100%",
      borderRadius: 16,
      backgroundColor: "rgba(11, 14, 24, 0.95)",
      padding: 16,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.4)",
      gap: 8,
    },
    infoTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 4,
    },
    infoText: {
      color: theme.colors.mutedText,
      fontSize: 13,
      fontWeight: "600",
    },
    infoClose: {
      marginTop: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 10,
      alignItems: "center",
    },
    infoCloseText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    top3Points: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 12,
    },
    backButton: {
      height: 48,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    backButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
  });
}
