import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../supabase/admin";

const RELAY_ID_PATTERN = /^[a-f0-9]{32}$/;

/**
 * Принимает одноразовый PKCE-код со страницы /auth/callback, открытой на
 * другом устройстве (там сессию создать нельзя), и сохраняет его под
 * relay_id для компьютера, запросившего сброс пароля. Идентификатор —
 * 128 бит энтропии, запись живёт минуты и удаляется после обмена.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    relay?: unknown;
    code?: unknown;
  } | null;

  const relay = typeof body?.relay === "string" ? body.relay : "";
  const code = typeof body?.code === "string" ? body.code : "";

  if (!RELAY_ID_PATTERN.test(relay)) {
    return NextResponse.json({ error: "Invalid relay id" }, { status: 400 });
  }
  if (!code || code.length > 512) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  try {
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from("password_reset_relays")
      .update({ code })
      .eq("relay_id", relay);
    if (error) {
      console.error("Error storing relayed reset code:", error);
      return NextResponse.json(
        { error: "Failed to store code" },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error("Relay storage unavailable:", err);
    return NextResponse.json(
      { error: "Storage unavailable" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
