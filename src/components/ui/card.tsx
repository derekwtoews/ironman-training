import type * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-[20px] bg-white p-6 shadow-[0_1px_3px_rgba(20,23,31,0.06)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("m-0 text-lg font-semibold text-[#14171f]", className)}
      {...props}
    />
  );
}

/** Big number with a label above and a small note below. */
export function Stat({
  label,
  value,
  unit,
  note,
  noteClass,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: React.ReactNode;
  noteClass?: string;
}) {
  return (
    <div>
      <div className="text-sm text-[#5f6673]">{label}</div>
      <div className="mt-0.5 text-[40px] font-bold leading-tight tracking-tight text-[#14171f]">
        {value}
        {unit ? (
          <span className="ml-1.5 text-lg font-medium text-[#5f6673]">
            {unit}
          </span>
        ) : null}
      </div>
      {note ? (
        <div className={cn("mt-0.5 text-sm text-[#5f6673]", noteClass)}>
          {note}
        </div>
      ) : null}
    </div>
  );
}
