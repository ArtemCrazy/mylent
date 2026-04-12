from pathlib import Path

page = Path('/root/mylent/frontend/src/app/page.tsx')
page.write_text('''import { AuthGuard } from "@/components/AuthGuard";
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
''', encoding='utf-8')

feed = Path('/root/mylent/frontend/src/components/FeedPage.tsx')
text = feed.read_text(encoding='utf-8')
if 'import Link from "next/link";' not in text:
    text = text.replace(
        'import { useCallback, useEffect, useRef, useState } from "react";\n',
        'import { useCallback, useEffect, useRef, useState } from "react";\nimport Link from "next/link";\n',
        1,
    )
old = '''      <header className="mb-4">\n        <h1 className="text-2xl font-semibold hidden md:block">Лента</h1>\n        <p className="text-sm text-[var(--muted)] mb-4 hidden md:block">Публикации из подключённых источников. Обновляется автоматически.</p>\n'''
new = '''      <header className="mb-4">\n        <div className="hidden md:flex items-center gap-2 mb-1">\n          <h1 className="text-2xl font-semibold">Лента</h1>\n          <Link\n            href="/settings"\n            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-colors"\n            aria-label="Настройки ленты"\n            title="Настройки ленты"\n          >\n            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">\n              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />\n            </svg>\n          </Link>\n        </div>\n        <p className="text-sm text-[var(--muted)] mb-4 hidden md:block">Публикации из подключённых источников. Обновляется автоматически.</p>\n'''
if old not in text:
    raise SystemExit('expected header block not found in FeedPage.tsx')
text = text.replace(old, new, 1)
feed.write_text(text, encoding='utf-8')