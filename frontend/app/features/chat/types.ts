export type ConversaListItem = {
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  foto_perfil: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  last_message_is_mine: boolean;
  is_pinned: boolean;
  pinned_at: string | null;
  is_blocked: boolean;
};

export type ChatTargetUser = {
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  foto_perfil: string | null;
  is_blocked_by_me?: boolean;
  has_blocked_me?: boolean;
};

export type ChatMessage = {
  id: number;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  deleted_for_everyone_at?: string | null;
  reply_to_message_id?: number | null;
  reply_to_content?: string | null;
  reply_to_sender_id?: string | null;
  edited_at?: string | null;
  created_at: string;
  updated_at: string;
};
