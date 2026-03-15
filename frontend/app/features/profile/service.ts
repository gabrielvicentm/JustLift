import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import * as FileSystem from "expo-file-system/legacy";
import { api } from "@/app/config/api";
import type {
  FollowListItem,
  MyProfileResponse,
  PublicProfileResponse,
  PresignResponse,
  SearchUserResponseItem,
  UpdateMyProfilePayload,
} from "./types";

export const profileKeys = {
  all: ["profile"] as const,
  me: () => ["profile", "me"] as const,
};

export async function getAuthHeader() {
  const token = await AsyncStorage.getItem("accessToken");
  if (!token) {
    throw new Error("NOT_AUTHENTICATED");
  }
  return { Authorization: `Bearer ${token}` };
}

export function getApiErrorMessage(err: unknown, context = "carregar perfil") {
  if ((err as Error).message === "NOT_AUTHENTICATED") {
    return "Faca login para continuar.";
  }

  const maybeError = err as Error;
  if (maybeError?.message && maybeError.message.trim().length > 0) {
    const axiosLike = err as AxiosError;
    if (!axiosLike.response) {
      // Ex.: falha no upload para Cloudflare/R2 ou erro de rede fora do Axios
      return maybeError.message;
    }
  }

  const axiosError = err as AxiosError<{ message?: string } | string>;

  if (!axiosError.response) {
    return `Sem conexao com o backend (${api.defaults.baseURL}).`;
  }

  const { status, data } = axiosError.response;
  if (typeof data === "string" && data.trim().length > 0) {
    return `Erro ${status}: ${data}`;
  }

  if (data && typeof data === "object" && "message" in data && data.message) {
    return String(data.message);
  }

  return `Erro ${status} ao ${context}.`;
}

export async function fetchMyProfile() {
  const headers = await getAuthHeader();
  const response = await api.get<MyProfileResponse>("/profile/me", { headers });
  return response.data;
}

export async function updateMyProfile(payload: UpdateMyProfilePayload) {
  const headers = await getAuthHeader();
  const response = await api.put("/profile/me", payload, { headers });
  return response.data;
}

export async function requestAccountChangeCode() {
  const headers = await getAuthHeader();
  const response = await api.post("/profile/account-change/request", {}, { headers });
  return response.data;
}

export async function confirmAccountChangeCode(code: string) {
  const headers = await getAuthHeader();
  const response = await api.post("/profile/account-change/confirm", { code }, { headers });
  return response.data;
}

export async function applyAccountChange(payload: {
  newUsername?: string;
  newEmail?: string;
  newPassword?: string;
}) {
  const headers = await getAuthHeader();
  const response = await api.post("/profile/account-change/apply", payload, { headers });
  return response.data;
}

export async function deleteAccount(password: string) {
  const headers = await getAuthHeader();
  const response = await api.delete("/profile/account", { headers, data: { password } });
  return response.data;
}

export async function fetchProfileByUsername(username: string) {
  const headers = await getAuthHeader();
  const response = await api.get<PublicProfileResponse>(`/profile/u/${encodeURIComponent(username)}`, {
    headers,
  });
  return response.data;
}

export async function searchUsersByUsername(query: string, limit = 20) {
  const headers = await getAuthHeader();
  const response = await api.get<SearchUserResponseItem[]>("/search/users", {
    headers,
    params: { q: query, limit },
  });
  return response.data ?? [];
}

export async function fetchFollowers(query = "", limit = 50, offset = 0) {
  const headers = await getAuthHeader();
  const response = await api.get<FollowListItem[]>("/follows/followers", {
    headers,
    params: { q: query, limit, offset },
  });
  return response.data ?? [];
}

export async function fetchFollowing(query = "", limit = 50, offset = 0) {
  const headers = await getAuthHeader();
  const response = await api.get<FollowListItem[]>("/follows/following", {
    headers,
    params: { q: query, limit, offset },
  });
  return response.data ?? [];
}

export async function removeFollowing(targetUserId: string) {
  const headers = await getAuthHeader();
  await api.delete(`/follows/following/${targetUserId}`, { headers });
}

export async function removeFollower(followerUserId: string) {
  const headers = await getAuthHeader();
  await api.delete(`/follows/followers/${followerUserId}`, { headers });
}

export async function followUser(targetUserId: string) {
  const headers = await getAuthHeader();
  await api.post(`/follows/following/${targetUserId}`, {}, { headers });
}

export async function uploadImageToR2(
  uri: string,
  filename: string,
  contentType = "image/jpeg",
  size?: number,
): Promise<string | null> {
  const headers = await getAuthHeader();

  let presignResponse;
  try {
    presignResponse = await api.post<PresignResponse>(
      "/media/presign",
      {
        filename,
        contentType,
        size: size ?? 0,
      },
      { headers },
    );
  } catch {
    throw new Error("Falha ao obter URL de upload no backend.");
  }

  const { uploadUrl, publicUrl, key } = presignResponse.data;

  let uploadResult: FileSystem.FileSystemUploadResult;
  try {
    uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch {
    throw new Error("Falha ao ler/enviar arquivo local da imagem para Cloudflare R2.");
  }

  if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Falha no upload para R2 (HTTP ${uploadResult?.status ?? "?"}).`);
  }

  try {
    await api.post(
      "/media/complete",
      {
        key,
        contentType,
        size: size ?? 0,
      },
      { headers },
    );
  } catch {
    throw new Error("Upload enviado, mas falhou ao confirmar no backend.");
  }

  return publicUrl ?? key;
}
