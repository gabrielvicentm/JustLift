export type ConversaListItem = {
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  foto_perfil: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  last_message_is_mine: boolean;
};

export type ChatTargetUser = {
  user_id: string;
  username: string;
  nome_exibicao: string | null;
  foto_perfil: string | null;
};

export type ChatMessage = {
  id: number;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};
