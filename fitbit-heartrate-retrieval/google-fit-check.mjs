import https from 'https';
import fs from 'fs';

const token = JSON.parse(fs.readFileSync('google-fit-token.json', 'utf-8'));
const ACCESS_TOKEN = token.access_token;

// Check last 30 days for any heart rate data
const endDate = new Date();
const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

const startTimeNanos = startDate.getTime() * 1000000;
const endTimeNanos = endDate.getTime() * 1000000;

console.log('Checking for heart rate data in the last 30 days...');
console.log(`From: ${startDate.toISOString()}`);
console.log(`To: ${endDate.toISOString()}`);

const dataSourceId = 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm';
const datasetId = `${startTimeNanos}-${endTimeNanos}`;

const options = {
  hostname: 'www.googleapis.com',
  path: `/fitness/v1/users/me/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${datasetId}?limit=100`,
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
    const parsed = JSON.parse(data);
    console.log(`\nTotal data points found: ${parsed.point?.length || 0}`);

    if (parsed.point && parsed.point.length > 0) {
      console.log('\nFirst 10 data points:');
      parsed.point.slice(0, 10).forEach(p => {
        const time = new Date(parseInt(p.startTimeNanos) / 1000000);
        console.log(`  ${time.toISOString()}: ${p.value[0]?.fpVal || p.value[0]?.intVal} bpm`);
      });

      console.log('\nLast 10 data points:');
      parsed.point.slice(-10).forEach(p => {
        const time = new Date(parseInt(p.startTimeNanos) / 1000000);
        console.log(`  ${time.toISOString()}: ${p.value[0]?.fpVal || p.value[0]?.intVal} bpm`);
      });
    } else {
      console.log('\nNo heart rate data found in Google Fit for the last 30 days.');
      console.log('This could mean:');
      console.log('1. Fitbit is not syncing to Google Fit');
      console.log('2. Heart rate data sync is disabled');
      console.log('3. No heart rate data was recorded');

      if (parsed.error) {
        console.log('\nAPI Error:', JSON.stringify(parsed.error, null, 2));
      }
    }
  });
});

req.on('error', console.error);
req.end();
