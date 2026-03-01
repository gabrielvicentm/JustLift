import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMyPost, fetchMyPosts, fetchMyProfile, profileKeys, updateMyPost } from "./service";
import type { UpdateMyPostPayload } from "./types";

export function useMyProfileQuery() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchMyProfile,
  });
}

export function useMyPostsQuery() {
  return useQuery({
    queryKey: profileKeys.myPosts(),
    queryFn: fetchMyPosts,
  });
}

export function useUpdateMyPostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, payload }: { postId: number; payload: UpdateMyPostPayload }) =>
      updateMyPost(postId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.myPosts() });
    },
  });
}

export function useDeleteMyPostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: number) => deleteMyPost(postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.myPosts() });
    },
  });
}
