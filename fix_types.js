const fs = require('fs');

let code = fs.readFileSync('frontend/src/app/(dashboard)/investments/bonds/page.tsx', 'utf-8');

// Replace any types
code = code.replace(/useState<any>\(null\)/g, "useState<Record<string, unknown> | null>(null)");
code = code.replace(/\(s: any\)/g, "(s: SignalItem)");
code = code.replace(/\(b: any\)/g, "(b: Bond)");
code = code.replace(/<string, any>/g, "<string, Record<string, unknown>>");

// Ensure group type aligns
code = code.replace(/\{group.signals.reduce\(\(acc: number, s: any\) =>/g, "{group.signals.reduce((acc: number, s: SignalItem) =>");

// remove unused local `removeSignal` function
code = code.replace(/  const removeSignal = async \(id: number\) => \{[\s\S]*?\n  \};\n/g, "");

fs.writeFileSync('frontend/src/app/(dashboard)/investments/bonds/page.tsx', code, 'utf-8');
console.log("REPLACED ANY TYPES");
