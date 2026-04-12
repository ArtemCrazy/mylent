const fs = require('fs');

let code = fs.readFileSync('frontend/src/app/(dashboard)/investments/bonds/page.tsx', 'utf-8');

// 1. Remove `addSignal` method
code = code.replace(/  const addSignal = async \(e: React.FormEvent, bondId: number\) => \{[\s\S]*?\n  \};\n/g, "");

// 2. Replace the inside of `<td className="p-4 relative">`
const td_replace = `                        <td className="p-4 relative text-center">
                          <button
                            onClick={() => {
                              setEditingGroup(null);
                              setBulkSignalForm({ condition_type: "price_less", target_value: "", news_category: "", cron_minutes: 1, notify_telegram: true });
                              setSelectedBonds(new Set([item.bond.id]));
                              setBulkModalOpen(true);
                            }}
                            className="bg-[var(--accent)]/10 text-[var(--accent)] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[var(--accent)] hover:text-white transition-colors border border-[var(--accent)]/20 shadow-sm"
                          >
                            + Добавить сигнал
                          </button>
                        </td>`;
code = code.replace(/                        <td className="p-4 relative">[\s\S]*?<\/td>/g, td_replace);

fs.writeFileSync('frontend/src/app/(dashboard)/investments/bonds/page.tsx', code, 'utf-8');
console.log("REMOVED INLINE FORM");
