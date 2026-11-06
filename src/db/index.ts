import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | undefined;

export function getDb(): Db {
  cached ??= drizzle(postgres(env().DATABASE_URL, { prepare: false }), {
    schema,
  });
  return cached;
}

export { schema };
