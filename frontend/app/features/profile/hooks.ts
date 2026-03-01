import { useQuery } from "@tanstack/react-query";
import { fetchMyProfile, profileKeys } from "./service";

export function useMyProfileQuery() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchMyProfile,
  });
}
