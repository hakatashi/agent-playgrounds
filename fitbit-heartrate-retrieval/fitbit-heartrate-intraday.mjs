import https from 'https';
import fs from 'fs';

const token = JSON.parse(fs.readFileSync('fitbit-token.json', 'utf-8'));
const ACCESS_TOKEN = token.access_token;
const USER_ID = token.user_id;

const DATE = '2026-01-08';
const DETAIL_LEVEL = '1sec'; // 1sec, 1min, 5min, or 15min

console.log(`Fetching intraday heart rate data for ${DATE}...`);
console.log(`Detail level: ${DETAIL_LEVEL}`);
console.log(`User ID: ${USER_ID}`);

// Intraday Heart Rate endpoint
const url = `/1/user/${USER_ID}/activities/heart/date/${DATE}/1d/${DETAIL_LEVEL}.json`;

const options = {
  hostname: 'api.fitbit.com',
  path: url,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);

      if (parsed.errors) {
        console.error('API Error:', JSON.stringify(parsed.errors, null, 2));
        return;
      }

      // Check for intraday data
      const intradayData = parsed['activities-heart-intraday'];
      if (intradayData && intradayData.dataset) {
        console.log(`\nIntraday data points: ${intradayData.dataset.length}`);

        if (intradayData.dataset.length > 0) {
          console.log('\nFirst 10 data points:');
          intradayData.dataset.slice(0, 10).forEach(p => {
            console.log(`  ${p.time}: ${p.value} bpm`);
          });

          console.log('\nLast 10 data points:');
          intradayData.dataset.slice(-10).forEach(p => {
            console.log(`  ${p.time}: ${p.value} bpm`);
          });

          // Calculate statistics
          const values = intradayData.dataset.map(p => p.value);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

          console.log('\nStatistics:');
          console.log(`  Min: ${min} bpm`);
          console.log(`  Max: ${max} bpm`);
          console.log(`  Average: ${avg} bpm`);

          // Add statistics to output
          parsed.statistics = { min, max, average: avg, totalDataPoints: values.length };
        }
      }

      // Save to file
      fs.writeFileSync(`fitbit-heartrate-intraday-${DATE}.json`, JSON.stringify(parsed, null, 2));
      console.log(`\nData saved to fitbit-heartrate-intraday-${DATE}.json`);

    } catch (e) {
      console.error('Parse error:', e);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', console.error);
req.end();
