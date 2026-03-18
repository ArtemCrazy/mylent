"use client";

import { useState } from "react";
import type { Source } from "@/lib/api";

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  news: { label: "Новости", icon: "📰" },
  tech: { label: "Технологии", icon: "💻" },
  ai: { label: "ИИ", icon: "🤖" },
  web_studio: { label: "Веб-студия", icon: "🎨" },
  sport: { label: "Спорт", icon: "⚽" },
  humor: { label: "Юмор", icon: "😄" },
  space: { label: "Космос", icon: "🚀" },
  investments: { label: "Инвестиции", icon: "📈" },
  other: { label: "Прочее", icon: "📌" },
};

interface SourcePickerProps {
  sources: Source[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

export function SourcePicker({ sources, selected, onChange }: SourcePickerProps) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Group sources by category
  const grouped: Record<string, Source[]> = {};
  for (const src of sources) {
    const cat = src.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(src);
  }

  const categories = Object.keys(grouped).sort((a, b) => {
    const order = Object.keys(CATEGORY_LABELS);
    return order.indexOf(a) - order.indexOf(b);
  });

  function toggleSource(id: number) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  }

  function toggleCategory(cat: string) {
    const catIds = grouped[cat].map((s) => s.id);
    const allSelected = catIds.every((id) => selected.includes(id));
    if (allSelected) {
      onChange(selected.filter((id) => !catIds.includes(id)));
    } else {
      const newSelected = new Set([...selected, ...catIds]);
      onChange(Array.from(newSelected));
    }
  }

  function toggleExpand(cat: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function getCatStatus(cat: string): "all" | "some" | "none" {
    const catIds = grouped[cat].map((s) => s.id);
    const selectedCount = catIds.filter((id) => selected.includes(id)).length;
    if (selectedCount === catIds.length) return "all";
    if (selectedCount > 0) return "some";
    return "none";
  }

  return (
    <div className="space-y-1.5">
      {categories.map((cat) => {
        const info = CATEGORY_LABELS[cat] || { label: cat, icon: "📁" };
        const status = getCatStatus(cat);
        const expanded = expandedCats.has(cat);
        const catSources = grouped[cat];

        return (
          <div key={cat} className="rounded-lg border border-[var(--border)] overflow-hidden">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                  status === "all"
                    ? "bg-[var(--accent)] text-white"
                    : status === "some"
                      ? "bg-[var(--accent)]/20 text-[var(--foreground)]"
                      : "bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <span>{info.icon}</span>
                <span className="font-medium">{info.label}</span>
                <span className="text-xs opacity-70">
                  {status === "none"
                    ? `(${catSources.length})`
                    : `(${catSources.filter((s) => selected.includes(s.id)).length}/${catSources.length})`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleExpand(cat)}
                className={`px-3 py-2 text-xs transition-colors ${
                  status === "all"
                    ? "bg-[var(--accent)] text-white/70 hover:text-white"
                    : "bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>&#9654;</span>
              </button>
            </div>
            {expanded && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-[var(--background)]/50">
                {catSources.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => toggleSource(src.id)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      selected.includes(src.id)
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {src.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
