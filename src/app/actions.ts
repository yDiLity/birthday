"use server";

import { encodedRedirect } from "@/utils/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "../../supabase/admin";
import { createClient } from "../../supabase/server";
import { getRateLimit } from "@/lib/rate-limit";

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
  const origin = headers().get("origin");

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
      emailRedirectTo: `${origin}/auth/callback`,
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
  }

  return encodedRedirect(
    "success",
    "/sign-up",
    "Thanks for signing up! Please check your email for a verification link.",
  );
};

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
  const origin = headers().get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const rateLimited = await getRateLimitError();
  if (rateLimited) {
    return encodedRedirect("error", "/forgot-password", rateLimited);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/dashboard/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl && isSafeRedirectPath(callbackUrl)) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password.",
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
