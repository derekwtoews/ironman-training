"use client";

import { useActionState } from "react";
import {
  addWeight,
  clearCorrection,
  type FormState,
  saveCorrection,
} from "./actions";

const initial: FormState = { ok: false, message: "" };

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <output
      className={
        state.ok
          ? "block text-sm text-[#15803d]"
          : "block text-sm text-[#b42318]"
      }
    >
      {state.message}
    </output>
  );
}

const input =
  "h-11 rounded-xl border border-[#d5d9e0] bg-white px-3 text-[15px] text-[#14171f] focus:border-[#0b6ef5] focus:outline-none";
const primary =
  "h-11 rounded-xl bg-[#0b6ef5] px-5 text-[15px] font-medium text-white disabled:opacity-60";
const secondary =
  "h-11 rounded-xl bg-[#eceef2] px-5 text-[15px] font-medium text-[#14171f] disabled:opacity-60";

export function CorrectionForm({
  id,
  minutes,
  excluded,
  note,
  corrected,
}: {
  id: number;
  minutes: number | null;
  excluded: boolean;
  note: string | null;
  corrected: boolean;
}) {
  const [state, action, pending] = useActionState(saveCorrection, initial);
  const [cleared, clear, clearing] = useActionState(clearCorrection, initial);
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={id} />
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-[#4b5260]">
            Real duration in minutes (blank keeps Strava's)
            <input
              name="minutes"
              type="number"
              min={1}
              max={1440}
              step={1}
              inputMode="numeric"
              placeholder="e.g. 60"
              defaultValue={minutes ?? ""}
              className={`${input} w-56`}
            />
          </label>
          <label className="flex h-11 items-center gap-2.5 text-[15px] text-[#14171f]">
            <input
              name="exclude"
              type="checkbox"
              defaultChecked={excluded}
              className="size-5 accent-[#0b6ef5]"
            />
            Don't count this toward load
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm text-[#4b5260]">
          Note (optional)
          <input
            name="note"
            type="text"
            maxLength={500}
            defaultValue={note ?? ""}
            placeholder="e.g. forgot to stop the watch"
            className={input}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={primary}>
            {pending ? "Saving…" : "Save correction"}
          </button>
          <Message state={state} />
        </div>
      </form>
      {corrected || excluded ? (
        <form action={clear} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={clearing} className={secondary}>
            {clearing ? "Removing…" : "Remove correction"}
          </button>
          <Message state={cleared} />
        </form>
      ) : null}
    </div>
  );
}

export function WeightForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addWeight, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-[#4b5260]">
          Date
          <input
            name="date"
            type="date"
            defaultValue={today}
            max={today}
            className={`${input} w-44`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-[#4b5260]">
          Weight (kg)
          <input
            name="kg"
            type="number"
            step="0.1"
            min={30}
            max={200}
            inputMode="decimal"
            required
            className={`${input} w-32`}
          />
        </label>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Saving…" : "Log weight"}
        </button>
      </div>
      <Message state={state} />
    </form>
  );
}
