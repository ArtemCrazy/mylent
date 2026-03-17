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
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
