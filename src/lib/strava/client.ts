import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { stravaAuth } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

const API = "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth";
export const SCOPE = "read,activity:read_all,profile:read_all";

export class RateLimitError extends Error {
  constructor(readonly usage: string | null) {
    super(`Strava rate limit hit (usage ${usage ?? "unknown"})`);
  }
}
export class StravaHttpError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`Strava ${status} on ${path}`);
  }
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  athlete?: { id: number; firstname?: string; lastname?: string };
}

export function authorizeUrl(state: string): string {
  const e = env();
  const q = new URLSearchParams({
    client_id: e.STRAVA_CLIENT_ID,
    redirect_uri: `${e.APP_URL}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: SCOPE,
    state,
  });
  return `${OAUTH}/authorize?${q}`;
}

async function tokenRequest(
  params: Record<string, string>,
  f: typeof fetch,
): Promise<TokenResponse> {
  const e = env();
  const res = await f(`${OAUTH}/token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: e.STRAVA_CLIENT_ID,
      client_secret: e.STRAVA_CLIENT_SECRET,
      ...params,
    }),
  });
  if (!res.ok) throw new StravaHttpError(res.status, "/oauth/token");
  return res.json();
}

export const exchangeCode = (code: string, f: typeof fetch = fetch) =>
  tokenRequest({ code, grant_type: "authorization_code" }, f);

export async function saveTokens(
  db: Db,
  athleteId: number,
  t: TokenResponse,
  scope = SCOPE,
) {
  const key = env().TOKEN_ENCRYPTION_KEY;
  const row = {
    accessTokenEnc: encrypt(t.access_token, key),
    refreshTokenEnc: encrypt(t.refresh_token, key),
    expiresAt: new Date(t.expires_at * 1000),
    scope,
    updatedAt: new Date(),
  };
  await db
    .insert(stravaAuth)
    .values({ athleteId, ...row })
    .onConflictDoUpdate({ target: stravaAuth.athleteId, set: row });
}

/** Authenticated GET client. Reads/refreshes tokens from the db; never used on page load. */
export class StravaClient {
  constructor(
    private db: Db,
    private athleteId: number,
    private f: typeof fetch = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    const key = env().TOKEN_ENCRYPTION_KEY;
    const [row] = await this.db
      .select()
      .from(stravaAuth)
      .where(eq(stravaAuth.athleteId, this.athleteId));
    if (!row) throw new Error("Strava not connected");
    if (row.expiresAt.getTime() - Date.now() > 5 * 60_000)
      return decrypt(row.accessTokenEnc, key);
    const t = await tokenRequest(
      {
        grant_type: "refresh_token",
        refresh_token: decrypt(row.refreshTokenEnc, key),
      },
      this.f,
    );
    await saveTokens(this.db, this.athleteId, t, row.scope);
    return t.access_token;
  }

  async get<T>(
    path: string,
    query: Record<string, string | number> = {},
  ): Promise<T> {
    const qs = new URLSearchParams(
      Object.entries(query).map(([k, v]) => [k, String(v)]),
    );
    const res = await this.f(`${API}${path}${qs.size ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${await this.accessToken()}` },
    });
    if (res.status === 429)
      throw new RateLimitError(res.headers.get("x-ratelimit-usage"));
    if (!res.ok) throw new StravaHttpError(res.status, path);
    return res.json();
  }
}
