import { Sidebar } from "@/components/Sidebar";
import FeedPage from "@/components/FeedPage";

export default function HomePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        <FeedPage />
      </main>
    </div>
  );
}
