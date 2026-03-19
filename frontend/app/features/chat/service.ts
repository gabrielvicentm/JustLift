import { api } from "@/app/config/api";
import { getAuthHeader } from "@/app/features/profile/service";
import type { ChatMessage, ChatTargetUser, ConversaListItem } from "./types";

export async function fetchConversas(query = "", limit = 10, offset = 0): Promise<ConversaListItem[]> {
  const headers = await getAuthHeader();
  const response = await api.get<{ conversas: ConversaListItem[] }>("/conversas", {
    headers,
    params: { q: query, limit, offset },
  });

  return response.data?.conversas ?? [];
}

export async function fetchChatMessages(
  targetUserId: string,
  limit = 20,
  offset = 0,
): Promise<{ targetUser: ChatTargetUser; messages: ChatMessage[] }> {
  const headers = await getAuthHeader();
  const response = await api.get<{ targetUser: ChatTargetUser; messages: ChatMessage[] }>(
    `/chat/${encodeURIComponent(targetUserId)}/messages`,
    {
      headers,
      params: { limit, offset },
    },
  );

  return {
    targetUser: response.data.targetUser,
    messages: response.data.messages ?? [],
  };
}

export async function sendChatMessage(
  targetUserId: string,
  content: string,
): Promise<{ targetUser: ChatTargetUser; message: ChatMessage }> {
  const headers = await getAuthHeader();
  const response = await api.post<{ targetUser: ChatTargetUser; message: ChatMessage }>(
    `/chat/${encodeURIComponent(targetUserId)}/messages`,
    { content },
    { headers },
  );

  return response.data;
}
