const fs = require('fs');

let code = fs.readFileSync('frontend/src/app/(dashboard)/investments/bonds/page.tsx', 'utf-8');

// 1. State changes
const state_replace = `  // For editing and bulk signal grouping
  const [selectedBonds, setSelectedBonds] = useState<Set<number>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [bulkSignalForm, setBulkSignalForm] = useState<{condition_type: string, target_value: string, news_category: string, cron_minutes: number, notify_telegram: boolean}>({
    condition_type: "price_less",
    target_value: "",
    news_category: "",
    cron_minutes: 1,
    notify_telegram: true
  });
`;

code = code.replace(
    /  \/\/ For editing existing signals[\s\S]*?(?=  const \[settingsOpen, setSettingsOpen\] = useState)/,
    state_replace
);

// 2. Update updateSignal & addBulkSignals -> replace with unified saveGroupSignals
const save_group_logic = `  const saveGroupSignals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkSignalForm.target_value && bulkSignalForm.condition_type !== "news_mention") return;
    
    try {
      if (editingGroup) {
         const oldSignalIds = editingGroup.signals.map((s: any) => s.id);
         if (editingGroup.condition_type !== bulkSignalForm.condition_type) {
            await Promise.all(oldSignalIds.map((id: number) => api.investments.removeSignal(id).catch(()=>{})));
         } else {
            const bondsToDelete = editingGroup.bonds.filter((b: any) => !selectedBonds.has(b.id));
            const signalIdsToDelete = bondsToDelete.map((b: any) => editingGroup.signals.find((s: any) => s.bond.id === b.id)?.id).filter(Boolean);
            if (signalIdsToDelete.length) {
               await Promise.all(signalIdsToDelete.map((id: number) => api.investments.removeSignal(id).catch(()=>{})));
            }
         }
      }

      if (selectedBonds.size > 0) {
        await api.investments.addSignalBulk({
          bond_ids: Array.from(selectedBonds),
          condition_type: bulkSignalForm.condition_type,
          target_value: bulkSignalForm.condition_type === "news_mention" ? null : parseFloat(bulkSignalForm.target_value),
          news_category: bulkSignalForm.news_category,
          cron_minutes: bulkSignalForm.cron_minutes,
          notify_telegram: bulkSignalForm.notify_telegram
        });
      }

      fetchData();
      setBulkModalOpen(false);
      setSelectedBonds(new Set());
      setEditingGroup(null);
    } catch (e) {
      console.error(e);
      alert("Ошибка при сохранении сигнала");
    }
  };
`;

