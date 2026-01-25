import https from 'https';
import fs from 'fs';

// Load token
const token = JSON.parse(fs.readFileSync('google-fit-token.json', 'utf-8'));
const ACCESS_TOKEN = token.access_token;

// Date range: 2026-01-08 00:00:00 to 2026-01-08 23:59:59 (JST -> UTC)
const startDate = new Date('2026-01-07T15:00:00Z');
const endDate = new Date('2026-01-08T14:59:59.999Z');

const startTimeNanos = startDate.getTime() * 1000000;
const endTimeNanos = endDate.getTime() * 1000000;

console.log('Fetching heart rate data from Google Fit...');
console.log(`Date range: 2026-01-08 (JST)`);
console.log(`Start: ${startDate.toISOString()}`);
console.log(`End: ${endDate.toISOString()}`);

// Data sources to try
const dataSources = [
  'raw:com.google.heart_rate.bpm:com.fitbit.FitbitMobile:health_platform',
  'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm',
  'derived:com.google.heart_rate.bpm:com.google.android.gms:resting_heart_rate<-merge_heart_rate_bpm'
];

async function getDataFromSource(dataSourceId) {
  const datasetId = `${startTimeNanos}-${endTimeNanos}`;

  return new Promise((resolve, reject) => {
    const path = `/fitness/v1/users/me/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${datasetId}`;
    console.log(`\nFetching from: ${dataSourceId}`);

    const options = {
      hostname: 'www.googleapis.com',
      path: path,
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
          console.log(`  Points found: ${parsed.point?.length || 0}`);
          resolve({ dataSourceId, data: parsed });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    const results = {};

    for (const source of dataSources) {
      const result = await getDataFromSource(source);
      results[source] = result.data;
    }

    // Find the source with actual data
    let heartRatePoints = [];
    for (const [source, data] of Object.entries(results)) {
      if (data.point && data.point.length > 0) {
        console.log(`\nUsing data from: ${source}`);
        heartRatePoints = data.point.map(p => ({
          time: new Date(parseInt(p.startTimeNanos) / 1000000).toISOString(),
          timeJST: new Date(parseInt(p.startTimeNanos) / 1000000 + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00'),
          bpm: p.value[0]?.fpVal || p.value[0]?.intVal
        }));
        break;
      }
    }

    const output = {
      date: '2026-01-08',
      timezone: 'Asia/Tokyo',
      totalDataPoints: heartRatePoints.length,
      heartRatePoints: heartRatePoints,
      rawResponses: results
    };

    if (heartRatePoints.length > 0) {
      // Calculate statistics
      const bpmValues = heartRatePoints.map(p => p.bpm).filter(v => v);
      output.statistics = {
        min: Math.min(...bpmValues),
        max: Math.max(...bpmValues),
        average: Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length)
      };
      console.log(`\nStatistics:`);
      console.log(`  Min: ${output.statistics.min} bpm`);
      console.log(`  Max: ${output.statistics.max} bpm`);
      console.log(`  Average: ${output.statistics.average} bpm`);
    }

    fs.writeFileSync('google-fit-heartrate-2026-01-08.json', JSON.stringify(output, null, 2));
    console.log(`\nData saved to google-fit-heartrate-2026-01-08.json`);
    console.log(`Total data points: ${heartRatePoints.length}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
