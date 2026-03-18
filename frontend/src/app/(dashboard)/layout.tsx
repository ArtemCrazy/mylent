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
        <main className="flex-1 min-w-0 overflow-y-auto mt-14 md:mt-0">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
