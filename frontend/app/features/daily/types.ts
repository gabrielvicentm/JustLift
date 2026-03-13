export type DailyMediaPayload = {
  type: "image" | "video";
  url: string;
  key?: string | null;
  duration_seconds?: number | null;
};

export type DailyItem = {
  id: number;
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  foto_perfil: string | null;
  media_type: "image" | "video";
  media_url: string;
  media_key: string | null;
  duration_seconds: number;
  created_at: string;
  likes_count: number;
  viewer_liked: boolean;
  viewer_viewed: boolean;
};

export type DailySummary = {
  total_active: number;
  unseen_count: number;
  has_active_daily: boolean;
  has_unseen_daily: boolean;
};
