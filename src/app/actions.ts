"use server";

import { randomBytes } from "node:crypto";
import { encodedRedirect } from "@/utils/utils";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "../../supabase/admin";
import { createClient } from "../../supabase/server";
import { getRateLimit } from "@/lib/rate-limit";

/**
 * Временная HttpOnly-cookie с email+паролем только что зарегистрированного
 * пользователя. Нужна странице ожидания подтверждения (/sign-up/waiting),
 * чтобы после клика по ссылке с любого устройства автоматически войти
 * на компьютере без повторного ввода данных.
 */
const SIGNUP_HANDOFF_COOKIE = "signup_handoff";

function encodeSignupHandoff(email: string, password: string): string {
  return Buffer.from(JSON.stringify({ email, password }), "utf8").toString(
    "base64url",
  );
}

function decodeSignupHandoff(
  value: string,
): { email: string; password: string } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as { email?: unknown; password?: unknown };
    if (
      typeof parsed.email === "string" &&
      typeof parsed.password === "string"
    ) {
      return { email: parsed.email, password: parsed.password };
    }
    return null;
  } catch {
    return null;
  }
}

function clearSignupHandoffCookie() {
  cookies().set({
    name: SIGNUP_HANDOFF_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Кросс-девайсный сброс пароля: HttpOnly-cookie компьютера с id «релея».
 * Телефон, открыв ссылку из письма, передаст одноразовый код под этим id,
 * а компьютер заберёт его и обменяет на сессию (PKCE-verifier у него).
 */
const RESET_RELAY_COOKIE = "reset_relay_id";
const RESET_RELAY_TTL_MS = 30 * 60 * 1000;
// Паттерн relay-id (/^[a-f0-9]{32}$/) продублирован в callback-роуте
// и API-роуте: в файле с "use server" можно экспортировать только
// async-функции.

function clearResetRelayCookie() {
  cookies().set({
    name: RESET_RELAY_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Публичный origin сайта для ссылок в письмах. На Vercel заголовок Origin
 * у server action может отсутствовать, поэтому сначала берём
 * x-forwarded-host/x-forwarded-proto, которые прокси ставит всегда.
 */
function getSiteOrigin(): string {
  const headerList = headers();
  const host = headerList
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (host) {
    const proto =
      headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
    return `${proto}://${host}`;
  }
  return headerList.get("origin") ?? "";
}

/** Возвращает текст ошибки, если IP исчерпал лимит попыток (иначе null). */
async function getRateLimitError(): Promise<string | null> {
  const rateLimit = getRateLimit({
    prefix: "digital-birthday-reminder:auth",
    limit: 5,
  });
  if (!rateLimit) {
    return null;
  }

  const forwardedFor = headers().get("x-forwarded-for");
  const identifier = forwardedFor?.split(",")[0]?.trim() || "unknown";
  const { success } = await rateLimit.limit(identifier);

  if (!success) {
    return "Too many attempts. Please try again later.";
  }
  return null;
}

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString() || "";
  const supabase = await createClient();
  const origin = getSiteOrigin();

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required",
    );
  }

  const rateLimited = await getRateLimitError();
  if (rateLimited) {
    return encodedRedirect("error", "/sign-up", rateLimited);
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // next=/confirmed: ссылку могут открыть с другого устройства (например,
      // с телефона) — там просто покажется страница успеха, а сам компьютер
      // войдёт автоматически через страницу ожидания /sign-up/waiting.
      emailRedirectTo: `${origin}/auth/callback?next=/confirmed`,
      data: {
        full_name: fullName,
        email: email,
      },
    },
  });

  if (error) {
    console.error(`${error.code} ${error.message}`);
    return encodedRedirect("error", "/sign-up", error.message);
  }

  if (user) {
    // Аккаунт с таким email уже существует: Supabase намеренно не шлёт письмо
    // и возвращает пользователя с пустым identities (защита от перечисления).
    if (!user.identities || user.identities.length === 0) {
      return encodedRedirect(
        "error",
        "/sign-up",
        "Аккаунт с таким email уже существует. Войдите или восстановите пароль.",
      );
    }

    try {
      const adminSupabase = createAdminClient();
      const { error: updateError } = await adminSupabase.from("users").insert({
        id: user.id,
        name: fullName,
        full_name: fullName,
        email: email,
        user_id: user.id,
        token_identifier: user.id,
        created_at: new Date().toISOString(),
      });

      if (updateError) {
        console.error("Error updating user profile:", updateError);
      }
    } catch (err) {
      console.error("Error in user profile creation:", err);
    }

    // Отдаём данные для автовхода странице ожидания (HttpOnly-cookie на
    // 10 минут) и переводим пользователя на неё.
    cookies().set({
      name: SIGNUP_HANDOFF_COOKIE,
      value: encodeSignupHandoff(email, password),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return redirect(
      `/sign-up/waiting?email=${encodeURIComponent(email)}`,
    );
  }

  return encodedRedirect(
    "error",
    "/sign-up",
    "Не удалось зарегистрироваться. Попробуйте ещё раз.",
  );
};

export type SignupConfirmationResult =
  | { status: "ok" }
  | { status: "waiting" }
  | { status: "no_handoff" }
  | { status: "error"; error: string };

/**
 * Вызывается страницей /sign-up/waiting раз в несколько секунд. Пока ссылка
 * из письма не открыта — возвращает waiting. Как только email подтверждён
 * (с любого устройства), выполняет вход и ставит сессию в cookies текущего
 * браузера — страница ожидания после этого просто перейдёт в /dashboard.
 */
export async function checkSignupConfirmationAction(): Promise<SignupConfirmationResult> {
  const raw = cookies().get(SIGNUP_HANDOFF_COOKIE)?.value;
  if (!raw) {
    return { status: "no_handoff" };
  }

  const credentials = decodeSignupHandoff(raw);
  if (!credentials) {
    clearSignupHandoffCookie();
    return { status: "no_handoff" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (!error) {
    clearSignupHandoffCookie();
    return { status: "ok" };
  }

  const message = (error.message ?? "").toLowerCase();
  // «Email not confirmed» — ссылка ещё не открыта, продолжаем ждать.
  if (message.includes("confirm") || message.includes("verify")) {
    return { status: "waiting" };
  }

  return { status: "error", error: error.message };
}

export type ResetRelayResult =
  | { status: "ok" }
  | { status: "waiting" }
  | { status: "no_relay" }
  | { status: "error"; error: string };

/**
 * Вызывается страницей /forgot-password/waiting. Пока телефон не передал
 * одноразовый код из письма — waiting. Как только код пришёл, обменивает
 * его на сессию именно на компьютере (PKCE-verifier в его cookies),
 * после чего страница уводит на форму нового пароля.
 */
export async function checkResetRelayAction(): Promise<ResetRelayResult> {
  const relayId = cookies().get(RESET_RELAY_COOKIE)?.value;
  if (!relayId || !/^[a-f0-9]{32}$/.test(relayId)) {
    return { status: "no_relay" };
  }

  let code: string | null = null;
  try {
    const adminSupabase = createAdminClient();
    const { data: row, error } = await adminSupabase
      .from("password_reset_relays")
      .select("code")
      .eq("relay_id", relayId)
      .maybeSingle();
    if (error || !row) {
      clearResetRelayCookie();
      return { status: "no_relay" };
    }
    code = row.code;
  } catch {
    // Временная ошибка БД — просто продолжаем ждать.
    return { status: "waiting" };
  }

  if (!code) {
    return { status: "waiting" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  try {
    await createAdminClient()
      .from("password_reset_relays")
      .delete()
      .eq("relay_id", relayId);
  } catch {
    // Не критично: просроченные строки чистятся при новом запросе сброса.
  }
  clearResetRelayCookie();

  if (!error) {
    return { status: "ok" };
  }

  console.error("Error exchanging relayed reset code:", error);
  return {
    status: "error",
    error: "Не удалось подтвердить ссылку. Запросите сброс пароля заново.",
  };
}

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const rateLimited = await getRateLimitError();
  if (rateLimited) {
    return encodedRedirect("error", "/sign-in", rateLimited);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/dashboard");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = getSiteOrigin();
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const rateLimited = await getRateLimitError();
  if (rateLimited) {
    return encodedRedirect("error", "/forgot-password", rateLimited);
  }

  // Готовим «релей»: случайный id, под которым телефон передаст нам
  // одноразовый код из письма. Компьютер обменяет его на сессию сам.
  const candidateRelayId = randomBytes(16).toString("hex");
  let relayId: string | null = null;
  try {
    const adminSupabase = createAdminClient();
    await adminSupabase
      .from("password_reset_relays")
      .delete()
      .lt("created_at", new Date(Date.now() - RESET_RELAY_TTL_MS).toISOString());
    const { error: relayError } = await adminSupabase
      .from("password_reset_relays")
      .insert({ relay_id: candidateRelayId });
    if (relayError) {
      console.error("Error creating password reset relay:", relayError);
    } else {
      relayId = candidateRelayId;
    }
  } catch (err) {
    console.error("Password reset relay unavailable:", err);
  }

  if (relayId) {
    cookies().set({
      name: RESET_RELAY_COOKIE,
      value: relayId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 15,
    });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/dashboard/reset-password${
      relayId ? `&relay=${relayId}` : ""
    }`,
  });

  if (error) {
    console.error(error.message);
    clearResetRelayCookie();
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl && isSafeRedirectPath(callbackUrl)) {
    return redirect(callbackUrl);
  }

  // Страница ожидания: как только ссылку откроют с любого устройства,
  // код «долетит» до этого браузера и здесь автоматически откроется
  // форма нового пароля.
  return redirect(
    `/forgot-password/waiting?email=${encodeURIComponent(email)}`,
  );
};

/** Разрешает только относительные пути (защита от open redirect). */
function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  return (
    path.startsWith("/") && !path.startsWith("//") && !path.includes("://")
  );
}

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match",
    );
  }

  const rateLimited = await getRateLimitError();
  if (rateLimited) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      rateLimited,
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password update failed",
    );
  }

  return encodedRedirect(
    "success",
    "/dashboard/reset-password",
    "Password updated",
  );
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};
