import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";
import { api } from "@/app/config/api";

type WorkoutExercisePayload = {
  source: "api" | "custom";
  exercise_id: string | null;
  custom_exercise_id: number | null;
  nome: string;
  nome_en?: string | null;
  gif_url: string | null;
  previous_kg: number | null;
  previous_reps: number | null;
};

type WorkoutSet = {
  id: string;
  numero: number;
  anteriorKg: number | null;
  anteriorReps: number | null;
  kg: string;
  reps: string;
  concluido: boolean;
};

type PreviousSeriesInfo = {
  kg: number | null;
  repeticoes: number | null;
};

type WorkoutExercise = WorkoutExercisePayload & {
  uid: string;
  anotacao: string;
  previousSeriesByNumero: Record<number, PreviousSeriesInfo>;
  series: WorkoutSet[];
};

type LastSeriesItem = {
  source: "api" | "custom";
  exercise_id: string | null;
  custom_exercise_id: number | null;
  series: {
    numero: number;
    kg: number | null;
    repeticoes: number | null;
  }[];
};

type LastSeriesResponse = {
  items: LastSeriesItem[];
  meta: {
    count: number;
    requested_api: number;
    requested_custom: number;
  };
};

type Exercicio = {
  exercise_id: string;
  nome: string;
  nome_en: string;
  gif_url: string | null;
  score: number;
  musculos: string[];
  equipamentos: string[];
};

type ExercicioCustomizado = {
  id_exercicio_customizado: number;
  nome: string;
  equipamento: string | null;
  musculo_alvo: string | null;
  img_url: string | null;
};

type WorkoutDraft = {
  selected_api_items?: Exercicio[];
  selected_custom_items?: ExercicioCustomizado[];
  series_data?: WorkoutExercise[] | WorkoutExercisePayload[];
  elapsed_seconds?: number;
  paused?: boolean;
  updated_at?: string;
};

const WORKOUT_DRAFT_KEY = "current_workout_draft_v1";
const LEGACY_WORKOUT_KEY = "current_workout_exercises_v1";

const NOISE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAJ0lEQVR4Ae3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAA4G8G9o0AAaI31xkAAAAASUVORK5CYII=";

const PROGRESS_GRADIENT = ["#5BE7FF", "#7C5CFF", "#FF4BD8"] as const;
const PREMIUM_AD_FLAG_KEY = "show_premium_modal_after_workout";

