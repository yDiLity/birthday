import { NextResponse } from "next/server";
import { createClient } from "../../../../supabase/server";

/** Разрешает только относительные пути (защита от open redirect). */
function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  return (
    path.startsWith("/") && !path.startsWith("//") && !path.includes("://")
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next =
    requestUrl.searchParams.get("next") ||
    requestUrl.searchParams.get("redirect_to") ||
    "/dashboard";

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
  return NextResponse.redirect(
    new URL(isSafeRedirectPath(next) ? next : "/dashboard", requestUrl.origin),
  );
}
