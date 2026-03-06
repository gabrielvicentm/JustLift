import * as FileSystem from "expo-file-system/legacy";
import { api } from "@/app/config/api";
import { getAuthHeader } from "@/app/features/profile/service";
import type { PostCommentItem, PostDetail, PostMediaPayload, PostSummary } from "./types";

type PresignResponse = {
  key: string;
  uploadUrl: string;
  publicUrl: string | null;
};

type CreatePostPayload = {
  descricao: string;
  midias: PostMediaPayload[];
};

export async function uploadMediaToR2(
  uri: string,
  filename: string,
  contentType: string,
  size?: number,
): Promise<{ url: string; key: string }> {
  const headers = await getAuthHeader();

  const presignResponse = await api.post<PresignResponse>(
    "/media/presign",
    {
      filename,
      contentType,
      size: size ?? 0,
    },
    { headers },
  );

  const { uploadUrl, key, publicUrl } = presignResponse.data;

  const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Falha no upload para R2 (HTTP ${uploadResult.status}).`);
  }

  await api.post(
    "/media/complete",
    {
      key,
      contentType,
      size: size ?? 0,
    },
    { headers },
  );

  return {
    url: publicUrl ?? key,
    key,
  };
}

export async function createPost(payload: CreatePostPayload): Promise<PostSummary> {
  const headers = await getAuthHeader();
  const response = await api.post<{ post: PostSummary }>("/posts", payload, { headers });
  return response.data.post;
}

export async function fetchPostsByUser(userId: string): Promise<PostSummary[]> {
  const headers = await getAuthHeader();
  const response = await api.get<{ posts: PostSummary[] }>(`/posts/user/${encodeURIComponent(userId)}`, { headers });
  return response.data.posts ?? [];
}

export async function fetchPostById(postId: number): Promise<PostDetail> {
  const headers = await getAuthHeader();
  const response = await api.get<{ post: PostDetail }>(`/posts/${postId}`, { headers });
  return response.data.post;
}

export async function togglePostLike(postId: number): Promise<{ liked: boolean; likes_count: number }> {
  const headers = await getAuthHeader();
  const response = await api.post<{ liked: boolean; likes_count: number }>(`/posts/${postId}/like`, {}, { headers });
  return response.data;
}

export async function togglePostSave(postId: number): Promise<{ saved: boolean }> {
  const headers = await getAuthHeader();
  const response = await api.post<{ saved: boolean }>(`/posts/${postId}/save`, {}, { headers });
  return response.data;
}

export async function reportPost(postId: number, reason = "conteudo_inadequado") {
  const headers = await getAuthHeader();
  await api.post(`/posts/${postId}/report`, { reason }, { headers });
}

export async function createPostComment(postId: number, comentario: string): Promise<PostCommentItem> {
  const headers = await getAuthHeader();
  const response = await api.post<{ comment: PostCommentItem }>(`/posts/${postId}/comments`, { comentario }, { headers });
  return response.data.comment;
}
