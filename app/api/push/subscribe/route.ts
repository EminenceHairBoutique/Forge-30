import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { crossOriginBlocked } from "@/lib/server/origin";
import { MAX_JSON_BODY_BYTES, readJsonBody, validatePushSubscription } from "@/lib/server/validate";

/**
 * Push subscription endpoint (v3 Phase 2).
 *
 * GET  → { publicKey } when the build has VAPID configured; 404 otherwise —
 *        the client feature-detects push availability with this call.
 * POST → store the caller's subscription (verified via their Supabase JWT).
 * DELETE → remove a subscription by endpoint.
 *
 * The service-role key exists only here (server); user identity is always
 * proven by the bearer token, never trusted from the body.
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

async function userIdFromRequest(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = serviceClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey || !serviceClient()) {
    return NextResponse.json({ error: "Push is not configured." }, { status: 404 });
  }
  return NextResponse.json({ publicKey });
}

export async function POST(req: Request) {
  if (crossOriginBlocked(req)) {
    return NextResponse.json({ error: "Cross-origin requests aren't accepted." }, { status: 403 });
  }
  const supabase = serviceClient();
  if (!supabase || !process.env.VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: "Push is not configured." }, { status: 404 });
  }
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const raw = await readJsonBody(req, MAX_JSON_BODY_BYTES);
  if (!raw.ok) return NextResponse.json({ error: "Malformed subscription." }, { status: 400 });
  const sub = validatePushSubscription(raw.value);
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: 400 });

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.value.endpoint,
      p256dh: sub.value.keys.p256dh,
      auth: sub.value.keys.auth,
      tz: sub.value.tz,
    },
    { onConflict: "user_id,endpoint" }
  );
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = serviceClient();
  if (!supabase) return NextResponse.json({ error: "Push is not configured." }, { status: 404 });
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}
