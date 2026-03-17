import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";
import { api } from "@/app/config/api";

type Exercicio = {
  exercise_id: string;
  nome: string;
  nome_en: string;
  gif_url: string | null;
  score: number;
  musculos: string[];
  equipamentos: string[];
};

type ExercicioResponse = {
  exercicios: Exercicio[];
};

type ExercicioCustomizado = {
  id_exercicio_customizado: number;
  nome: string;
  equipamento: string | null;
  musculo_alvo: string | null;
  img_url: string | null;
};

type ExercicioCustomizadoResponse = {
  exercicios: ExercicioCustomizado[];
};

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

type WorkoutSetDraft = {
  id: string;
  numero: number;
  anteriorKg: number | null;
  anteriorReps: number | null;
  kg: string;
  reps: string;
  concluido: boolean;
};

type WorkoutExerciseDraft = WorkoutExercisePayload & {
  uid: string;
  anotacao: string;
  series: WorkoutSetDraft[];
};

type WorkoutDraft = {
  selected_api_items?: Exercicio[];
  selected_custom_items?: ExercicioCustomizado[];
  series_data?: WorkoutExerciseDraft[] | WorkoutExercisePayload[] | unknown;
  elapsed_seconds?: number;
  paused?: boolean;
  updated_at?: string;
};

type RepeatWorkoutListItem = {
  treino_id: number;
  data: string;
  duracao: number;
  peso_total: number;
  total_series: number;
  total_exercicios: number;
};

type RepeatWorkoutListResponse = {
  treinos: RepeatWorkoutListItem[];
  meta: {
    count: number;
    limit: number;
  };
};

type RepeatWorkoutTemplateExercise = {
  source: "api" | "custom";
  exercise_id: string | null;
  custom_exercise_id: number | null;
  nome: string;
  nome_en: string | null;
  gif_url: string | null;
  total_series: number;
};

type RepeatWorkoutTemplateResponse = {
  treino_id: number;
  data: string;
  exercicios: RepeatWorkoutTemplateExercise[];
};

const WORKOUT_DRAFT_KEY = "current_workout_draft_v1";
const LEGACY_WORKOUT_KEY = "current_workout_exercises_v1";

const NOISE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAJ0lEQVR4Ae3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAA4G8G9o0AAaI31xkAAAAASUVORK5CYII=";

const FILTER_IMAGE_URL =
  "https://pub-0fb9b964942445dd91ff19d7779f2131.r2.dev/media/1772134869145-4dc40590-ed2f-4fc2-aed2-c5d7a380c273-perfil_1772134868620.jpg";

const MUSCLE_FILTER_OPTIONS = [
  { key: "pectorals", label: "Peitoral" },
  { key: "upper back", label: "Costas" },
  { key: "delts", label: "Ombros" },
  { key: "biceps", label: "Braço" },
  { key: "quads", label: "Perna" },
  { key: "abs", label: "Abdomem" },
];

const EQUIPMENT_FILTER_OPTIONS = [
  { key: "barbell", label: "Barra" },
  { key: "dumbbell", label: "Halter" },
  { key: "body weight", label: "Peso corporal" },
  { key: "cable", label: "Cabo" },
  { key: "leverage machine", label: "Máquina" },
  { key: "band", label: "Elástico" },
];

const PROGRESS_GRADIENT = ["#5BE7FF", "#7C5CFF", "#FF4BD8"] as const;

