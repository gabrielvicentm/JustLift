import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useAppTheme } from "@/providers/ThemeProvider";
import { AppTheme } from "@/theme/theme";
import { getApiErrorMessage } from "@/app/features/profile/service";
import { fetchActiveDailiesByUser, markDailyViewed, toggleDailyLike } from "@/app/features/daily/service";
import type { DailyItem } from "@/app/features/daily/types";

const DEFAULT_DAILY_DURATION_SECONDS = 15;
const TICK_MS = 50;
const VIDEO_LOAD_TIMEOUT_MS = 8000;

export default function VerDayliScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userIdParam = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const userId = String(userIdParam || "").trim();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [dailies, setDailies] = useState<DailyItem[]>([]);
  const [indexAtual, setIndexAtual] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [videoPronto, setVideoPronto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingLike, setTogglingLike] = useState(false);
  const navegandoRef = useRef(false);

  const dailyAtual = dailies[indexAtual] ?? null;
  const durationMs = Math.max(
    1000,
    (dailyAtual?.duration_seconds || DEFAULT_DAILY_DURATION_SECONDS) * 1000,
  );
  const progress = Math.min(1, elapsedMs / durationMs);

  const videoSource = dailyAtual?.media_type === "video" ? { uri: dailyAtual.media_url } : null;
  const player = useVideoPlayer(videoSource, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = false;
    videoPlayer.volume = 1;
    videoPlayer.audioMixingMode = "doNotMix";
  });

  const voltarTelaAnterior = useCallback(() => {
    if (navegandoRef.current) return;
    navegandoRef.current = true;
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/home_tab");
  }, [router]);

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setError("Usuario do Daily invalido.");
        setLoading(false);
        return;
      }

      try {
        setError("");
        setLoading(true);
        const data = await fetchActiveDailiesByUser(userId);
        setDailies(data);
        setIndexAtual(0);
        setElapsedMs(0);
      } catch (err) {
        setError(getApiErrorMessage(err, "carregar Daily"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  useEffect(() => {
    if (!dailyAtual) return;
    markDailyViewed(dailyAtual.id).catch(() => null);
  }, [dailyAtual]);

  useEffect(() => {
    setElapsedMs(0);
  }, [indexAtual, dailyAtual?.id]);

  useEffect(() => {
    if (!dailyAtual) return;

    if (dailyAtual.media_type !== "video") {
      setVideoPronto(true);
      return;
    }

    setVideoPronto(player.status === "readyToPlay");
    const statusSubscription = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") {
        setVideoPronto(true);
      }
      if (status === "error") {
        setVideoPronto(false);
      }
    });
    const sourceSubscription = player.addListener("sourceLoad", () => {
      setVideoPronto(true);
    });
    const playingSubscription = player.addListener("playingChange", ({ isPlaying }) => {
      if (isPlaying) {
        setVideoPronto(true);
      }
    });

    return () => {
      statusSubscription.remove();
      sourceSubscription.remove();
      playingSubscription.remove();
    };
  }, [dailyAtual, player]);

  useEffect(() => {
    if (!dailyAtual) return;
    if (dailyAtual.media_type !== "video") return;
    if (videoPronto || pausado) return;

    const timeoutId = setTimeout(() => {
      setError("Um video demorou para carregar e foi pulado.");
      irParaIndice(indexAtual + 1);
    }, VIDEO_LOAD_TIMEOUT_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [dailyAtual, indexAtual, irParaIndice, pausado, videoPronto]);

  useEffect(() => {
    if (!dailyAtual) return;
    if (dailyAtual.media_type !== "video") return;

    try {
      player.muted = false;
      player.volume = 1;
      player.audioMixingMode = "doNotMix";
      if (pausado || !videoPronto) {
        player.pause();
      } else {
        player.play();
      }
    } catch {
      // Ignora ciclo de vida do player durante troca de story.
    }
  }, [dailyAtual, pausado, player, videoPronto]);

  const irParaIndice = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0) {
        setIndexAtual(0);
        setElapsedMs(0);
        return;
      }
      if (nextIndex >= dailies.length) {
        voltarTelaAnterior();
        return;
      }
      setIndexAtual(nextIndex);
      setElapsedMs(0);
    },
    [dailies.length, voltarTelaAnterior],
  );

  useEffect(() => {
    if (!dailyAtual || pausado) return;
    if (dailyAtual.media_type === "video" && !videoPronto) return;

    const intervalId = setInterval(() => {
      setElapsedMs((current) => current + TICK_MS);
    }, TICK_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [dailyAtual, pausado, videoPronto]);

  useEffect(() => {
    if (!dailyAtual) return;
    if (elapsedMs < durationMs) return;
    irParaIndice(indexAtual + 1);
  }, [dailyAtual, durationMs, elapsedMs, indexAtual, irParaIndice]);

  useEffect(() => {
    if (loading) return;
    if (dailies.length === 0) {
      voltarTelaAnterior();
    }
  }, [dailies.length, loading, voltarTelaAnterior]);

  const handleIrProximo = () => {
    irParaIndice(indexAtual + 1);
  };

  const handleIrAnterior = () => {
    irParaIndice(indexAtual - 1);
  };

  const handlePausarIn = () => {
    setPausado(true);
  };

  const handlePausarOut = () => {
    setPausado(false);
  };

  const handleToggleLike = async () => {
    if (!dailyAtual || togglingLike) return;

    try {
      setTogglingLike(true);
      const result = await toggleDailyLike(dailyAtual.id);
      setDailies((current) =>
        current.map((item) =>
          item.id === dailyAtual.id
            ? {
                ...item,
                viewer_liked: result.liked,
                likes_count: result.likes_count,
              }
            : item,
        ),
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "curtir Daily"));
    } finally {
      setTogglingLike(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.text} />
        <Text style={styles.loadingText}>Carregando Daily...</Text>
      </View>
    );
  }

  if (!dailyAtual) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>{error || "Sem Daily ativo para mostrar."}</Text>
        <Pressable style={styles.backButton} onPress={voltarTelaAnterior}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable style={styles.closeButton} onPress={voltarTelaAnterior}>
          <Ionicons name="close" size={20} color="#ffffff" />
        </Pressable>
        <Text style={styles.counterText}>
          {indexAtual + 1}/{dailies.length}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        {dailies.map((item, idx) => {
          const fill = idx < indexAtual ? 100 : idx === indexAtual ? progress * 100 : 0;
          return (
            <View key={item.id} style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${fill}%` }]} />
            </View>
          );
        })}
      </View>

      {dailyAtual.media_type === "image" ? (
        <Image source={{ uri: dailyAtual.media_url }} style={styles.media} />
      ) : (
        <>
          <VideoView player={player} style={styles.media} contentFit="cover" nativeControls={false} />
          {!videoPronto ? (
            <View style={styles.videoLoadingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          ) : null}
        </>
      )}

      <View style={styles.touchRow}>
        <Pressable style={styles.leftTouch} onPress={handleIrAnterior} />
        <Pressable style={styles.middleTouch} onPressIn={handlePausarIn} onPressOut={handlePausarOut} />
        <Pressable style={styles.rightTouch} onPress={handleIrProximo} />
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.authorText}>{dailyAtual.nome_exibicao || dailyAtual.username}</Text>
        <Pressable style={styles.likeButton} onPress={handleToggleLike} disabled={togglingLike}>
          <Ionicons name={dailyAtual.viewer_liked ? "heart" : "heart-outline"} size={20} color="#ffffff" />
          <Text style={styles.likeText}>{dailyAtual.likes_count}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000000",
      justifyContent: "center",
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: theme.colors.background,
      padding: 16,
    },
    loadingText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    topRow: {
      position: "absolute",
      top: 46,
      left: 16,
      right: 16,
      zIndex: 5,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#00000066",
    },
    counterText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "700",
      backgroundColor: "#00000066",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    progressContainer: {
      position: "absolute",
      top: 20,
      left: 12,
      right: 12,
      zIndex: 6,
      flexDirection: "row",
      gap: 4,
    },
    progressTrack: {
      flex: 1,
      height: 3,
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: "#ffffff33",
    },
    progressFill: {
      height: "100%",
      backgroundColor: "#ffffff",
    },
    media: {
      width: "100%",
      height: "100%",
    },
    videoLoadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#00000066",
      zIndex: 3,
    },
    touchRow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2,
      flexDirection: "row",
    },
    leftTouch: {
      flex: 0.32,
    },
    middleTouch: {
      flex: 0.36,
    },
    rightTouch: {
      flex: 0.32,
    },
    bottomRow: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 32,
      zIndex: 7,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    authorText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
      backgroundColor: "#00000066",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    likeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#00000066",
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
    },
    likeText: {
      color: "#ffffff",
      fontWeight: "700",
    },
    errorText: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 6,
      textAlign: "center",
      color: "#fecaca",
      fontWeight: "600",
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
      fontWeight: "700",
    },
  });
}
