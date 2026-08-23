import { NextResponse } from "next/server";
import { createClient } from "../../../../supabase/server";

/** Разрешает только относительные пути (защита от open redirect). */
function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  return (
    path.startsWith("/") && !path.startsWith("//") && !path.includes("://")
  );
}

/**
 * Страница-разборщик ошибок без кода. Supabase возвращает ошибки одноразовых
 * ссылок (истекла, уже использована, предзагружена почтовым роботом) в
 * URL-фрагменте (#error=...), который серверному роуту не виден. Отдаём
 * минимальный HTML, который читает фрагмент на клиенте и перенаправляет
 * с понятным сообщением вместо «мёртвой» страницы.
 */
function buildFragmentErrorHandler(): Response {
  const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Перенаправление…</title>
  </head>
  <body>
    <script>
      (function () {
        var hash = new URLSearchParams(location.hash.slice(1));
        var error = hash.get("error") || hash.get("error_description");
        if (error) {
          var message =
            "Ссылка недействительна, устарела или уже была использована. Запросите новую.";
          location.replace(
            "/forgot-password?error=" + encodeURIComponent(message),
          );
          return;
        }
        location.replace("/dashboard");
      })();
    </script>
    <noscript>
      <p>Ссылка недействительна или уже использована.</p>
      <p><a href="/forgot-password">Запросить новую ссылку</a></p>
    </noscript>
  </body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Страница-релей для кросс-девайсного сброса пароля. Ссылку открыли не в том
 * браузере, где запрашивали сброс (PKCE-verifier там), поэтому сессию создать
 * нельзя. Вместо ошибки просто передаём одноразовый код компьютеру — он
 * обменивает его на сессию сам, и там откроется форма нового пароля.
 */
function buildCodeRelayPage(relayId: string, code: string): Response {
  const payloadJson = JSON.stringify({ relay: relayId, code }).replace(
    /</g,
    "\\u003c",
  );
  const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Передаём код компьютеру…</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        background: #f7f7f8;
        color: #1a1a1a;
        text-align: center;
        padding: 24px;
      }
      p { margin: 0.4rem 0; }
      .done { font-weight: 600; font-size: 18px; }
      .hint { color: #767680; font-size: 14px; max-width: 320px; margin-inline: auto; }
      .spinner {
        width: 28px;
        height: 28px;
        margin: 0 auto 12px;
        border-radius: 50%;
        border: 3px solid #ddd;
        border-top-color: #555;
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div>
      <div class="spinner" id="spinner"></div>
      <p class="done" id="status">Передаём код компьютеру…</p>
      <p class="hint">Вернитесь к компьютеру — там уже откроется форма нового пароля.</p>
    </div>
    <script>
      (function () {
        var payload = ${payloadJson};
        fetch("/api/relay-reset-code", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        })
          .then(function () {
            document.getElementById("status").textContent =
              "Готово! Вернитесь к компьютеру.";
            document.getElementById("spinner").style.display = "none";
          })
          .catch(function () {
            document.getElementById("status").textContent =
              "Не удалось передать код. Откройте ссылку из письма ещё раз или запросите новую на компьютере.";
            document.getElementById("spinner").style.display = "none";
          });
      })();
    </script>
  </body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next =
    requestUrl.searchParams.get("next") ||
    requestUrl.searchParams.get("redirect_to") ||
    "/dashboard";

  if (!code) {
    // Нет code в query — значит Supabase прислал ошибку во фрагменте
    // (либо кто-то открыл /auth/callback напрямую).
    return buildFragmentErrorHandler();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Error exchanging code for session:", error);
    // Email подтверждается на стороне Supabase при переходе по ссылке,
    // но сессию создать нельзя — например, ссылку открыли на другом
    // устройстве: PKCE-привязка не позволяет создать сессию здесь.
    if (next.includes("reset-password")) {
      const relayId = requestUrl.searchParams.get("relay");
      if (relayId && /^[a-f0-9]{32}$/.test(relayId)) {
        return buildCodeRelayPage(relayId, code);
      }
      return NextResponse.redirect(
        new URL(
          `/forgot-password?error=${encodeURIComponent(
            "Ссылка для сброса пароля недействительна или уже использована. Запросите новую на этой странице — тогда письмо придёт для этого устройства.",
          )}`,
          requestUrl.origin,
        ),
      );
    }
    return NextResponse.redirect(new URL("/confirmed", requestUrl.origin));
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(
    new URL(isSafeRedirectPath(next) ? next : "/dashboard", requestUrl.origin),
  );
}
