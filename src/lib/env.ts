import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  STRAVA_CLIENT_ID: z.string().min(1),
  STRAVA_CLIENT_SECRET: z.string().min(1),
  STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  APP_URL: z.string().url(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Parsed lazily so build and tests don't need secrets. Throws a readable error if any are missing. */
export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
