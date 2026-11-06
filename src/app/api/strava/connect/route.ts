import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { authorizeUrl } from "@/lib/strava/client";

// Interim guard until app auth exists: requires ?secret=<CRON_SECRET> so nobody else can link an account.
export function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== env().CRON_SECRET)
    return new Response("Forbidden", { status: 403 });
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("strava_state", state, {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/strava",
  });
  return res;
}
