import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import FeedPage from "@/components/FeedPage";

export default function HomePage() {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto pt-14 pb-16 md:pt-0 md:pb-0">
          <FeedPage />
        </main>
      </div>
    </AuthGuard>
  );
}
