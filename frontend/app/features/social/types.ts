export type PostMediaPayload = {
  type: "image" | "video";
  url: string;
  key?: string | null;
};

export type PostMediaItem = {
  id: number;
  type: "image" | "video";
  url: string;
  key: string | null;
  media_order: number;
};

export type TreinoResumo = {
  treino_id: number;
  data: string;
  duracao: number | null;
  peso_total: number | null;
  total_series: number | null;
  total_exercicios: number | null;
  finalizado: boolean;
  exercicios?: { exercicio_treino_id: number; nome: string }[];
};

export type PostCommentItem = {
  id: number;
  post_id: number;
  user_id: string;
  username: string | null;
  nome_exibicao: string | null;
  foto_perfil: string | null;
  comentario: string;
  created_at: string;
  likes_count: number;
  viewer_liked: boolean;
};

export type PostSummary = {
  id: number;
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  foto_perfil: string | null;
  descricao: string | null;
  created_at: string;
  likes_count: number;
  saves_count: number;
  comments_count: number;
  viewer_liked: boolean;
  viewer_saved: boolean;
  midias: PostMediaItem[];
  tipo?: "normal" | "treino";
  treino?: TreinoResumo | null;
};

export type PostDetail = PostSummary & {
  comentarios: PostCommentItem[];
};
