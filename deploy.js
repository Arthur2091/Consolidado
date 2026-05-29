#!/usr/bin/env node
// Deploy: Consolidado/index.html → Arthur2091/R2
// Uso: node deploy.js TU_GITHUB_TOKEN

const fs   = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');

const TOKEN   = process.argv[2];
const USUARIO = 'Arthur2091';
const REPO    = 'R2';
const FILE    = 'index.html';

if (!TOKEN) {
  console.error('❌ Uso: node deploy.js TU_GITHUB_TOKEN');
  process.exit(1);
}

const localFile = path.join(__dirname, FILE);
if (!fs.existsSync(localFile)) {
  console.error('❌ No se encontró ' + localFile);
  process.exit(1);
}

function apiRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': 'token ' + TOKEN,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'consolidado-deploy',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { resolve(raw); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function ask(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); resolve(a.trim()); });
  });
}

async function main() {
  console.log('\n============================================');
  console.log(`  🚀 DEPLOY: Consolidado → ${USUARIO}/${REPO}`);
  console.log('============================================\n');

  console.log('📦 Leyendo archivo local...');
  const content = fs.readFileSync(localFile).toString('base64');
  console.log('✅ Archivo leído (' + Math.round(fs.statSync(localFile).size / 1024) + ' KB)\n');

  console.log('📋 Verificando repo remoto...');
  const remote = await apiRequest('GET', `/repos/${USUARIO}/${REPO}/contents/${FILE}`);
  const sha = remote.sha || null;
  if (sha) console.log(`✅ Archivo encontrado en repo (SHA: ${sha.slice(0,8)}...)\n`);
  else     console.log('⚠️  Archivo no existe en el repo — se creará\n');

  const confirm = await ask(`⚠️  Vas a sobreescribir ${USUARIO}/${REPO}/${FILE}\n   ¿Confirmás el deploy? (s/n): `);
  if (confirm.toLowerCase() !== 's') {
    console.log('❌ Deploy cancelado');
    process.exit(0);
  }

  const ts = new Date().toLocaleString('es-AR');
  const body = { message: `Deploy Consolidado - ${ts}`, content };
  if (sha) body.sha = sha;

  console.log('\n📤 Subiendo a GitHub...');
  const result = await apiRequest('PUT', `/repos/${USUARIO}/${REPO}/contents/${FILE}`, body);

  if (result && result.content) {
    console.log('\n============================================');
    console.log('✅ DEPLOY EXITOSO — ' + ts);
    console.log(`   URL: https://${USUARIO}.github.io/${REPO}`);
    console.log('   (Puede tardar 1-2 minutos en reflejarse)');
    console.log('============================================\n');
  } else {
    console.error('❌ Error en deploy:', result.message || JSON.stringify(result));
    process.exit(1);
  }
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
