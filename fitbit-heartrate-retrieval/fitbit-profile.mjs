import https from 'https';
import fs from 'fs';

const token = JSON.parse(fs.readFileSync('fitbit-token.json', 'utf-8'));

const options = {
  hostname: 'api.fitbit.com',
  path: '/1/user/-/profile.json',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token.access_token}`,
    'Accept': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    console.log('Timezone:', parsed.user?.timezone);
    console.log('Offset from UTC (minutes):', parsed.user?.offsetFromUTCMillis / 60000);
  });
});

req.on('error', console.error);
req.end();
