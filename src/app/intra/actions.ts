"use server";

import { redirect } from "next/navigation";
import { getCurrentOrganizer, logout, requestLoginCode, verifyLoginCode } from "@/lib/auth";

export type LoginState = {
  step: "email" | "code";
  email?: string;
  error?: string;
  devCode?: string;
};

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const step = String(formData.get("step") ?? "email");
  const email = String(formData.get("email") ?? "");
  const next = String(formData.get("next") ?? "");

  if (step === "email") {
    const res = await requestLoginCode(email);
    if (!res.ok) return { step: "email", email, error: res.error };
    return { step: "code", email, devCode: res.devCode };
  }

  const code = String(formData.get("code") ?? "");
  const res = await verifyLoginCode(email, code);
  if (!res.ok) return { step: "code", email, error: res.error, devCode: prev.devCode };
  const ctx = await getCurrentOrganizer(res.user);
  const safeNext = next.startsWith("/") ? next : "";
  redirect(safeNext || (ctx ? "/panou" : "/incepe"));
}

export async function logoutAction() {
  await logout();
  redirect("/");
}
