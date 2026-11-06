import { Card, CardTitle } from "@/components/ui/card";

export function ComingSoon({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex max-w-[1180px] flex-col gap-6">
      <h1 className="m-0 text-[32px] font-semibold">{title}</h1>
      <Card className="max-w-xl">
        <CardTitle>Not built yet</CardTitle>
        <p className="mt-2 text-sm text-[#5f6673]">{children}</p>
      </Card>
    </div>
  );
}
