export type MyProfileResponse = {
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  biografia: string | null;
  foto_perfil: string | null;
  banner: string | null;
  created_at: string;
};

export type MyPost = {
  id: number;
  user_id: string;
  data: string;
  duracao: number | null;
  peso_total: string | number | null;
  total_series: number | null;
  finalizado: boolean;
  total_exercicios: string | number;
};

export type MyPostsResponse = {
  items: MyPost[];
  meta: {
    limit: number;
    offset: number;
    count: number;
  };
};

export type UpdateMyProfilePayload = {
  nome_exibicao: string;
  biografia: string;
  foto_perfil: string | null;
  banner: string | null;
};

export type UpdateMyPostPayload = {
  data?: string;
  duracao?: number;
  finalizado?: boolean;
};

type PresignResponse = {
  key: string;
  uploadUrl: string;
  publicUrl: string | null;
};

export type { PresignResponse };
