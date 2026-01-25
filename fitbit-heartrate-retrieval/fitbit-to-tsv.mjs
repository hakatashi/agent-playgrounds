import fs from 'fs';

const data = JSON.parse(fs.readFileSync('fitbit-heartrate-intraday-2026-01-08.json', 'utf-8'));
const intradayData = data['activities-heart-intraday'].dataset;
const date = data['activities-heart'][0].dateTime;

// Create TSV content
const header = 'date\ttime\tbpm';
const rows = intradayData.map(p => `${date}\t${p.time}\t${p.value}`);
const tsv = [header, ...rows].join('\n');

fs.writeFileSync('fitbit-heartrate-2026-01-08.tsv', tsv);
console.log(`TSV file created: fitbit-heartrate-2026-01-08.tsv`);
console.log(`Total rows: ${rows.length}`);
