"use client";

import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Home,
  LineChart,
  Settings,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "This week", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/workouts", label: "Workouts", icon: Waves },
  { href: "/insights", label: "Insights", icon: LineChart },
  {
    href: "/progress/swim",
    label: "Progress",
    icon: BarChart3,
    match: "/progress",
  },
  { href: "/review", label: "Weekly review", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const SPORTS = [
  { href: "/progress/swim", label: "Swim" },
  { href: "/progress/bike", label: "Bike" },
  { href: "/progress/run", label: "Run" },
];

function active(path: string, item: { href: string; match?: string }) {
  const m = item.match ?? item.href;
  return m === "/" ? path === "/" : path === m || path.startsWith(`${m}/`);
}

export function Sidebar() {
  const path = usePathname();
  return (
    <>
      <nav
        aria-label="Main"
        className="sticky top-0 hidden h-screen w-[250px] shrink-0 flex-col gap-1 border-r border-[#e6e8ec] px-2 py-6 md:flex"
      >
        <div className="flex items-center gap-2.5 px-3.5 pb-5">
          <div className="flex size-[30px] items-center justify-center rounded-full bg-[#0b6ef5]">
            <LineChart className="size-4 text-white" aria-hidden />
          </div>
          <span className="text-xl font-semibold text-[#14171f]">
            Ottawa 2027
          </span>
        </div>
        {NAV.map((item) => {
          const on = active(path, item);
          const Icon = item.icon;
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-medium",
                  on
                    ? "bg-white text-[#14171f] shadow-[0_1px_3px_rgba(20,23,31,0.08)]"
                    : "text-[#4b5260] hover:bg-white/60",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
              {item.label === "Progress" && on ? (
                <div className="my-0.5 ml-[46px] flex flex-col gap-0.5">
                  {SPORTS.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      aria-current={path === s.href ? "page" : undefined}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-sm",
                        path === s.href
                          ? "bg-[#eceef2] font-semibold text-[#14171f]"
                          : "text-[#4b5260]",
                      )}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-[#e6e8ec] bg-white px-1 pb-2 pt-1 md:hidden"
      >
        {NAV.filter(
          (n) => n.label !== "Settings" && n.label !== "Weekly review",
        ).map((item) => {
          const on = active(path, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                on
                  ? "font-semibold text-[#0b6ef5]"
                  : "font-medium text-[#4b5260]",
              )}
            >
              <Icon className="size-[22px]" aria-hidden />
              {item.label === "This week" ? "Week" : item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