export default function AdicionarTreinoScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { language } = useI18n();
  const isEn = language === "en";
  const styles = useMemo(() => createStyles(theme), [theme]);
  const buttonGradient = (theme.colors.buttonGradient ?? PROGRESS_GRADIENT) as unknown as readonly [
    string,
    string,
    ...string[],
  ];
  const negativeGradient = (theme.colors.negativeGradient ?? PROGRESS_GRADIENT) as unknown as readonly [
    string,
    string,
    ...string[],
  ];
  const [query, setQuery] = useState("");
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedApiItems, setSelectedApiItems] = useState<Record<string, Exercicio>>({});
  const [selectedCustomIds, setSelectedCustomIds] = useState<Set<number>>(new Set());
  const [selectedCustomItems, setSelectedCustomItems] = useState<Record<number, ExercicioCustomizado>>({});
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showMuscleModal, setShowMuscleModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showRepeatWorkoutModal, setShowRepeatWorkoutModal] = useState(false);
  const [customExercises, setCustomExercises] = useState<ExercicioCustomizado[]>([]);
  const [repeatWorkouts, setRepeatWorkouts] = useState<RepeatWorkoutListItem[]>([]);
  const [loadingRepeatWorkouts, setLoadingRepeatWorkouts] = useState(false);
  const [repeatWorkoutsError, setRepeatWorkoutsError] = useState<string | null>(null);
  const [loadingRepeatTemplateId, setLoadingRepeatTemplateId] = useState<number | null>(null);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null);
  const isFirstDebounceRun = useRef(true);

  const loadExercises = useCallback(async (searchText?: string) => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setError(isEn ? "Sign in to search exercises." : "Faça login para buscar exercícios.");
        setExercicios([]);
        return;
      }

      const response = await api.get<ExercicioResponse>("/diario/exercicios", {
        params: {
          q: searchText ?? query,
          lang: language,
          muscle: muscleFilter,
          equipment: equipmentFilter,
          limit: 50,
          offset: 0,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setExercicios(response.data.exercicios ?? []);
    } catch (err) {
      console.error("Erro ao buscar exercícios:", err);
      setError(isEn ? "Error while fetching exercises." : "Erro ao buscar exercícios.");
      setExercicios([]);
    } finally {
      setLoading(false);
    }
  }, [equipmentFilter, isEn, language, muscleFilter, query]);

  useEffect(() => {
    loadExercises("").catch(() => undefined);
  }, [loadExercises]);

  useEffect(() => {
    let active = true;
    async function hydrateDraft() {
      try {
        const raw = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
        if (!raw || !active) {
          return;
        }

        const draft: WorkoutDraft = JSON.parse(raw);
        const apiItems = draft.selected_api_items ?? [];
        const customItems = draft.selected_custom_items ?? [];

        setSelectedIds(new Set(apiItems.map((item) => item.exercise_id)));
        setSelectedApiItems(Object.fromEntries(apiItems.map((item) => [item.exercise_id, item])));
        setSelectedCustomIds(new Set(customItems.map((item) => item.id_exercicio_customizado)));
        setSelectedCustomItems(Object.fromEntries(customItems.map((item) => [item.id_exercicio_customizado, item])));
      } catch {
        // ignora rascunho inválido
      } finally {
        if (active) {
          setDraftHydrated(true);
        }
      }
    }

    hydrateDraft().catch(() => setDraftHydrated(true));
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function syncDraftOnFocus() {
        try {
          const raw = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
          if (!active) return;

          if (!raw) {
            setSelectedIds(new Set());
            setSelectedApiItems({});
            setSelectedCustomIds(new Set());
            setSelectedCustomItems({});
            return;
          }

          const draft: WorkoutDraft = JSON.parse(raw);
          const apiItems = draft.selected_api_items ?? [];
          const customItems = draft.selected_custom_items ?? [];

          setSelectedIds(new Set(apiItems.map((item) => item.exercise_id)));
          setSelectedApiItems(Object.fromEntries(apiItems.map((item) => [item.exercise_id, item])));
          setSelectedCustomIds(new Set(customItems.map((item) => item.id_exercicio_customizado)));
          setSelectedCustomItems(Object.fromEntries(customItems.map((item) => [item.id_exercicio_customizado, item])));
        } catch {
          setSelectedIds(new Set());
          setSelectedApiItems({});
          setSelectedCustomIds(new Set());
          setSelectedCustomItems({});
        }
      }

      syncDraftOnFocus().catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }

    let active = true;
    async function persistDraftSelection() {
      const raw = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
      const previousDraft: WorkoutDraft = raw ? JSON.parse(raw) : {};
      if (!active) {
        return;
      }

      const nextDraft: WorkoutDraft = {
        ...previousDraft,
        selected_api_items: Object.values(selectedApiItems),
        selected_custom_items: Object.values(selectedCustomItems),
        updated_at: new Date().toISOString(),
      };

      await AsyncStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(nextDraft));
    }

    persistDraftSelection().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [draftHydrated, selectedApiItems, selectedCustomItems]);

  useEffect(() => {
    if (isFirstDebounceRun.current) {
      isFirstDebounceRun.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      loadExercises().catch(() => undefined);
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [query, muscleFilter, equipmentFilter, loadExercises]);

  const toggleSelect = (exercise: Exercicio) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(exercise.exercise_id)) {
        next.delete(exercise.exercise_id);
        setSelectedApiItems((items) => {
          const copy = { ...items };
          delete copy[exercise.exercise_id];
          return copy;
        });
      } else {
        next.add(exercise.exercise_id);
        setSelectedApiItems((items) => ({
          ...items,
          [exercise.exercise_id]: exercise,
        }));
      }
      return next;
    });
  };

  const toggleSelectCustom = (exercise: ExercicioCustomizado) => {
    setSelectedCustomIds((prev) => {
      const next = new Set(prev);
      if (next.has(exercise.id_exercicio_customizado)) {
        next.delete(exercise.id_exercicio_customizado);
        setSelectedCustomItems((items) => {
          const copy = { ...items };
          delete copy[exercise.id_exercicio_customizado];
          return copy;
        });
      } else {
        next.add(exercise.id_exercicio_customizado);
        setSelectedCustomItems((items) => ({
          ...items,
          [exercise.id_exercicio_customizado]: exercise,
        }));
      }
      return next;
    });
  };

  const renderExerciseItem = ({ item }: { item: Exercicio }) => {
    const selected = selectedIds.has(item.exercise_id);
    const muscleTags = item.musculos.length > 0 ? item.musculos.slice(0, 2) : ["Sem músculo"];
    const equipmentTags = item.equipamentos.length > 0 ? item.equipamentos.slice(0, 2) : ["Sem equipamento"];
    return (
      <LinearGradient
        colors={PROGRESS_GRADIENT}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={[styles.exerciseCardBorder, selected && styles.exerciseCardBorderSelected]}
      >
        <Pressable
          style={[styles.exerciseCard, selected && styles.exerciseCardSelected]}
          onPress={() => toggleSelect(item)}
        >
          {item.gif_url ? (
            <Image source={{ uri: item.gif_url }} style={styles.exerciseImage} />
          ) : (
            <View style={[styles.exerciseImage, styles.exerciseImagePlaceholder]}>
              <Text style={styles.exerciseImagePlaceholderText}>IMG</Text>
            </View>
          )}
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{item.nome}</Text>
            <View style={styles.tagRow}>
              {muscleTags.map((tag) => (
                <View key={`m:${item.exercise_id}:${tag}`} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
            <View style={styles.tagRow}>
              {equipmentTags.map((tag) => (
                <View key={`e:${item.exercise_id}:${tag}`} style={[styles.tagChip, styles.tagChipAlt]}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </Pressable>
      </LinearGradient>
    );
  };

  const loadCustomExercises = useCallback(async () => {
    setLoadingCustom(true);
    setCustomError(null);
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setCustomExercises([]);
        setCustomError(isEn ? "Sign in to view custom exercises." : "Faça login para ver exercícios personalizados.");
        return;
      }

      const response = await api.get<ExercicioCustomizadoResponse>("/diario/custom", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setCustomExercises(response.data.exercicios ?? []);
    } catch (err) {
      console.error("Erro ao buscar exercícios customizados:", err);
      setCustomExercises([]);
      setCustomError(isEn ? "Error loading custom exercises." : "Erro ao carregar exercícios personalizados.");
    } finally {
      setLoadingCustom(false);
    }
  }, [isEn]);

  const loadRepeatWorkouts = useCallback(async () => {
    setLoadingRepeatWorkouts(true);
    setRepeatWorkoutsError(null);
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setRepeatWorkouts([]);
        setRepeatWorkoutsError(isEn ? "Sign in to view previous workouts." : "Faça login para ver os treinos anteriores.");
        return;
      }

      const response = await api.get<RepeatWorkoutListResponse>("/diario/repetir-treino/lista", {
        params: { limit: 30 },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setRepeatWorkouts(response.data?.treinos ?? []);
    } catch (err) {
      console.error("Erro ao buscar treinos para repetir:", err);
      setRepeatWorkouts([]);
      setRepeatWorkoutsError(isEn ? "Error loading previous workouts." : "Erro ao carregar treinos anteriores.");
    } finally {
      setLoadingRepeatWorkouts(false);
    }
  }, [isEn]);

  const buildSeriesTemplate = (totalSeries: number, uid: string): WorkoutSetDraft[] => {
    const amount = Math.max(Math.floor(Number(totalSeries) || 1), 1);
    return Array.from({ length: amount }).map((_, index) => ({
      id: `${uid}-${index + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      numero: index + 1,
      anteriorKg: null,
      anteriorReps: null,
      kg: "",
      reps: "",
      concluido: false,
    }));
  };

  const handleSelectRepeatWorkout = useCallback(async (treinoId: number) => {
    setLoadingRepeatTemplateId(treinoId);
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setRepeatWorkoutsError(isEn ? "Sign in to repeat a workout." : "Faça login para repetir treino.");
        return;
      }

      const response = await api.get<RepeatWorkoutTemplateResponse>(
        `/diario/repetir-treino/template/${treinoId}`,
        {
          params: { lang: language },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const templateExercises = response.data?.exercicios ?? [];
      if (templateExercises.length === 0) {
        setRepeatWorkoutsError(isEn ? "Selected workout has no exercises." : "O treino selecionado não possui exercícios.");
        return;
      }

      const apiItems: Exercicio[] = [];
      const customItems: ExercicioCustomizado[] = [];

      const seriesData: WorkoutExerciseDraft[] = templateExercises.map((item) => {
        const uid = item.source === "api" ? `api:${item.exercise_id}` : `custom:${item.custom_exercise_id}`;
        if (item.source === "api" && item.exercise_id) {
          apiItems.push({
            exercise_id: item.exercise_id,
            nome: item.nome,
            nome_en: item.nome_en || item.nome,
            gif_url: item.gif_url,
            score: 0,
            musculos: [],
            equipamentos: [],
          });
        } else if (item.source === "custom" && item.custom_exercise_id != null) {
          customItems.push({
            id_exercicio_customizado: item.custom_exercise_id,
            nome: item.nome,
            equipamento: null,
            musculo_alvo: null,
            img_url: item.gif_url,
          });
        }

        return {
          source: item.source,
          exercise_id: item.exercise_id,
          custom_exercise_id: item.custom_exercise_id,
          nome: item.nome,
          nome_en: item.nome_en,
          gif_url: item.gif_url,
          previous_kg: null,
          previous_reps: null,
          uid,
          anotacao: "",
          series: buildSeriesTemplate(item.total_series, uid),
        };
      });

      setSelectedIds(new Set(apiItems.map((item) => item.exercise_id)));
      setSelectedApiItems(Object.fromEntries(apiItems.map((item) => [item.exercise_id, item])));
      setSelectedCustomIds(new Set(customItems.map((item) => item.id_exercicio_customizado)));
      setSelectedCustomItems(Object.fromEntries(customItems.map((item) => [item.id_exercicio_customizado, item])));

      const rawDraft = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
      const previousDraft: WorkoutDraft = rawDraft ? JSON.parse(rawDraft) : {};

      const nextDraft: WorkoutDraft = {
        ...previousDraft,
        selected_api_items: apiItems,
        selected_custom_items: customItems,
        series_data: seriesData,
        elapsed_seconds: 0,
        paused: false,
        updated_at: new Date().toISOString(),
      };

      await AsyncStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(nextDraft));
      setShowRepeatWorkoutModal(false);
      router.push("/screens/diario/AdicionarSeries");
    } catch (err) {
      console.error("Erro ao carregar template do treino:", err);
      setRepeatWorkoutsError(isEn ? "Could not load selected workout." : "Não foi possível carregar o treino selecionado.");
    } finally {
      setLoadingRepeatTemplateId(null);
    }
  }, [isEn, language, router]);

  const selectedMuscleLabel =
    MUSCLE_FILTER_OPTIONS.find((option) => option.key === muscleFilter)?.label ?? (isEn ? "Muscles" : "Músculos");
  const selectedEquipmentLabel =
    EQUIPMENT_FILTER_OPTIONS.find((option) => option.key === equipmentFilter)?.label ?? (isEn ? "Equipment" : "Equipamentos");

  const handleContinue = async () => {
    const selectedApi = Object.values(selectedApiItems).map<WorkoutExercisePayload>((item) => ({
      source: "api",
      exercise_id: item.exercise_id,
      custom_exercise_id: null,
      nome: item.nome,
      nome_en: item.nome_en,
      gif_url: item.gif_url,
      previous_kg: null,
      previous_reps: null,
    }));

    const selectedCustom = Object.values(selectedCustomItems).map<WorkoutExercisePayload>((item) => ({
      source: "custom",
      exercise_id: null,
      custom_exercise_id: item.id_exercicio_customizado,
      nome: item.nome,
      gif_url: item.img_url,
      previous_kg: null,
      previous_reps: null,
    }));

    const payload = [...selectedApi, ...selectedCustom];
    if (payload.length === 0) {
      setError(isEn ? "Select at least one exercise to continue." : "Selecione pelo menos um exercício para continuar.");
      return;
    }

    const rawDraft = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
    const previousDraft: WorkoutDraft = rawDraft ? JSON.parse(rawDraft) : {};
    const nextDraft: WorkoutDraft = {
      ...previousDraft,
      selected_api_items: Object.values(selectedApiItems),
      selected_custom_items: Object.values(selectedCustomItems),
      updated_at: new Date().toISOString(),
    };

    if (!previousDraft.series_data && payload.length > 0) {
      nextDraft.series_data = payload;
    }

    await AsyncStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(nextDraft));
    router.push("/screens/diario/AdicionarSeries");
  };

  const handleConfirmCancelWorkout = async () => {
    await AsyncStorage.multiRemove([WORKOUT_DRAFT_KEY, LEGACY_WORKOUT_KEY]);
    setShowCancelConfirmModal(false);
    router.replace("/(tabs)/diario_tab");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
    <View style={styles.container}>
      <LinearGradient
        colors={PROGRESS_GRADIENT}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.headerBorder}
      >
        <View style={styles.headerInner}>
          <Image source={{ uri: NOISE_DATA_URI }} style={styles.headerNoise} />
          <View style={styles.header}>
            <View style={styles.row}>
              <LinearGradient
                colors={negativeGradient}
                start={{ x: 0, y: 0.2 }}
                end={{ x: 1, y: 0.8 }}
                style={styles.cancelHeaderBorder}
              >
                <Pressable style={styles.cancelHeaderButton} onPress={() => setShowCancelConfirmModal(true)}>
                  <Text style={styles.cancelHeaderText}>{isEn ? "Cancel workout" : "Cancelar treino"}</Text>
                </Pressable>
              </LinearGradient>
              <LinearGradient
                colors={buttonGradient}
                start={{ x: 0, y: 0.2 }}
                end={{ x: 1, y: 0.8 }}
                style={styles.primaryButtonBorder}
              >
                <Pressable style={styles.primaryButton} onPress={() => handleContinue().catch(() => undefined)}>
                  <Text style={styles.primaryButtonText}>{isEn ? "Continue" : "Continuar"}</Text>
                </Pressable>
              </LinearGradient>
            </View>

            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => loadExercises().catch(() => undefined)}
                placeholder={isEn ? "Search exercise..." : "Pesquisar exercício..."}
                placeholderTextColor={theme.colors.mutedText}
                style={styles.searchInput}
                returnKeyType="search"
              />
            </View>

            <View style={styles.row}>
              <Pressable
                style={styles.tabButton}
                onPress={() => {
                  setShowCustomModal(true);
                  loadCustomExercises().catch(() => undefined);
                }}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="person-circle-outline" size={16} color={theme.colors.text} />
                  <Text style={styles.tabButtonText}>Personalizados</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.tabButton}
                onPress={() => {
                  setShowRepeatWorkoutModal(true);
                  loadRepeatWorkouts().catch(() => undefined);
                }}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="repeat" size={16} color={theme.colors.text} />
                  <Text style={styles.tabButtonText}>{isEn ? "Repeat workout" : "Repetir treino"}</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.rowThree}>
              <Pressable style={styles.smallButton} onPress={() => setShowMuscleModal(true)}>
                <View style={styles.buttonContentSmall}>
                  <Ionicons name="body-outline" size={14} color={theme.colors.text} />
                  <Text style={styles.smallButtonText}>{selectedMuscleLabel}</Text>
                </View>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => setShowEquipmentModal(true)}>
                <View style={styles.buttonContentSmall}>
                  <Ionicons name="barbell-outline" size={14} color={theme.colors.text} />
                  <Text style={styles.smallButtonText}>{selectedEquipmentLabel}</Text>
                </View>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => router.push("/screens/diario/CriarExercicio")}>
                <View style={styles.buttonContentSmall}>
                  <Ionicons name="add-circle-outline" size={14} color={theme.colors.text} />
                  <Text style={styles.smallButtonText}>{isEn ? "Create" : "Criar"}</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={theme.colors.button} />
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={exercicios}
          keyExtractor={(item) => item.exercise_id}
          renderItem={renderExerciseItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.stateContainer}>
              <Text style={styles.emptyText}>Nenhum exercício encontrado.</Text>
              <Text style={styles.emptyText}>{isEn ? "No exercises found." : "Nenhum exercício encontrado."}</Text>
            </View>
          }
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {selectedIds.size + selectedCustomIds.size} {isEn ? "selected" : "selecionado(s)"}
        </Text>
      </View>

      <Modal visible={showCustomModal} transparent animationType="fade" onRequestClose={() => setShowCustomModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Exercícios personalizados</Text>
              <Pressable onPress={() => setShowCustomModal(false)}>
                <Text style={styles.modalClose}>{isEn ? "Close" : "Fechar"}</Text>
              </Pressable>
            </View>

            {loadingCustom ? (
              <View style={styles.modalState}>
                <ActivityIndicator color={theme.colors.button} />
              </View>
            ) : customError ? (
              <View style={styles.modalState}>
                <Text style={styles.errorText}>{customError}</Text>
              </View>
            ) : (
              <FlatList
                data={customExercises}
                keyExtractor={(item) => String(item.id_exercicio_customizado)}
                contentContainerStyle={styles.modalList}
                ListEmptyComponent={
                  <View style={styles.modalState}>
                    <Text style={styles.emptyText}>Nenhum exercício personalizado encontrado.</Text>
                    <Text style={styles.emptyText}>{isEn ? "No custom exercises found." : "Nenhum exercício personalizado encontrado."}</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const selected = selectedCustomIds.has(item.id_exercicio_customizado);
                  const muscleTag = item.musculo_alvo || (isEn ? "No target muscle" : "Sem músculo alvo");
                  const equipmentTag = item.equipamento || (isEn ? "No equipment" : "Sem equipamento");
                  return (
                  <LinearGradient
                    colors={PROGRESS_GRADIENT}
                    start={{ x: 0, y: 0.2 }}
                    end={{ x: 1, y: 0.8 }}
                    style={[styles.exerciseCardBorder, selected && styles.exerciseCardBorderSelected]}
                  >
                    <Pressable
                      style={[styles.customRow, selected && styles.customRowSelected]}
                      onPress={() => toggleSelectCustom(item)}
                    >
                      {item.img_url ? (
                        <Image source={{ uri: item.img_url }} style={styles.customImage} />
                      ) : (
                        <View style={[styles.customImage, styles.exerciseImagePlaceholder]}>
                          <Text style={styles.exerciseImagePlaceholderText}>IMG</Text>
                        </View>
                    )}

                    <View style={styles.customInfo}>
                      <Text style={styles.customName}>{item.nome}</Text>
                      <View style={styles.tagRow}>
                        <View style={styles.tagChip}>
                          <Text style={styles.tagText}>{muscleTag}</Text>
                        </View>
                        <View style={[styles.tagChip, styles.tagChipAlt]}>
                          <Text style={styles.tagText}>{equipmentTag}</Text>
                        </View>
                      </View>
                    </View>
                    {selected ? <Text style={styles.customSelectedMark}>✓</Text> : null}
                  </Pressable>
                </LinearGradient>
                )}}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRepeatWorkoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRepeatWorkoutModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEn ? "Repeat workout" : "Repetir treino"}</Text>
              <Pressable onPress={() => setShowRepeatWorkoutModal(false)}>
                <Text style={styles.modalClose}>{isEn ? "Close" : "Fechar"}</Text>
              </Pressable>
            </View>

            {loadingRepeatWorkouts ? (
              <View style={styles.modalState}>
                <ActivityIndicator color={theme.colors.button} />
              </View>
            ) : repeatWorkoutsError ? (
              <View style={styles.modalState}>
                <Text style={styles.errorText}>{repeatWorkoutsError}</Text>
              </View>
            ) : (
              <FlatList
                data={repeatWorkouts}
                keyExtractor={(item) => String(item.treino_id)}
                contentContainerStyle={styles.modalList}
                ListEmptyComponent={
                  <View style={styles.modalState}>
                    <Text style={styles.emptyText}>
                      {isEn ? "No previous workouts found." : "Nenhum treino anterior encontrado."}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isLoadingThis = loadingRepeatTemplateId === item.treino_id;
                  return (
                    <Pressable
                      style={styles.repeatWorkoutRow}
                      onPress={() => handleSelectRepeatWorkout(item.treino_id).catch(() => undefined)}
                      disabled={loadingRepeatTemplateId != null}
                    >
                      <View style={styles.repeatWorkoutMainInfo}>
                        <Text style={styles.repeatWorkoutDate}>
                          {new Date(item.data).toLocaleDateString("pt-BR")}
                        </Text>
                        <Text style={styles.repeatWorkoutMeta}>
                          {`${item.total_exercicios} ${isEn ? "exercises" : "exercícios"} • ${item.total_series} ${isEn ? "sets" : "séries"}`}
                        </Text>
                        <Text style={styles.repeatWorkoutMeta}>
                          {`${isEn ? "Duration" : "Duração"}: ${Math.floor((item.duracao || 0) / 60)}m ${Number(item.duracao || 0) % 60}s`}
                        </Text>
                      </View>

                      {isLoadingThis ? (
                        <ActivityIndicator color={theme.colors.button} />
                      ) : (
                        <Text style={styles.repeatWorkoutSelectText}>{isEn ? "Use" : "Usar"}</Text>
                      )}
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showMuscleModal} transparent animationType="fade" onRequestClose={() => setShowMuscleModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar por músculos</Text>
              <Pressable onPress={() => setShowMuscleModal(false)}>
                <Text style={styles.modalClose}>{isEn ? "Close" : "Fechar"}</Text>
              </Pressable>
            </View>

            <FlatList
              data={MUSCLE_FILTER_OPTIONS}
              keyExtractor={(item) => item.key}
              numColumns={3}
              columnWrapperStyle={styles.filterRow}
              contentContainerStyle={styles.filterList}
              ListHeaderComponent={
                <Pressable
                  style={[styles.filterCard, !muscleFilter && styles.filterCardSelected]}
                  onPress={() => {
                    setMuscleFilter(null);
                    setShowMuscleModal(false);
                  }}
                >
                  <View style={[styles.filterImage, styles.filterClear]}>
                    <Text style={styles.filterClearText}>Todos</Text>
                  </View>
                  <Text style={styles.filterLabel}>{isEn ? "No filter" : "Sem filtro"}</Text>
                </Pressable>
              }
              renderItem={({ item }) => {
                const selected = muscleFilter === item.key;
                return (
                  <Pressable
                    style={[styles.filterCard, selected && styles.filterCardSelected]}
                    onPress={() => {
                      setMuscleFilter(item.key);
                      setShowMuscleModal(false);
                    }}
                  >
                    <Image source={{ uri: FILTER_IMAGE_URL }} style={styles.filterImage} />
                    <Text style={styles.filterLabel}>{item.label}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEquipmentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEquipmentModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar por equipamentos</Text>
              <Pressable onPress={() => setShowEquipmentModal(false)}>
                <Text style={styles.modalClose}>{isEn ? "Close" : "Fechar"}</Text>
              </Pressable>
            </View>

            <FlatList
              data={EQUIPMENT_FILTER_OPTIONS}
              keyExtractor={(item) => item.key}
              numColumns={3}
              columnWrapperStyle={styles.filterRow}
              contentContainerStyle={styles.filterList}
              ListHeaderComponent={
                <Pressable
                  style={[styles.filterCard, !equipmentFilter && styles.filterCardSelected]}
                  onPress={() => {
                    setEquipmentFilter(null);
                    setShowEquipmentModal(false);
                  }}
                >
                  <View style={[styles.filterImage, styles.filterClear]}>
                    <Text style={styles.filterClearText}>Todos</Text>
                  </View>
                  <Text style={styles.filterLabel}>{isEn ? "No filter" : "Sem filtro"}</Text>
                </Pressable>
              }
              renderItem={({ item }) => {
                const selected = equipmentFilter === item.key;
                return (
                  <Pressable
                    style={[styles.filterCard, selected && styles.filterCardSelected]}
                    onPress={() => {
                      setEquipmentFilter(item.key);
                      setShowEquipmentModal(false);
                    }}
                  >
                    <Image source={{ uri: FILTER_IMAGE_URL }} style={styles.filterImage} />
                    <Text style={styles.filterLabel}>{item.label}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={showCancelConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelConfirmModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.cancelModalCard}>
            <Text style={styles.modalTitle}>Cancelar treino?</Text>
            <Text style={styles.cancelConfirmText}>
              {isEn
                ? "If you continue, the current workout will be removed locally."
                : "Se continuar, o treino atual será removido localmente."}
            </Text>
            <View style={styles.cancelActionRow}>
              <Pressable style={styles.cancelNoButton} onPress={() => setShowCancelConfirmModal(false)}>
                <Text style={styles.cancelNoText}>{isEn ? "No" : "Não"}</Text>
              </Pressable>
              <LinearGradient
                colors={negativeGradient}
                start={{ x: 0, y: 0.2 }}
                end={{ x: 1, y: 0.8 }}
                style={styles.cancelYesBorder}
              >
                <Pressable style={styles.cancelYesButton} onPress={() => handleConfirmCancelWorkout().catch(() => undefined)}>
                  <Text style={styles.cancelYesText}>{isEn ? "Yes" : "Sim"}</Text>
                </Pressable>
              </LinearGradient>
            </View>
          </View>
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
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerBorder: {
      margin: 12,
      borderRadius: 16,
      padding: 1.5,
      shadowColor: "#FF4BD8",
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    headerInner: {
      borderRadius: 14,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      overflow: "hidden",
    },
    headerNoise: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.035,
    },
    header: {
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 10,
      backgroundColor: "transparent",
      gap: 10,
    },
    row: {
      flexDirection: "row",
      gap: 10,
    },
    rowThree: {
      flexDirection: "row",
      gap: 8,
    },
    primaryButtonBorder: {
      flex: 1,
      borderRadius: 10,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    cancelHeaderBorder: {
      flex: 1,
      borderRadius: 10,
      padding: 1.5,
      shadowColor: "#FF9500",
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    cancelHeaderButton: {
      height: 44,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    cancelHeaderText: {
      color: "#ffffff",
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    primaryButton: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    primaryButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    ghostButton: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    ghostButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    searchRow: {
      flexDirection: "row",
      gap: 8,
    },
    searchInput: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
    },
    tabButton: {
      flex: 1,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    tabButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    buttonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    smallButton: {
      flex: 1,
      height: 38,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    smallButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 12,
    },
    buttonContentSmall: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    listContent: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 10,
      paddingBottom: 80,
    },
    exerciseCardBorder: {
      borderRadius: 13,
      padding: 1.4,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    exerciseCardBorderSelected: {
      shadowOpacity: 0.45,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    exerciseCard: {
      flexDirection: "row",
      borderRadius: 12,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      padding: 10,
      gap: 10,
    },
    exerciseCardSelected: {
      backgroundColor: "rgba(30, 27, 75, 0.4)",
    },
    exerciseImage: {
      width: 84,
      height: 84,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
    },
    exerciseImagePlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    exerciseImagePlaceholderText: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 12,
    },
    exerciseInfo: {
      flex: 1,
      justifyContent: "center",
      gap: 4,
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    tagChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
      backgroundColor: "rgba(30, 27, 75, 0.35)",
    },
    tagChipAlt: {
      borderColor: "rgba(91, 231, 255, 0.35)",
      backgroundColor: "rgba(14, 116, 144, 0.25)",
    },
    tagText: {
      color: "#E0E7FF",
      fontSize: 11,
      fontWeight: "700",
    },
    exerciseName: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    exerciseMeta: {
      color: theme.colors.mutedText,
      fontSize: 13,
    },
    stateContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    errorText: {
      color: theme.colors.error,
      textAlign: "center",
    },
    emptyText: {
      color: theme.colors.mutedText,
      textAlign: "center",
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    footerText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "center",
      padding: 16,
    },
    modalCard: {
      maxHeight: "80%",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
    },
    cancelModalCard: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(124, 92, 255, 0.35)",
      backgroundColor: "rgba(11, 14, 24, 0.96)",
      padding: 16,
      gap: 10,
      alignSelf: "center",
    },
    modalHeader: {
      height: 52,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    modalClose: {
      color: theme.colors.button,
      fontWeight: "700",
    },
    modalList: {
      padding: 10,
      gap: 8,
    },
    modalState: {
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    customRow: {
      flexDirection: "row",
      gap: 10,
      borderRadius: 10,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      padding: 8,
    },
    customRowSelected: {
      backgroundColor: "rgba(30, 27, 75, 0.4)",
    },
    customImage: {
      width: 64,
      height: 64,
      borderRadius: 8,
      backgroundColor: theme.colors.inputBackground,
    },
    customInfo: {
      flex: 1,
      justifyContent: "center",
      gap: 2,
    },
    customName: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    customMeta: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    customSelectedMark: {
      color: theme.colors.button,
      fontSize: 18,
      fontWeight: "700",
      alignSelf: "center",
      marginRight: 4,
    },
    repeatWorkoutRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      padding: 10,
    },
    repeatWorkoutMainInfo: {
      flex: 1,
      gap: 3,
    },
    repeatWorkoutDate: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    repeatWorkoutMeta: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    repeatWorkoutSelectText: {
      color: theme.colors.button,
      fontSize: 14,
      fontWeight: "800",
    },
    filterList: {
      padding: 10,
      gap: 10,
    },
    filterRow: {
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 8,
    },
    filterCard: {
      width: "31%",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 6,
      gap: 8,
    },
    filterCardSelected: {
      borderColor: theme.colors.button,
      backgroundColor: theme.mode === "dark" ? "#172640" : "#e8f1ff",
    },
    filterImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.inputBackground,
    },
    filterLabel: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
    },
    filterClear: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterClearText: {
      color: theme.colors.mutedText,
      fontSize: 11,
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
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelNoText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    cancelYesBorder: {
      flex: 1,
      borderRadius: 10,
      padding: 1.5,
      shadowColor: "#FF9500",
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    cancelYesButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
    },
    cancelYesText: {
      color: "#ffffff",
      fontWeight: "800",
    },
  });
}
