const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const target = "pathname === '/api/leases/agreements' && method === 'POST'";
const idx = s.indexOf(target);
if (idx !== -1) {
  console.log(s.substring(idx - 20, idx + 1000));
} else {
  console.log('Target not found');
}

