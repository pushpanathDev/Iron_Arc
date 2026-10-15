import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers/AuthContext";
import { userApi } from "../services/api";

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile"],
    queryFn: () => userApi.getProfile(),
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data);
      // The backend seeds a body-weight row from profile weight when none exists.
      queryClient.invalidateQueries({ queryKey: ["weights"] });
    },
  });
}
