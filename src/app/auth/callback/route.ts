import { NextResponse } from "next/server";
import { createClient } from "../../../../supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Error exchanging code for session:", error);
      // Email подтверждается на стороне Supabase при переходе по ссылке,
      // но сессию создать нельзя (например, ссылка открыта на другом устройстве).
      // Показываем страницу "Почта подтверждена", откуда можно войти.
      return NextResponse.redirect(new URL("/confirmed", requestUrl.origin));
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
