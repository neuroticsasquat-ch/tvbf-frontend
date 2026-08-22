import { apiFetch } from "./client";

export interface ContactInput {
  name: string;
  email: string;
  message: string;
  turnstileToken?: string;
}

export function submitContact(input: ContactInput): Promise<void> {
  return apiFetch<void>("/contact", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      message: input.message,
      turnstile_token: input.turnstileToken,
    }),
  });
}
