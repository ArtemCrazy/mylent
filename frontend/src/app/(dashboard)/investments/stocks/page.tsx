"use client";

import Link from "next/link";

export default function StocksPage() {
  return (
    <div className="p-4 md:p-6 lg:max-w-6xl lg:mx-auto">
      <div className="mb-4">
        <Link href="/investments" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Назад к выбору актива
        </Link>
      </div>

      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden p-12 text-center mt-6">
        <div className="text-6xl mb-6">📈</div>
        <h1 className="text-2xl font-bold mb-3 text-[var(--foreground)]">Акции в разработке</h1>
        <p className="text-[var(--muted)] max-w-md mx-auto">
          Этот раздел пока находится в стадии активной разработки. 
          Скоро здесь появится возможность отслеживать ваш портфель российских акций,
          получать сигналы по изменениям цен и анализировать дивидендную доходность.
        </p>
        <div className="mt-8">
            <Link href="/investments/bonds" className="bg-[var(--accent)] text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity">
                Перейти к облигациям
            </Link>
        </div>
      </div>
    </div>
  );
}
