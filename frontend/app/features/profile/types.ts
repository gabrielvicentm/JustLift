export type MyProfileResponse = {
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  biografia: string | null;
  foto_perfil: string | null;
  banner: string | null;
  created_at: string;
};

export type UpdateMyProfilePayload = {
  nome_exibicao: string;
  biografia: string;
  foto_perfil: string | null;
  banner: string | null;
};

type PresignResponse = {
  key: string;
  uploadUrl: string;
  publicUrl: string | null;
};

export type { PresignResponse };
