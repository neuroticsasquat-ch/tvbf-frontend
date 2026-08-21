import { apiFetch } from "./client";
import type { AuthedUser } from "./types";

export const me = () => apiFetch<AuthedUser>("/me");

export const signup = (body: {
  email: string;
  password: string;
  display_name: string;
  /** Required (NEU-1163 §6.1). Sent as typed — the server owns the
   * normalisation, so lowercasing here would be a second copy of a rule that
   * already has one. */
  handle: string;
  invite_code: string;
  /** Optional on the wire exactly as it is in `SignupRequest`: the backend
   * decides that "verification enabled means a token is required" and answers
   * 400 `captcha_required` when one is missing (NEU-1160 §7). */
  turnstile_token?: string;
}) => apiFetch<AuthedUser>("/auth/signup", { method: "POST", body: JSON.stringify(body) });

export const login = (body: { email: string; password: string }) =>
  apiFetch<AuthedUser>("/auth/login", { method: "POST", body: JSON.stringify(body) });

export const logout = () => apiFetch<void>("/auth/logout", { method: "POST" });

export const updateMe = (body: { display_name: string }) =>
  apiFetch<AuthedUser>("/me", { method: "PATCH", body: JSON.stringify(body) });

export const changePassword = (body: { current_password: string; new_password: string }) =>
  apiFetch<AuthedUser>("/auth/password", { method: "POST", body: JSON.stringify(body) });

export const forgotPassword = (body: { email: string }) =>
  apiFetch<void>("/forgot-password", { method: "POST", body: JSON.stringify(body) });

export const resetPassword = (body: { token: string; new_password: string }) =>
  apiFetch<{ ok: boolean }>("/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const requestEmailVerification = () =>
  apiFetch<void>("/me/email/verification", { method: "POST" });

export const requestEmailChange = (body: { new_email: string; current_password: string }) =>
  apiFetch<void>("/me/email/change", { method: "POST", body: JSON.stringify(body) });

export const confirmEmailChange = (body: { token: string }) =>
  apiFetch<{ ok: boolean }>("/email-change/confirm", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const verifyEmail = (body: { token: string }) =>
  apiFetch<{ ok: boolean }>("/verify-email", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const deleteAccount = (body: { password: string }) =>
  apiFetch<void>("/me", { method: "DELETE", body: JSON.stringify(body) });
