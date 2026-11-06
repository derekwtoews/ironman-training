import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen bg-[#f5f6f8] text-[#14171f]">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-8 md:px-14 md:pb-14 md:pt-9">
        {children}
      </main>
    </div>
  );
}
