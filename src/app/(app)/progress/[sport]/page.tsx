import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";

const SPORTS = { swim: "Swim", bike: "Bike", run: "Run" } as const;

export function generateStaticParams() {
  return Object.keys(SPORTS).map((sport) => ({ sport }));
}

export default async function ProgressPage({
  params,
}: PageProps<"/progress/[sport]">) {
  const { sport } = await params;
  if (!(sport in SPORTS)) notFound();
  return (
    <ComingSoon title={`${SPORTS[sport as keyof typeof SPORTS]} progress`}>
      Trends over time for this sport, built from your synced laps and
      activities.
    </ComingSoon>
  );
}
