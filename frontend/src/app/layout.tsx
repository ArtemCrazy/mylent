import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyLent — Персональная лента",
  description: "Агрегация Telegram-каналов и источников с AI-обработкой",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}
