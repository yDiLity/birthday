import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(
          new URL("/dashboard/reset-password", origin),
        );
      }
      return NextResponse.redirect(new URL("/confirmed", origin));
    }
    console.error("Error verifying OTP:", error);
  }

  if (type === "recovery") {
    return NextResponse.redirect(
      new URL(
        `/forgot-password?error=${encodeURIComponent(
          "Ссылка для сброса пароля недействительна или уже использована. Запросите новую.",
        )}`,
        origin,
      ),
    );
  }

  return NextResponse.redirect(
    new URL(
      `/sign-in?error=${encodeURIComponent(
        "Ссылка подтверждения недействительна или уже использована.",
      )}`,
      origin,
    ),
  );
}
