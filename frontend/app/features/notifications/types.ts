export type NotificationType =
  | "post_like"
  | "post_save"
  | "post_comment"
  | "user_follow"
  | "follow_request"
  | "follow_accepted"
  | "comment_like"
  | "mention";

export type NotificationItem = {
  id: number;
  type: NotificationType;
  post_id: number | null;
  comment_id: number | null;
  created_at: string;
  read_at: string | null;
  actor_user_id: string;
  actor_username: string;
  actor_nome_exibicao: string | null;
  actor_foto_perfil: string | null;
  post_descricao: string | null;
};