type PremiumStatusResponse = {
  isPremium: boolean;
  premiumUpdatedAt?: string | null;
  message?: string;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function AdicionarSeriesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const buttonGradient = (theme.colors.buttonGradient ?? PROGRESS_GRADIENT) as unknown as readonly [
    string,
    string,
    ...string[],
  ];
  const negativeGradient = theme.colors.negativeGradient as unknown as readonly [
    string,
    string,
    ...string[],
  ];
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [exercicios, setExercicios] = useState<WorkoutExercise[]>([]);
  const [showExerciseMenu, setShowExerciseMenu] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [activeExerciseUid, setActiveExerciseUid] = useState<string | null>(null);
  const [reorderItems, setReorderItems] = useState<WorkoutExercise[]>([]);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isFinalizingRef = useRef(false);

  const payloadToExercise = (item: WorkoutExercisePayload, index: number): WorkoutExercise => ({
    ...item,
    uid: item.source === "api" ? `api:${item.exercise_id}` : `custom:${item.custom_exercise_id}`,
    anotacao: "",
    previousSeriesByNumero: item.previous_kg == null
      ? {}
      : {
          1: {
            kg: item.previous_kg,
            repeticoes: item.previous_reps,
          },
        },
    series: [
      {
        id: `${index}-1`,
        numero: 1,
        anteriorKg: item.previous_kg,
        anteriorReps: item.previous_reps,
        kg: "",
        reps: "",
        concluido: false,
      },
    ],
  });

  const withNormalizedSeries = (exercise: WorkoutExercise): WorkoutExercise => {
    const previousByNumero = exercise.previousSeriesByNumero ?? {};
    const normalizedSeries = (exercise.series || []).map((serie, index) => {
      const numero = index + 1;
      const previous = previousByNumero[numero];

      return {
        ...serie,
        numero,
        anteriorKg: previous?.kg ?? null,
        anteriorReps: previous?.repeticoes ?? null,
      };
    });

    if (normalizedSeries.length > 0) {
      return {
        ...exercise,
        previousSeriesByNumero: previousByNumero,
        series: normalizedSeries,
      };
    }

    const previous = previousByNumero[1];
    return {
      ...exercise,
      previousSeriesByNumero: previousByNumero,
      series: [
        {
          id: `${exercise.uid}-1-${Date.now()}`,
          numero: 1,
          anteriorKg: previous?.kg ?? null,
          anteriorReps: previous?.repeticoes ?? null,
          kg: "",
          reps: "",
          concluido: false,
        },
      ],
    };
  };

  useEffect(() => {
    let active = true;
    async function hydrate() {
      try {
        const raw = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
        const draft: WorkoutDraft = raw ? JSON.parse(raw) : {};
        if (!active) return;

        const seriesData = Array.isArray(draft.series_data) ? draft.series_data : [];
        const fromApi = (draft.selected_api_items ?? []).map<WorkoutExercisePayload>((item) => ({
          source: "api",
          exercise_id: item.exercise_id,
          custom_exercise_id: null,
          nome: item.nome,
          nome_en: item.nome_en,
          gif_url: item.gif_url,
          previous_kg: null,
          previous_reps: null,
        }));
        const fromCustom = (draft.selected_custom_items ?? []).map<WorkoutExercisePayload>((item) => ({
          source: "custom",
          exercise_id: null,
          custom_exercise_id: item.id_exercicio_customizado,
          nome: item.nome,
          gif_url: item.img_url,
          previous_kg: null,
          previous_reps: null,
        }));
        const selectedPayload = [...fromApi, ...fromCustom];
        let mapped: WorkoutExercise[] = [];

        if (
          seriesData.length > 0 &&
          seriesData.every((item) => item && typeof item === "object" && "series" in item)
        ) {
          mapped = seriesData as WorkoutExercise[];
        } else {
          mapped = selectedPayload.map(payloadToExercise);
        }

        const existingUids = new Set(mapped.map((item) => item.uid));
        const missingPayload = selectedPayload.filter((item) => {
          const uid = item.source === "api" ? `api:${item.exercise_id}` : `custom:${item.custom_exercise_id}`;
          return !existingUids.has(uid);
        });
        if (missingPayload.length > 0) {
          mapped = [...mapped, ...missingPayload.map(payloadToExercise)];
        }

        const accessToken = await AsyncStorage.getItem("accessToken");
        if (!active) return;

        const apiIds = mapped
          .filter((item) => item.source === "api" && item.exercise_id)
          .map((item) => item.exercise_id as string);
        const customIds = mapped
          .filter((item) => item.source === "custom" && item.custom_exercise_id != null)
          .map((item) => item.custom_exercise_id as number);

        if (accessToken && (apiIds.length > 0 || customIds.length > 0)) {
          try {
            const response = await api.get<LastSeriesResponse>("/diario/ultimas-series", {
              params: {
                api_ids: apiIds.join(","),
                custom_ids: customIds.join(","),
              },
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            const previousByUid = new Map<
              string,
              Record<number, PreviousSeriesInfo>
            >();

            (response.data?.items ?? []).forEach((item) => {
              const uid =
                item.source === "api"
                  ? `api:${item.exercise_id}`
                  : `custom:${item.custom_exercise_id}`;

              const perSerie = (item.series || []).reduce<Record<number, PreviousSeriesInfo>>(
                (acc, serie) => {
                  const numero = Number(serie.numero);
                  if (!Number.isFinite(numero) || numero <= 0) return acc;
                  acc[numero] = {
                    kg: serie.kg != null ? Number(serie.kg) : null,
                    repeticoes: serie.repeticoes != null ? Number(serie.repeticoes) : null,
                  };
                  return acc;
                },
                {},
              );

              previousByUid.set(uid, perSerie);
            });

            mapped = mapped.map((exercise) =>
              withNormalizedSeries({
                ...exercise,
                previousSeriesByNumero: previousByUid.get(exercise.uid) ?? exercise.previousSeriesByNumero ?? {},
              }),
            );
          } catch (err) {
            console.error("Erro ao buscar últimas séries:", err);
            mapped = mapped.map((exercise) => withNormalizedSeries(exercise));
          }
        } else {
          mapped = mapped.map((exercise) => withNormalizedSeries(exercise));
        }

        setExercicios(mapped);
        setElapsedSeconds(Number(draft.elapsed_seconds) || 0);
        setPaused(Boolean(draft.paused));
      } catch {
        setExercicios([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    hydrate().catch(() => setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (paused) return;
    const intervalId = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [paused]);

  useEffect(() => {
    if (loading || saving || isFinalizingRef.current) {
      return;
    }

    let active = true;
    async function persistDraftFromSeries() {
      const raw = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
      const previousDraft: WorkoutDraft = raw ? JSON.parse(raw) : {};
      if (!active) return;

      const nextDraft: WorkoutDraft = {
        ...previousDraft,
        series_data: exercicios,
        elapsed_seconds: elapsedSeconds,
        paused,
        updated_at: new Date().toISOString(),
      };

      await AsyncStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(nextDraft));
    }

    persistDraftFromSeries().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [elapsedSeconds, exercicios, loading, paused, saving]);

  const updateSerie = (
    exerciseUid: string,
    serieId: string,
    updater: (serie: WorkoutSet) => WorkoutSet,
  ) => {
    setExercicios((prev) =>
      prev.map((exercise) => {
        if (exercise.uid !== exerciseUid) return exercise;
        return {
          ...exercise,
          series: exercise.series.map((serie) => (serie.id === serieId ? updater(serie) : serie)),
        };
      }),
    );
  };

  const addSerie = (exerciseUid: string) => {
    setExercicios((prev) =>
      prev.map((exercise) => {
        if (exercise.uid !== exerciseUid) return exercise;
        const nextNumber = exercise.series.length + 1;
        const previous = exercise.previousSeriesByNumero[nextNumber];
        return {
          ...exercise,
          series: [
            ...exercise.series,
            {
              id: `${exerciseUid}-${nextNumber}-${Date.now()}`,
              numero: nextNumber,
              anteriorKg: previous?.kg ?? null,
              anteriorReps: previous?.repeticoes ?? null,
              kg: "",
              reps: "",
              concluido: false,
            },
          ],
        };
      }),
    );
  };

  const removeSerie = (exerciseUid: string, serieId: string) => {
    setExercicios((prev) =>
      prev.map((exercise) => {
        if (exercise.uid !== exerciseUid) return exercise;
        if (exercise.series.length <= 1) return exercise;

        const nextSeries = exercise.series.filter((serie) => serie.id !== serieId);
        return withNormalizedSeries({
          ...exercise,
          series: nextSeries,
        });
      }),
    );
  };

  const updateNote = (exerciseUid: string, value: string) => {
    setExercicios((prev) =>
      prev.map((exercise) => (exercise.uid === exerciseUid ? { ...exercise, anotacao: value } : exercise)),
    );
  };

  const openExerciseMenu = (exerciseUid: string) => {
    setActiveExerciseUid(exerciseUid);
    setShowExerciseMenu(true);
  };

  const closeExerciseMenu = () => {
    setShowExerciseMenu(false);
    setActiveExerciseUid(null);
  };

  const openReorderModal = () => {
    setReorderItems(exercicios);
    setShowReorderModal(true);
    closeExerciseMenu();
  };

  const closeReorderModal = () => {
    setShowReorderModal(false);
    setReorderItems([]);
  };

  const applyReorder = () => {
    setExercicios(reorderItems);
    closeReorderModal();
  };

  const removeExercise = () => {
    if (!activeExerciseUid) return;
    setExercicios((prev) => prev.filter((item) => item.uid !== activeExerciseUid));
    closeExerciseMenu();
  };

  const shouldShowPremiumAd = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) return false;
      const response = await api.get<PremiumStatusResponse>("/premium/status", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return !Boolean(response.data?.isPremium);
    } catch {
      return true;
    }
  };

  const handleConfirmCancelWorkout = async () => {
    isFinalizingRef.current = true;
    await AsyncStorage.multiRemove([WORKOUT_DRAFT_KEY, LEGACY_WORKOUT_KEY]);
    setShowCancelConfirmModal(false);
    setExercicios([]);
    setElapsedSeconds(0);
    setPaused(false);
    router.replace("/(tabs)/diario_tab");
  };

  const handleSaveWorkout = async () => {
    if (saving) {
      return;
    }

    setSaveError(null);
    setSaving(true);

    try {
      isFinalizingRef.current = false;
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setSaveError("Faça login para salvar o treino.");
        return;
      }

      const payload = {
        duracao: elapsedSeconds,
        finalizado: true,
        exercicios: exercicios.map((exercise) => ({
          source: exercise.source,
          exercise_id: exercise.exercise_id,
          custom_exercise_id: exercise.custom_exercise_id,
          anotacao: exercise.anotacao,
          series: exercise.series.map((serie) => ({
            numero: serie.numero,
            kg: Number(serie.kg) || 0,
            repeticoes: Number(serie.reps) || 0,
            concluido: serie.concluido,
          })),
        })),
      };

      await api.post("/diario/salvar", payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      isFinalizingRef.current = true;
      await AsyncStorage.multiRemove([WORKOUT_DRAFT_KEY, LEGACY_WORKOUT_KEY]);
      setExercicios([]);
      setElapsedSeconds(0);
      setPaused(false);
      if (await shouldShowPremiumAd()) {
        await AsyncStorage.setItem(PREMIUM_AD_FLAG_KEY, "1");
      }
      router.replace("/screens/diario/MeusTreinos");
    } catch (err) {
      console.error("Erro ao salvar treino:", err);
      setSaveError("Não foi possível salvar o treino.");
    } finally {
      setSaving(false);
    }
  };

  const metricas = useMemo(() => {
    let pesoTotal = 0;
    let seriesConcluidas = 0;

    exercicios.forEach((exercise) => {
      exercise.series.forEach((serie) => {
        if (!serie.concluido) return;
        const kg = Number(serie.kg);
        const reps = Number(serie.reps);
        if (Number.isFinite(kg) && Number.isFinite(reps)) {
          pesoTotal += kg * reps;
        }
        seriesConcluidas += 1;
      });
    });

    return {
      pesoTotal,
      seriesConcluidas,
    };
  }, [exercicios]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.stateContainer}>
        <ActivityIndicator color={theme.colors.button} />
      </View>
      </SafeAreaView>
    );
  }

  if (exercicios.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>Nenhum exercício selecionado.</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <LinearGradient
        colors={PROGRESS_GRADIENT}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.cardBorder}
      >
        <View style={styles.cardInner}>
          <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
          <View style={styles.metricsCard}>
            <View style={styles.metricsRow}>
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>Duração</Text>
                <Text style={styles.metricDuration}>{formatDuration(elapsedSeconds)}</Text>
              </View>
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>Peso total</Text>
                <Text style={styles.metricWeight}>{Math.round(metricas.pesoTotal)} kg</Text>
              </View>
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>Total de séries</Text>
                <Text style={styles.metricValue}>{metricas.seriesConcluidas}</Text>
              </View>
            </View>
            <Pressable style={styles.pauseButton} onPress={() => setPaused((prev) => !prev)}>
              <Text style={styles.pauseButtonText}>
                {paused ? "Retomar" : "Pausar"}
              </Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {exercicios.map((exercise) => (
        <LinearGradient
          key={exercise.uid}
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.cardBorder}
        >
        <View style={styles.cardInner}>
        <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
        <View style={styles.exerciseCard}>
          <View style={styles.exerciseHeader}>
            {exercise.gif_url ? (
              <Image source={{ uri: exercise.gif_url }} style={styles.exerciseImage} />
            ) : (
              <View style={[styles.exerciseImage, styles.imagePlaceholder]}>
                <Text style={styles.imagePlaceholderText}>IMG</Text>
              </View>
            )}
            <Text style={styles.exerciseName}>{exercise.nome || exercise.nome_en || ""}</Text>
            <Pressable style={styles.moreButton} onPress={() => openExerciseMenu(exercise.uid)}>
              <Text style={styles.moreIcon}>⋮</Text>
            </Pressable>
          </View>

          {exercise.series.map((serie) => (
            <View key={serie.id} style={[styles.serieRow, serie.concluido && styles.serieRowDone]}>
              <View style={styles.serieCellSmall}>
                <Text style={styles.serieLabel}>SÉRIE</Text>
                <Text style={styles.serieValue}>{serie.numero}</Text>
              </View>

              <View style={styles.serieCellLarge}>
                <Text style={styles.serieLabel}>ANTERIOR</Text>
                <Text style={styles.serieValue}>
                  {serie.anteriorKg == null
                    ? "-"
                    : `${serie.anteriorKg}${serie.anteriorReps != null ? ` x ${serie.anteriorReps}` : ""}`}
                </Text>
              </View>

              <View style={styles.serieCell}>
                <Text style={styles.serieLabel}>KG</Text>
                <TextInput
                  value={serie.kg}
                  onChangeText={(value) =>
                    updateSerie(exercise.uid, serie.id, (curr) => ({
                      ...curr,
                      kg: value.replace(/[^0-9.]/g, ""),
                    }))
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.colors.mutedText}
                  style={styles.serieInput}
                />
              </View>

              <View style={styles.serieCell}>
                <Text style={styles.serieLabel}>REPS</Text>
                <TextInput
                  value={serie.reps}
                  onChangeText={(value) =>
                    updateSerie(exercise.uid, serie.id, (curr) => ({
                      ...curr,
                      reps: value.replace(/[^0-9]/g, ""),
                    }))
                  }
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.colors.mutedText}
                  style={styles.serieInput}
                />
              </View>

              <View style={styles.serieCheckWrap}>
                <Text style={styles.serieLabel}>OK</Text>
                <Pressable
                  style={[styles.checkButton, serie.concluido && styles.checkButtonDone]}
                  onPress={() =>
                    updateSerie(exercise.uid, serie.id, (curr) => ({
                      ...curr,
                      concluido: !curr.concluido,
                    }))
                  }
                >
                  <Text style={styles.checkText}>{serie.concluido ? "✓" : ""}</Text>
                </Pressable>
              </View>

              <View style={styles.serieRemoveWrap}>
                <Text style={styles.serieLabel}>DEL</Text>
                <Pressable
                  style={[
                    styles.removeSerieButton,
                    exercise.series.length <= 1 && styles.removeSerieButtonDisabled,
                  ]}
                  onPress={() => removeSerie(exercise.uid, serie.id)}
                  disabled={exercise.series.length <= 1}
                >
                  <Text style={styles.removeSerieButtonText}>-</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable style={styles.addSerieButton} onPress={() => addSerie(exercise.uid)}>
            <Text style={styles.addSerieButtonText}>+ Adicionar Série</Text>
          </Pressable>

          <View style={styles.noteCard}>
            <TextInput
              value={exercise.anotacao}
              onChangeText={(value) => updateNote(exercise.uid, value.slice(0, 255))}
              placeholder="Adicionar uma anotação..."
              placeholderTextColor={theme.colors.mutedText}
              style={styles.noteInput}
              multiline
            />
            <Text style={styles.noteCounter}>{exercise.anotacao.length}/255</Text>
          </View>
        </View>
        </View>
        </LinearGradient>
      ))}

      <LinearGradient
        colors={PROGRESS_GRADIENT}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.actionButtonBorder}
      >
        <Pressable style={styles.addExercisesButton} onPress={() => router.push("/screens/diario/AdicionarExercicios")}>
          <Text style={styles.addExercisesButtonText}>Escolher mais exercícios</Text>
        </Pressable>
      </LinearGradient>

      <View style={styles.actionsRow}>
        <LinearGradient
          colors={negativeGradient}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.negativeButtonBorder}
        >
          <Pressable style={styles.cancelButton} onPress={() => setShowCancelConfirmModal(true)}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </LinearGradient>
        <LinearGradient
          colors={buttonGradient}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.actionButtonBorder}
        >
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={() => handleSaveWorkout().catch(() => undefined)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar treino</Text>
            )}
          </Pressable>
        </LinearGradient>
      </View>
      {saveError ? <Text style={styles.saveErrorText}>{saveError}</Text> : null}
    </ScrollView>
    <Modal visible={showExerciseMenu} transparent animationType="fade" onRequestClose={closeExerciseMenu}>
      <View style={styles.modalBackdrop}>
        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.cardBorder}
        >
          <View style={styles.cardInner}>
            <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Opções do exercício</Text>

              <Pressable style={styles.modalAction} onPress={openReorderModal}>
                <Text style={styles.modalActionText}>Alterar ordem</Text>
              </Pressable>

              <Pressable style={[styles.modalAction, styles.modalDangerAction]} onPress={removeExercise}>
                <Text style={styles.modalDangerText}>Excluir exercício</Text>
              </Pressable>

              <Pressable style={styles.modalCancel} onPress={closeExerciseMenu}>
                <Text style={styles.modalCancelText}>Fechar</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Modal>
    <Modal visible={showReorderModal} transparent animationType="fade" onRequestClose={closeReorderModal}>
      <View style={styles.modalBackdrop}>
        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.cardBorder}
        >
          <View style={styles.cardInner}>
            <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
            <View style={styles.reorderModalCard}>
              <Text style={styles.modalTitle}>Alterar ordem dos exercícios</Text>
              <Text style={styles.reorderHint}>Segure e arraste um exercício para mover.</Text>

          <DraggableFlatList
            data={reorderItems}
            keyExtractor={(item) => item.uid}
            onDragEnd={({ data }) => setReorderItems(data)}
            style={styles.reorderList}
            contentContainerStyle={styles.reorderListContent}
            renderItem={({ item, drag, isActive }: RenderItemParams<WorkoutExercise>) => (
              <Pressable
                style={[styles.reorderRow, isActive && styles.reorderRowActive]}
                onLongPress={drag}
              >
                <Text numberOfLines={1} style={styles.reorderRowText}>
                  {item.nome || item.nome_en || ""}
                </Text>
                <Text style={styles.reorderRowGrip}>☰</Text>
              </Pressable>
            )}
          />

              <View style={styles.reorderActions}>
                <Pressable style={styles.cancelNoButton} onPress={closeReorderModal}>
                  <Text style={styles.cancelNoText}>Cancelar</Text>
                </Pressable>
                <LinearGradient
                  colors={buttonGradient}
                  start={{ x: 0, y: 0.2 }}
                  end={{ x: 1, y: 0.8 }}
                  style={styles.actionButtonBorder}
                >
                  <Pressable style={styles.saveButton} onPress={applyReorder}>
                    <Text style={styles.saveButtonText}>Aplicar</Text>
                  </Pressable>
                </LinearGradient>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Modal>
    <Modal
      visible={showCancelConfirmModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowCancelConfirmModal(false)}
    >
      <View style={styles.modalBackdrop}>
        <LinearGradient
          colors={PROGRESS_GRADIENT}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.cardBorder}
        >
          <View style={styles.cardInner}>
            <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Cancelar treino?</Text>
              <Text style={styles.cancelConfirmText}>
                Se continuar, o treino atual será removido localmente.
              </Text>

              <View style={styles.cancelActionRow}>
                <Pressable style={styles.cancelNoButton} onPress={() => setShowCancelConfirmModal(false)}>
                  <Text style={styles.cancelNoText}>Não</Text>
                </Pressable>
                <LinearGradient
                  colors={negativeGradient}
                  start={{ x: 0, y: 0.2 }}
                  end={{ x: 1, y: 0.8 }}
                  style={styles.negativeButtonBorder}
                >
                  <Pressable style={styles.cancelYesButton} onPress={() => handleConfirmCancelWorkout().catch(() => undefined)}>
                    <Text style={styles.cancelYesText}>Sim</Text>
                  </Pressable>
                </LinearGradient>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Modal>
    </View>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.safeArea,
      paddingTop: 10,
      paddingBottom: 10,
    },
    screen: {
      flex: 1,
      backgroundColor: theme.mode === "dark" ? "#070b13" : theme.colors.background,
    },
    content: {
      paddingHorizontal: 14,
      paddingVertical: 18,
      gap: 14,
      paddingBottom: 28,
    },
    cardBorder: {
      borderRadius: 16,
      padding: 1.5,
      shadowColor: "#FF4BD8",
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    cardInner: {
      borderRadius: 14,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      overflow: "hidden",
    },
    noiseOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.035,
    },
    stateContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      padding: 20,
      gap: 12,
    },
    stateText: {
      color: theme.colors.text,
      fontSize: 16,
    },
    backButton: {
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    backButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    metricsCard: {
      borderRadius: 16,
      padding: 12,
      gap: 10,
      backgroundColor: "transparent",
    },
    metricsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    metricBlock: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    metricLabel: {
      color: theme.colors.mutedText,
      fontSize: 13,
      fontWeight: "600",
    },
    metricDuration: {
      color: "#3b82f6",
      fontSize: 34,
      fontWeight: "800",
    },
    metricWeight: {
      color: "#eab308",
      fontSize: 30,
      fontWeight: "800",
    },
    metricValue: {
      color: theme.colors.text,
      fontSize: 30,
      fontWeight: "800",
    },
    pauseButton: {
      alignSelf: "flex-start",
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
      backgroundColor: "rgba(11, 14, 24, 0.9)",
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    pauseButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    exerciseCard: {
      borderRadius: 16,
      padding: 12,
      gap: 10,
      backgroundColor: "transparent",
    },
    exerciseHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    exerciseImage: {
      width: 68,
      height: 68,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
    },
    imagePlaceholder: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    imagePlaceholderText: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 12,
    },
    exerciseName: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: "800",
    },
    moreIcon: {
      color: "#60a5fa",
      fontSize: 24,
      fontWeight: "700",
      paddingHorizontal: 4,
    },
    moreButton: {
      borderRadius: 8,
      paddingHorizontal: 2,
      paddingVertical: 2,
    },
    serieRow: {
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.25)",
      borderRadius: 12,
      padding: 8,
      backgroundColor: "rgba(2, 6, 23, 0.6)",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    serieRowDone: {
      backgroundColor: "rgba(34, 197, 94, 0.20)",
      borderColor: "rgba(34, 197, 94, 0.45)",
    },
    serieCell: {
      flex: 1,
      gap: 4,
    },
    serieCellSmall: {
      flex: 0.9,
      gap: 4,
    },
    serieCellLarge: {
      flex: 1.8,
      gap: 4,
    },
    serieLabel: {
      color: theme.colors.mutedText,
      fontSize: 10,
      fontWeight: "700",
      textAlign: "center",
    },
    serieValue: {
      minHeight: 38,
      borderRadius: 10,
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      color: theme.colors.text,
      textAlign: "center",
      textAlignVertical: "center",
      fontWeight: "700",
      fontSize: 12,
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    serieInput: {
      height: 38,
      borderRadius: 10,
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.25)",
      color: theme.colors.text,
      textAlign: "center",
      fontWeight: "700",
      paddingHorizontal: 6,
    },
    serieCheckWrap: {
      width: 42,
      alignItems: "center",
      gap: 4,
    },
    serieRemoveWrap: {
      width: 42,
      alignItems: "center",
      gap: 4,
    },
    checkButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.25)",
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      alignItems: "center",
      justifyContent: "center",
    },
    checkButtonDone: {
      backgroundColor: "rgba(34, 197, 94, 0.9)",
      borderColor: "rgba(34, 197, 94, 1)",
    },
    checkText: {
      color: "#ffffff",
      fontSize: 20,
      fontWeight: "800",
      lineHeight: 20,
    },
    removeSerieButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.error,
      backgroundColor: "rgba(239, 68, 68, 0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    removeSerieButtonDisabled: {
      opacity: 0.45,
      borderColor: theme.colors.border,
    },
    removeSerieButtonText: {
      color: theme.colors.error,
      fontSize: 24,
      fontWeight: "800",
      lineHeight: 24,
    },
    addSerieButton: {
      height: 46,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: "rgba(91, 231, 255, 0.6)",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.9)",
    },
    addSerieButtonText: {
      color: "#5BE7FF",
      fontSize: 24,
      fontWeight: "700",
    },
    noteCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.25)",
      backgroundColor: "rgba(2, 6, 23, 0.6)",
      padding: 10,
      gap: 6,
    },
    noteInput: {
      minHeight: 70,
      color: theme.colors.text,
      fontSize: 16,
      textAlignVertical: "top",
    },
    noteCounter: {
      alignSelf: "flex-end",
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    actionButtonBorder: {
      flex: 1,
      borderRadius: 12,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    negativeButtonBorder: {
      flex: 1,
      borderRadius: 12,
      padding: 1.5,
      shadowColor: "#FF9500",
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    addExercisesButton: {
      height: 46,
      borderRadius: 12,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    addExercisesButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 15,
    },
    cancelButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    cancelButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    saveButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonDisabled: {
      opacity: 0.8,
    },
    saveButtonText: {
      color: "#ffffff",
      fontWeight: "800",
      fontSize: 16,
    },
    saveErrorText: {
      color: theme.colors.error,
      fontWeight: "600",
      marginTop: 4,
      textAlign: "center",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    modalCard: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
      backgroundColor: "rgba(11, 14, 24, 0.96)",
      padding: 12,
      gap: 8,
    },
    reorderModalCard: {
      width: "100%",
      maxWidth: 380,
      maxHeight: "80%",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
      backgroundColor: "rgba(11, 14, 24, 0.96)",
      padding: 12,
      gap: 8,
    },
    modalTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 2,
    },
    reorderHint: {
      color: theme.colors.mutedText,
      fontSize: 13,
      marginBottom: 2,
    },
    reorderList: {
      maxHeight: 360,
    },
    reorderListContent: {
      gap: 8,
      paddingVertical: 2,
    },
    reorderRow: {
      minHeight: 50,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      gap: 10,
    },
    reorderRowActive: {
      borderColor: "#3b82f6",
      backgroundColor: theme.colors.surface,
    },
    reorderRowText: {
      flex: 1,
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 14,
    },
    reorderRowGrip: {
      color: theme.colors.mutedText,
      fontSize: 18,
      fontWeight: "700",
    },
    reorderActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    modalAction: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.25)",
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(15, 23, 42, 0.9)",
    },
    modalActionText: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 15,
    },
    modalDangerAction: {
      borderColor: theme.colors.error,
    },
    modalDangerText: {
      color: theme.colors.error,
      fontWeight: "700",
      fontSize: 15,
    },
    modalCancel: {
      minHeight: 42,
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.25)",
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      marginTop: 2,
    },
    modalCancelText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    cancelConfirmText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      marginBottom: 6,
    },
    cancelActionRow: {
      flexDirection: "row",
      gap: 8,
    },
    cancelNoButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.25)",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    cancelNoText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    cancelYesButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.error,
      backgroundColor: theme.colors.error,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelYesText: {
      color: "#ffffff",
      fontWeight: "800",
    },
  });
}
