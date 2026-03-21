const https = require('https');

const checkUrl = (url, name) => {
    https.get(url, (res) => {
        let rawData = '';
        res.on('data', (chunk) => rawData += chunk);
        res.on('end', () => {
            const lines = rawData.split(/\r?\n/);
            let matches2026 = 0;
            let first2026 = null;
            let lastStarts = [];
            lines.forEach(line => {
                if(line.startsWith("DTSTART")) {
                    const start = line.split(":").pop();
                    if (start) lastStarts.push(start.trim());
                    if (line.includes("2026")) {
                        matches2026++;
                        if (!first2026) first2026 = line;
                    }
                }
            });
            console.log(`[${name}] Lines: ${lines.length}. 2026 matches: ${matches2026}`);
            if (matches2026 > 0) console.log(`[${name}] First 2026 match start: ${first2026}`);
            if (lastStarts.length > 0) {
                console.log(`[${name}] Last 3 matches in file:`, lastStarts.slice(-3));
            }
        });
    });
};

checkUrl('https://ics.fixtur.es/v2/league/premier-league.ics', 'EPL');
checkUrl('https://ics.fixtur.es/v2/league/russian-premier-league.ics', 'RPL');
