import fs from 'fs';

const data = JSON.parse(fs.readFileSync('fitbit-heartrate-intraday-2026-01-08.json', 'utf-8'));
const intradayData = data['activities-heart-intraday'].dataset;
const date = data['activities-heart'][0].dateTime;

// Offset in seconds (heart rate data is 173 seconds ahead)
const OFFSET_SECONDS = 173;

function adjustTime(timeStr, offsetSeconds) {
  const [h, m, s] = timeStr.split(':').map(Number);
  let totalSeconds = h * 3600 + m * 60 + s - offsetSeconds;

  // Handle day boundary
  if (totalSeconds < 0) {
    totalSeconds += 24 * 3600;
  }

  const newH = Math.floor(totalSeconds / 3600) % 24;
  const newM = Math.floor((totalSeconds % 3600) / 60);
  const newS = totalSeconds % 60;

  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(newS).padStart(2, '0')}`;
}

// Create TSV content with adjusted time
const header = 'date\ttime\toriginal_time\tbpm';
const rows = intradayData.map(p => {
  const adjustedTime = adjustTime(p.time, OFFSET_SECONDS);
  return `${date}\t${adjustedTime}\t${p.time}\t${p.value}`;
});

const tsv = [header, ...rows].join('\n');

fs.writeFileSync('fitbit-heartrate-2026-01-08-adjusted.tsv', tsv);
console.log(`Adjusted TSV file created: fitbit-heartrate-2026-01-08-adjusted.tsv`);
console.log(`Offset applied: -${OFFSET_SECONDS} seconds`);
console.log(`Total rows: ${rows.length}`);

// Show sample around the peak time
console.log('\nSample data around 16:39-16:43 (adjusted time):');
rows.filter(r => {
  const time = r.split('\t')[1];
  return time >= '16:39:00' && time <= '16:43:00';
}).forEach(r => console.log(r));
