import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi, User } from "../services/api";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => userApi.getProfile(),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.deleteAccount,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
