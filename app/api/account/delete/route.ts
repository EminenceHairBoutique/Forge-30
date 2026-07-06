import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { crossOriginBlocked } from "@/lib/server/origin";
import { MAX_JSON_BODY_BYTES, readJsonBody } from "@/lib/server/validate";

/**
 * Cloud account deletion (v3.3 §1.6). Authenticated POST with the typed
 * confirmation; purges every server-side row for the user (sync data, push
 * subscriptions, billing rows, usage/rate counters), then deletes the auth
 * user. Local device data is deliberately untouched — Settings offers the
 * local wipe separately, and the app keeps working signed-out.
 */

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function POST(req: Request) {
  if (crossOriginBlocked(req)) {
    return NextResponse.json({ error: "Cross-origin requests aren't accepted." }, { status: 403 });
  }
  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "This build has no cloud account — there's nothing to delete server-side." },
      { status: 404 }
    );
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data, error } = await supabase.auth.getUser(token);
  const userId = error ? null : (data.user?.id ?? null);
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await readJsonBody(req, MAX_JSON_BODY_BYTES);
  if (!body.ok || (body.value as { confirm?: unknown } | null)?.confirm !== "DELETE") {
    return NextResponse.json(
      { error: 'Type DELETE to confirm — this permanently removes the cloud account.' },
      { status: 400 }
    );
  }

  // Purge user rows first so a failed auth-delete never strands orphans.
  try {
    await supabase.from("sync_blobs").delete().eq("user_id", userId);
    await supabase.from("sync_rows").delete().eq("user_id", userId);
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    await supabase.from("subscriptions").delete().eq("user_id", userId);
    await supabase.from("ai_usage").delete().eq("user_id", userId);
    // rate_limits keys are "<route>:<userId>" for signed-in callers.
    await supabase.from("rate_limits").delete().like("key", `%:${userId}`);
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      return NextResponse.json(
        { error: "Cloud data was removed, but the sign-in record didn't delete — try again." },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Deletion didn't complete — nothing was lost locally. Try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
