const fs = require('fs');
const c = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');

function showSec(path) {
  const idx = c.indexOf(`pathname === '${path}' && method === 'POST'`);
  console.log(`=== ${path} ===`);
  if (idx !== -1) console.log(c.substring(idx, idx + 450));
}

showSec('/api/payments');
showSec('/api/water-readings');
showSec('/api/maintenance');
showSec('/api/expenses');
