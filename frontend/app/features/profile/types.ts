export type MyProfileResponse = {
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  biografia: string | null;
  foto_perfil: string | null;
  banner: string | null;
  is_private: boolean;
  followers_count: number;
  following_count: number;
  created_at: string;
};

export type PublicProfileResponse = MyProfileResponse & {
  is_following: boolean;
  has_pending_follow_request: boolean;
  is_me: boolean;
};

export type UpdateMyProfilePayload = {
  nome_exibicao: string;
  biografia: string;
  foto_perfil: string | null;
  banner: string | null;
  is_private?: boolean;
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

export type NotificationItem = {
  id: number;
  type: "new_follower" | "follow_request";
  follow_request_id: number | null;
  follow_request_status: "pending" | "accepted" | "rejected" | "canceled" | null;
  read_at: string | null;
  created_at: string;
  actor_id: string;
  actor_username: string;
  actor_nome_exibicao: string | null;
  actor_foto_perfil: string | null;
};

export type FollowActionResponse = {
  message: string;
  status?: "following" | "requested" | "already_requested" | "already_following";
};

type PresignResponse = {
  key: string;
  uploadUrl: string;
  publicUrl: string | null;
};

export type { PresignResponse };
