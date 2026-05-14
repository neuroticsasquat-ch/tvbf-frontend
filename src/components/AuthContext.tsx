import { createContext, useCallback, useContext, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as authApi from "@/api/auth";
import { ApiError, setCsrfToken } from "@/api/client";
import type { AuthedUser } from "@/api/types";

type AuthContextValue = {
  user: AuthedUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    displayName: string,
    inviteCode: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  const meQuery = useQuery<AuthedUser | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const user = await authApi.me();
        setCsrfToken(user.csrf_token);
        return user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setCsrfToken(null);
          return null;
        }
        throw e;
      }
    },
    staleTime: 60_000,
  });

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["me"] });
  }, [qc]);

  const loginMut = useMutation({
    mutationFn: (vars: { email: string; password: string }) => authApi.login(vars),
    onSuccess: (user) => {
      setCsrfToken(user.csrf_token);
      qc.setQueryData(["me"], user);
    },
  });
  const signupMut = useMutation({
    mutationFn: (vars: {
      email: string;
      password: string;
      display_name: string;
      invite_code: string;
    }) => authApi.signup(vars),
    onSuccess: (user) => {
      setCsrfToken(user.csrf_token);
      qc.setQueryData(["me"], user);
    },
  });
  const logoutMut = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      setCsrfToken(null);
      qc.setQueryData(["me"], null);
      qc.removeQueries({ queryKey: ["my-shows"] });
    },
  });
  const changePwMut = useMutation({
    mutationFn: (vars: { current_password: string; new_password: string }) =>
      authApi.changePassword(vars),
    onSuccess: (user) => {
      setCsrfToken(user.csrf_token);
      qc.setQueryData(["me"], user);
    },
  });
  const updateMeMut = useMutation({
    mutationFn: (vars: { display_name: string }) => authApi.updateMe(vars),
    onSuccess: (user) => {
      setCsrfToken(user.csrf_token);
      qc.setQueryData(["me"], user);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (vars: { password: string }) => authApi.deleteAccount(vars),
    onSuccess: () => {
      setCsrfToken(null);
      qc.setQueryData(["me"], null);
      qc.clear();
    },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading,
      login: async (email, password) => {
        await loginMut.mutateAsync({ email, password });
      },
      signup: async (email, password, displayName, inviteCode) => {
        await signupMut.mutateAsync({
          email,
          password,
          display_name: displayName,
          invite_code: inviteCode,
        });
      },
      logout: async () => {
        await logoutMut.mutateAsync();
      },
      changePassword: async (cur, next) => {
        await changePwMut.mutateAsync({ current_password: cur, new_password: next });
      },
      updateDisplayName: async (displayName) => {
        await updateMeMut.mutateAsync({ display_name: displayName });
      },
      deleteAccount: async (password) => {
        await deleteMut.mutateAsync({ password });
      },
      refresh,
    }),
    [
      meQuery.data,
      meQuery.isLoading,
      loginMut,
      signupMut,
      logoutMut,
      changePwMut,
      updateMeMut,
      deleteMut,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
