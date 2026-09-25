// tools/scrape/00-net.js — fast connectivity probe (hard 12s process cap)
const https = require('https');
const targets = [
  'https://nikkyjain.github.io/JinVani/jainDataBase/misc/GunsthanTable.html',
  'https://nikkyjain.github.io/jainDataBase/misc/GunsthanTable.html',
  'https://jainsamaj.world/jinvani.html'
];
let done = 0;
const hardStop = setTimeout(() => { console.log('RESULT: hard timeout'); process.exit(0); }, 12000);
function finish() { if (++done === targets.length) { clearTimeout(hardStop); process.exit(0); } }
for (const url of targets) {
  const req = https.get(url, { timeout: 9000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' } }, res => {
    console.log('status=' + res.statusCode + '  ' + url);
    res.resume(); finish();
  });
  req.on('error', e => { console.log('ERR ' + e.message + '  ' + url); finish(); });
  req.on('timeout', () => { console.log('SOCKET_TIMEOUT  ' + url); req.destroy(); finish(); });
}
