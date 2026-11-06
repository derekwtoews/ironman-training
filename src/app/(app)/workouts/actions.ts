"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { setActivityOverride } from "@/lib/overrides";
import { getAthlete } from "@/lib/queries/week";
import { logWeight } from "@/lib/weight";

export interface FormState {
  ok: boolean;
  message: string;
}

const correction = z.object({
  id: z.coerce.number().int().positive(),
  minutes: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : Number(s)))
    .pipe(
      z
        .number()
        .min(1, "At least 1 minute")
        .max(1440, "At most 24 hours")
        .nullable(),
    ),
  exclude: z.literal("on").optional(),
  note: z.string().trim().max(500).optional(),
});

function refreshAll(id?: number) {
  revalidatePath("/");
  revalidatePath("/workouts");
  if (id) revalidatePath(`/workouts/${id}`);
}

/** Save a duration correction and/or exclude-from-load. Raw Strava data is never changed. */
export async function saveCorrection(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = correction.safeParse({
    id: form.get("id"),
    minutes: String(form.get("minutes") ?? ""),
    exclude: form.get("exclude") ?? undefined,
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the values",
    };
  const db = getDb();
  const athlete = await getAthlete(db);
  if (!athlete) return { ok: false, message: "No athlete set up" };
  const { id, minutes, exclude, note } = parsed.data;
  const load = await setActivityOverride(db, athlete.id, id, {
    movingSeconds: minutes == null ? null : Math.round(minutes * 60),
    excludeFromLoad: exclude === "on",
    note: note || undefined,
  });
  refreshAll(id);
  return {
    ok: true,
    message: load == null ? "Saved" : `Saved. Load is now ${load}.`,
  };
}

export async function clearCorrection(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const id = z.coerce.number().int().positive().safeParse(form.get("id"));
  if (!id.success) return { ok: false, message: "Unknown workout" };
  const db = getDb();
  const athlete = await getAthlete(db);
  if (!athlete) return { ok: false, message: "No athlete set up" };
  const load = await setActivityOverride(db, athlete.id, id.data, {
    movingSeconds: null,
    excludeFromLoad: false,
  });
  refreshAll(id.data);
  return {
    ok: true,
    message:
      load == null
        ? "Correction removed"
        : `Correction removed. Load is back to ${load}.`,
  };
}

const weight = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  kg: z.coerce
    .number()
    .min(30, "Check the weight")
    .max(200, "Check the weight"),
});

export async function addWeight(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = weight.safeParse({
    date: form.get("date"),
    kg: form.get("kg"),
  });
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the values",
    };
  const db = getDb();
  const athlete = await getAthlete(db);
  if (!athlete) return { ok: false, message: "No athlete set up" };
  await logWeight(db, athlete.id, parsed.data);
  refreshAll();
  return {
    ok: true,
    message: `Saved ${parsed.data.kg} kg for ${parsed.data.date}`,
  };
}
