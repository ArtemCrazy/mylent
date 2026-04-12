import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto pt-14 pb-16 md:pt-0 md:pb-0">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
