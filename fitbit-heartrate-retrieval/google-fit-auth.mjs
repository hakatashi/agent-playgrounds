import http from 'http';
import https from 'https';
import { URL } from 'url';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
}

const CLIENT_ID = process.env.GOOGLE_FIT_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_FIT_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8080';
const SCOPE = 'https://www.googleapis.com/auth/fitness.heart_rate.read';

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}&response_type=code&access_type=offline`;

console.log('Opening browser for authentication...');
console.log('\nIf browser does not open automatically, visit this URL:\n');
console.log(authUrl);
console.log('\n');

exec(`start "" "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get('code');

  if (code) {
    console.log('Authorization code received. Exchanging for access token...');

    try {
      const tokenData = await exchangeCodeForToken(code);
      console.log('\n=== Access Token Retrieved ===\n');
      console.log(JSON.stringify(tokenData, null, 2));

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body><h1>認証成功!</h1><p>このウィンドウを閉じてください。</p></body></html>');

      fs.writeFileSync(path.join(__dirname, 'google-fit-token.json'), JSON.stringify(tokenData, null, 2));
      console.log('\nToken saved to google-fit-token.json');

      setTimeout(() => process.exit(0), 1000);
    } catch (error) {
      console.error('Error exchanging code:', error);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body><h1>エラー</h1><p>' + error.message + '</p></body></html>');
    }
  } else {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<html><body><h1>エラー</h1><p>認証コードがありません</p></body></html>');
  }
});

function exchangeCodeForToken(code) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error_description || parsed.error));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

server.listen(8080, () => {
  console.log('Waiting for authentication on http://localhost:8080 ...');
});
