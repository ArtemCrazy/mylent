const fs = require('fs');

let code = fs.readFileSync('frontend/src/app/(dashboard)/investments/bonds/page.tsx', 'utf-8');

const type_def = `type SignalItem = {
  id: number;
  condition_type: string;
  target_value: number;
  news_category: string | null;
  cron_minutes: number;
  notify_telegram: boolean;
  unread_count?: number;
  bond: { shortname: string; isin: string; id: number; current_price?: number; current_yield?: number; rating_ru?: string };
};

type SignalGroup = {
  key: string;
  condition_type: string;
  target_value: number | null;
  news_category: string | null;
  cron_minutes: number;
  notify_telegram: boolean;
  bonds: Bond[];
  signals: SignalItem[];
};
`;

code = code.replace(/type SignalItem = \{[\s\S]*?\};\n/g, type_def);

code = code.replace(/useState<Record<string, unknown> \| null>\(null\)/g, "useState<SignalGroup | null>(null)");
code = code.replace(/<string, Record<string, unknown>>/g, "<string, SignalGroup>");

fs.writeFileSync('frontend/src/app/(dashboard)/investments/bonds/page.tsx', code, 'utf-8');
console.log("ADDED SIGNALGROUP TYPE");