code = code.replace(
    /  const updateSignal = async \(e: React\.FormEvent\) => \{[\s\S]*?(?=  const removeSignal = async)/,
    save_group_logic
);

// 3. Replace {mainTab === "signals"} block
const signals_tab_replacement = `      {/* SIGNALS TAB */}
      {mainTab === "signals" && (
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden flex flex-col mt-6">
          <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--card)] relative z-10">
            <h2 className="text-[var(--foreground)] font-semibold text-lg">Активные сигналы</h2>
            <button onClick={() => {
              setEditingGroup(null);
              setBulkSignalForm({ condition_type: "price_less", target_value: "", news_category: "", cron_minutes: 1, notify_telegram: true });
              setSelectedBonds(new Set());
              setBulkModalOpen(true);
            }} className="bg-[var(--accent)] text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap">
              + Добавить сигнал
            </button>
          </div>
          
          {signals.length === 0 ? (
            <div className="text-center p-12">
              <p className="text-[var(--muted)]">У вас пока нет активных сигналов.</p>
            </div>
          ) : (
            <div className="p-6 grid gap-4 grid-cols-1 md:grid-cols-2">
              {(() => {
                const groups = Object.values(signals.reduce((acc, sig) => {
                  const key = \`\${sig.condition_type}_\${sig.target_value}_\${sig.news_category}_\${sig.cron_minutes}_\${sig.notify_telegram}\`;
                  if (!acc[key]) {
                    acc[key] = {
                      key,
                      condition_type: sig.condition_type,
                      target_value: sig.target_value,
                      news_category: sig.news_category,
                      cron_minutes: sig.cron_minutes,
                      notify_telegram: sig.notify_telegram,
                      bonds: [],
                      signals: []
                    };
                  }
                  if (!acc[key].bonds.find((b: any) => b.id === sig.bond.id)) {
                    acc[key].bonds.push(sig.bond);
                  }
                  acc[key].signals.push(sig);
                  return acc;
                }, {} as Record<string, any>));

                return groups.map((group) => {
                  let badgeColor = "bg-[var(--card-hover)]";
                  if (group.condition_type.includes("greater") || group.condition_type.includes("grow")) badgeColor = "bg-green-500/10 text-green-500 border-green-500/20";
                  if (group.condition_type.includes("less") || group.condition_type.includes("drop")) badgeColor = "bg-red-500/10 text-red-500 border-red-500/20";
                  if (group.condition_type === "news_mention") badgeColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";

                  return (
                    <div key={group.key} className="flex flex-col justify-between bg-[var(--background)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)] transition-colors relative group">
                      <div>
                        <div className="flex items-center justify-between mb-3 gap-4">
                          <h3 className="font-semibold text-[var(--foreground)] text-base break-words">
                            {group.condition_type === "price_less" && \`Цена упадет < \${group.target_value}\`}
                            {group.condition_type === "price_greater" && \`Цена вырастет > \${group.target_value}\`}
                            {group.condition_type === "yield_greater" && \`Доходность > \${group.target_value}%\`}
                            {group.condition_type === "yield_less" && \`Доходность < \${group.target_value}%\`}
                            {group.condition_type === "price_change_drop_greater" && \`Дневное падение > \${group.target_value}%\`}
                            {group.condition_type === "price_change_grow_greater" && \`Дневной рост > \${group.target_value}%\`}
                            {group.condition_type === "news_mention" && (group.news_category ? \`Упоминание в новостях (Кат: \${getCategoryDef(group.news_category)?.label || group.news_category})\` : "Упоминание в новостях (Любая категория)")}
                          </h3>
                          <div className={\`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-md border \${badgeColor}\`}>
                             {group.signals.reduce((acc: number, s: any) => acc + (s.unread_count || 0), 0) > 0 ? (
                               <span className="flex items-center gap-1.5 justify-center"><div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div> Активен</span>
                             ) : "Мониторинг"}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {group.bonds.map((b: any) => (
                            <span key={b.id} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--card-hover)] text-[var(--muted)] border border-[var(--border)]">
                              {b.shortname}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[var(--border)]">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroup(group);
                            setSelectedBonds(new Set(group.bonds.map((b: any) => b.id)));
                            setBulkSignalForm({
                              condition_type: group.condition_type,
                              target_value: group.target_value ? group.target_value.toString() : "",
                              news_category: group.news_category || "",
                              cron_minutes: group.cron_minutes || 1,
                              notify_telegram: group.notify_telegram !== false
                            });
                            setBulkModalOpen(true);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors border border-transparent hover:border-[var(--accent)]/20"
                        >
                          Настроить
                        </button>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('Удалить отслеживание этого сигнала для всех выбранных бумаг?')) {
                              const ids = group.signals.map((s: any) => s.id);
                              await Promise.all(ids.map((id: number) => api.investments.removeSignal(id).catch(()=>{})));
                              fetchData();
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}
`;

code = code.replace(
    /      \{\/\* SIGNALS TAB \*\/\}[\s\S]*?(?=      \{\/\* EDIT SIGNAL MODAL \*\/\})/,
    signals_tab_replacement
);

// 4. Remove EDIT SIGNAL MODAL completely
code = code.replace(
    /      \{\/\* EDIT SIGNAL MODAL \*\/\}[\s\S]*?(?=      \{\/\* STICKY BULK ACTION BAR \*\/\})/,
    '\n'
);

// 5. Modify STICKY BULK ACTION BAR so the Delete All button is hidden in "signals" tab
code = code.replace(
    /          \{mainTab === "signals" && \([\s\S]*?\n          \)\}\n/,
    ''
);

// 6. Adjust BULK SIGNAL MODAL to include Portfolio multi-select checkboxes
const modal_replace = `      {/* UNIFIED SIGNAL MODAL */}
      {bulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-md overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg text-[var(--foreground)]">{editingGroup ? 'Редактировать сигнал' : 'Новый сигнал'}</h3>
              <button type="button" onClick={() => { setBulkModalOpen(false); setEditingGroup(null); }} className="text-[var(--muted)] hover:text-[var(--foreground)] px-2 py-1 bg-[var(--card-hover)] rounded-lg">✕</button>
            </div>
            
            <form onSubmit={saveGroupSignals} className="p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-4">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1.5 font-medium">Событие</label>
                <select
                  className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors text-sm"
                  value={bulkSignalForm.condition_type}
                  onChange={e => setBulkSignalForm({...bulkSignalForm, condition_type: e.target.value})}
                >
                  <option value="price_less">Достижение цены (Упадет ниже)</option>
                  <option value="price_greater">Достижение цены (Вырастет выше)</option>
                  <option value="yield_less">Достижение доходности (Меньше)</option>
                  <option value="yield_greater">Достижение доходности (Больше)</option>
                  <option value="price_change_drop_greater">Дневное падение > %</option>
                  <option value="price_change_grow_greater">Дневной рост > %</option>
                  <option value="news_mention">Упоминание названия в новостях</option>
                </select>
              </div>
              
              {bulkSignalForm.condition_type !== "news_mention" && (
                <div className="animate-fade-in">
                  <label className="block text-sm text-[var(--muted)] mb-1.5 font-medium">Значение <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded ml-1">АБСОЛЮТНОЕ</span></label>
                  <input
                    type="number" step="0.01" required
                    className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors text-sm"
                    placeholder="Например: 1000 или 95.5"
                    value={bulkSignalForm.target_value}
                    onChange={e => setBulkSignalForm({...bulkSignalForm, target_value: e.target.value})}
                  />
                  <p className="text-[10px] text-[var(--muted)] mt-1.5">При установке значения для нескольких бумаг, убедитесь что указанный уровень актуален для каждой из них.</p>
                </div>
              )}

              {bulkSignalForm.condition_type === "news_mention" && (
                <div className="animate-fade-in space-y-4">
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1.5 font-medium">Категория новостей (Парсер)</label>
                    <select
                      className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors text-sm"
                      value={bulkSignalForm.news_category}
                      onChange={e => setBulkSignalForm({...bulkSignalForm, news_category: e.target.value})}
                    >
                      <option value="">Все категории (Любая)</option>
                      {Array.from(new Set(sources.map(s => s.category).filter(Boolean))).map(cat => {
                        const label = getCategoryDef(cat as string)?.label || cat;
                        return <option key={cat as string} value={cat as string}>{label}</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1.5 font-medium">Периодичность проверки</label>
                    <select
                      className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors text-sm"
                      value={bulkSignalForm.cron_minutes}
                      onChange={e => setBulkSignalForm({...bulkSignalForm, cron_minutes: Number(e.target.value)})}
                    >
                      <option value="1">Мгновенная (сразу)</option>
                      <option value="15">Каждые 15 минут</option>
                      <option value="60">Каждый час</option>
                      <option value="360">Раз в 6 часов</option>
                      <option value="1440">Раз в день</option>
                    </select>
                  </div>
                </div>
              )}
              
              <div className="pt-2 border-t border-[var(--border)]">
                <label className="block text-sm text-[var(--foreground)] mb-3 font-semibold flex items-center justify-between">
                  <span>Применить к облигациям</span>
                  <span className="text-[var(--accent)] px-2 py-0.5 bg-[var(--accent)]/10 rounded-full text-[10px]">{selectedBonds.size} выбрано</span>
                </label>
                <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-2 custom-scrollbar border border-[var(--border)] rounded-xl p-2 bg-[var(--background)] shadow-inner">
                  {portfolio.length === 0 ? (
                    <p className="text-[11px] text-[var(--muted)] text-center py-2">Портфель пуст. Добавьте бумаги перед созданием сигнала.</p>
                  ) : portfolio.map(p => (
                    <label key={p.bond.id} className={\`flex items-center gap-3 cursor-pointer px-3 py-2 rounded-lg transition-colors border \${selectedBonds.has(p.bond.id) ? 'bg-[var(--accent)]/5 border-[var(--accent)]/30' : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--muted)]'}\`}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] shrink-0" 
                        checked={selectedBonds.has(p.bond.id)} 
                        onChange={(e) => {
                          const newSet = new Set(selectedBonds);
                          if (e.target.checked) newSet.add(p.bond.id);
                          else newSet.delete(p.bond.id);
                          setSelectedBonds(newSet);
                        }} 
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-semibold text-[var(--foreground)] leading-tight truncate block">{p.bond.shortname}</span>
                        {bulkSignalForm.condition_type !== "news_mention" && p.bond.current_price && (
                           <span className="text-[10px] text-[var(--muted)]">Акт. цена: <b>{p.bond.current_price}%</b></span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer mt-1 pt-3 border-t border-[var(--border)] bg-[var(--background)] p-3 rounded-xl border border-transparent hover:border-[var(--border)] transition-colors shrink-0">
                <input type="checkbox" className="w-5 h-5 rounded border-[var(--border)] text-[var(--accent)]" checked={bulkSignalForm.notify_telegram} onChange={e => setBulkSignalForm({...bulkSignalForm, notify_telegram: e.target.checked})} />
                <span className="font-medium text-[13px] text-[var(--foreground)]">Уведомление в Telegram (бот)</span>
              </label>
              
              <div className="pt-2 shrink-0">
                <button type="submit" disabled={selectedBonds.size === 0} className="w-full bg-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-[14px] font-semibold hover:opacity-90 transition-opacity flex justify-center items-center">
                  {editingGroup ? 'Обновить (для ' + selectedBonds.size + ' бумаг)' : 'Создать (для ' + selectedBonds.size + ' бумаг)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

code = code.replace(
    /      \{\/\* BULK SIGNAL MODAL \*\/\}[\s\S]*?(?=    <\/div>\n  \);\n\})/,
    modal_replace
);

fs.writeFileSync('frontend/src/app/(dashboard)/investments/bonds/page.tsx', code, 'utf-8');
console.log("SUCCESS");
