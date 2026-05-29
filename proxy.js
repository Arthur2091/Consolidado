const http  = require('http');
const https = require('https');

const PORT = 3131;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method !== 'POST')   { res.writeHead(404); res.end(); return; }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const apiKey = req.headers['x-api-key'] || '';
    const opts = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body),
      },
    };

    const proxy = https.request(opts, r => {
      res.writeHead(r.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      r.pipe(res);
    });
    proxy.on('error', e => {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: { message: e.message } }));
    });
    proxy.write(body);
    proxy.end();
  });
}).listen(PORT, () => console.log(`✓ Proxy corriendo en http://localhost:${PORT}`));
