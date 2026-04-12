const fs = require('fs');
let code = fs.readFileSync('frontend/src/app/(dashboard)/investments/bonds/page.tsx', 'utf-8');
code = code.replace(/group\.bonds\.map\(\(b: Bond\)/g, 'group.bonds.map((b: SignalItem["bond"])');
code = code.replace(/group\.bonds\.map\(\(b: any\)/g, 'group.bonds.map((b: SignalItem["bond"])');
fs.writeFileSync('frontend/src/app/(dashboard)/investments/bonds/page.tsx', code, 'utf-8');
