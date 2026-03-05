export type MyProfileResponse = {
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  biografia: string | null;
  foto_perfil: string | null;
  banner: string | null;
  followers_count: number;
  following_count: number;
  created_at: string;
};

export type PublicProfileResponse = MyProfileResponse & {
  is_following: boolean;
  is_me: boolean;
};

export type UpdateMyProfilePayload = {
  nome_exibicao: string;
  biografia: string;
  foto_perfil: string | null;
  banner: string | null;
};

export type SearchUserResponseItem = {
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  foto_perfil: string | null;
};

export type FollowListItem = {
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  foto_perfil: string | null;
  followed_at: string;
};

type PresignResponse = {
  key: string;
  uploadUrl: string;
  publicUrl: string | null;
};

export type { PresignResponse };
