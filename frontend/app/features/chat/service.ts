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
  replyToMessageId?: number | null,
): Promise<{ targetUser: ChatTargetUser; message: ChatMessage }> {
  const headers = await getAuthHeader();
  const response = await api.post<{ targetUser: ChatTargetUser; message: ChatMessage }>(
    `/chat/${encodeURIComponent(targetUserId)}/messages`,
    { content, replyToMessageId: replyToMessageId ?? null },
    { headers },
  );

  return response.data;
}

export async function updateChatMessage(
  targetUserId: string,
  messageId: number,
  content: string,
): Promise<{ targetUser: ChatTargetUser; message: ChatMessage }> {
  const headers = await getAuthHeader();
  const response = await api.patch<{ targetUser: ChatTargetUser; message: ChatMessage }>(
    `/chat/${encodeURIComponent(targetUserId)}/messages/${messageId}`,
    { content },
    { headers },
  );

  return response.data;
}

export async function deleteChatMessageForMe(targetUserId: string, messageId: number): Promise<void> {
  const headers = await getAuthHeader();
  await api.delete(`/chat/${encodeURIComponent(targetUserId)}/messages/${messageId}/for-me`, { headers });
}

export async function deleteChatMessageForEveryone(targetUserId: string, messageId: number): Promise<void> {
  const headers = await getAuthHeader();
  await api.delete(`/chat/${encodeURIComponent(targetUserId)}/messages/${messageId}/for-everyone`, { headers });
}

export async function hideConversation(targetUserId: string): Promise<void> {
  const headers = await getAuthHeader();
  await api.post(`/conversas/${encodeURIComponent(targetUserId)}/hide`, {}, { headers });
}

export async function pinConversation(targetUserId: string): Promise<void> {
  const headers = await getAuthHeader();
  await api.post(`/conversas/${encodeURIComponent(targetUserId)}/pin`, {}, { headers });
}

export async function unpinConversation(targetUserId: string): Promise<void> {
  const headers = await getAuthHeader();
  await api.delete(`/conversas/${encodeURIComponent(targetUserId)}/pin`, { headers });
}

export async function blockConversationUser(targetUserId: string): Promise<void> {
  const headers = await getAuthHeader();
  await api.post(`/conversas/${encodeURIComponent(targetUserId)}/block`, {}, { headers });
}

export async function unblockConversationUser(targetUserId: string): Promise<void> {
  const headers = await getAuthHeader();
  await api.delete(`/conversas/${encodeURIComponent(targetUserId)}/block`, { headers });
}
